const Content = require('../models/Content');
const User = require('../models/User');
const {
      CONTENT_EXCLUDED_TYPES,
      DEFAULT_FEED_LIMIT,
      MAX_FEED_LIMIT,
      buildContentEnrichmentStages,
      buildCursorMatch,
      buildFeedModeMatch,
      decodeCursor,
      toObjectId,
      toPositiveInt,
      unpackCursorPage
} = require('../utils/feedAggregation');

let feedCache = {
      data: null,
      lastUpdated: 0,
      ttl: 3 * 60 * 1000
};

const getViewerId = (reqUser) => reqUser?._id || reqUser?.id || null;

const stripSilentMetrics = (content) => {
      if (!content?.silentMode) return content;
      const { metrics, ...safeContent } = content;
      return safeContent;
};

const buildCreatorVisibilityFilter = (viewerId) => {
      const viewerObjectId = toObjectId(viewerId);
      if (!viewerObjectId) return [];

      return [
            {
                  $match: {
                        $expr: {
                              $not: [
                                    { $in: [viewerObjectId, { $ifNull: ['$blockedUsers', []] }] }
                              ]
                        }
                  }
            }
      ];
};

const buildFeedMatch = ({
      mode = 'all',
      contentType,
      topic,
      viewerBlockedIds = [],
      cursor
}) => {
      const filters = [
            {
                  status: 'published',
                  visibility: 'public',
                  isApproved: true,
                  ...buildFeedModeMatch(mode)
            }
      ];

      if (contentType) {
            filters.push({ contentType });
      }

      if (topic) {
            filters.push({ topics: topic });
      }

      if (Array.isArray(viewerBlockedIds) && viewerBlockedIds.length > 0) {
            filters.push({
                  creator: {
                        $nin: viewerBlockedIds
                              .map((value) => toObjectId(value))
                              .filter(Boolean)
                  }
            });
      }

      const cursorMatch = buildCursorMatch(cursor);
      if (cursorMatch) {
            filters.push(cursorMatch);
      }

      return filters.length === 1 ? filters[0] : { $and: filters };
};

const fetchFeedPage = async ({
      mode = 'all',
      contentType,
      topic,
      limit,
      cursor,
      viewerId,
      viewerBlockedIds = [],
      sort = { createdAt: -1, _id: -1 }
}) => {
      const aggregation = await Content.aggregate([
            {
                  $match: buildFeedMatch({
                        mode,
                        contentType,
                        topic,
                        viewerBlockedIds,
                        cursor
                  })
            },
            { $sort: sort },
            {
                  $facet: {
                        contents: [
                              { $limit: limit + 1 },
                              ...buildContentEnrichmentStages({
                                    viewerId,
                                    creatorLookupMatch: buildCreatorVisibilityFilter(viewerId)
                              })
                        ]
                  }
            }
      ]);

      const { items, hasMore, nextCursor } = unpackCursorPage(
            aggregation?.[0]?.contents || [],
            limit
      );

      return {
            contents: items.map(stripSilentMetrics),
            hasMore,
            nextCursor
      };
};

const buildFeedResponse = ({
      contents,
      mode,
      limit,
      hasMore,
      nextCursor,
      topic = null,
      query = null
}) => ({
      success: true,
      data: {
            contents,
            mode,
            ...(topic ? { topic } : {}),
            ...(query ? { query } : {}),
            pagination: {
                  limit,
                  hasMore,
                  nextCursor
            }
      }
});

const getFeed = async (req, res, next) => {
      try {
            const {
                  mode = 'all',
                  cursor: rawCursor,
                  limit = DEFAULT_FEED_LIMIT,
                  contentType,
                  topic
            } = req.query;

            const viewerId = getViewerId(req.user);
            const decodedCursor = decodeCursor(rawCursor);
            const limitNum = toPositiveInt(limit, DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT);
            const viewerBlockedIds = req.user?.blockedUsers || [];

            const isPublicFirstPage = !viewerId && mode === 'all' && !contentType && !topic && !decodedCursor;
            if (isPublicFirstPage && feedCache.data && (Date.now() - feedCache.lastUpdated < feedCache.ttl)) {
                  res.setHeader('Cache-Control', 'public, max-age=90');
                  return res.json(feedCache.data);
            }

            const { contents, hasMore, nextCursor } = await fetchFeedPage({
                  mode,
                  contentType,
                  topic,
                  limit: limitNum,
                  cursor: decodedCursor,
                  viewerId,
                  viewerBlockedIds
            });

            const responseData = buildFeedResponse({
                  contents,
                  mode,
                  limit: limitNum,
                  hasMore,
                  nextCursor,
                  topic: topic || null
            });

            if (isPublicFirstPage) {
                  feedCache = {
                        data: responseData,
                        lastUpdated: Date.now(),
                        ttl: 3 * 60 * 1000
                  };
            }

            res.setHeader('Cache-Control', viewerId ? 'private, max-age=45' : 'public, max-age=90');
            return res.json(responseData);
      } catch (error) {
            return next(error);
      }
};

const getFeedByTopic = async (req, res, next) => {
      try {
            req.query.topic = req.params.topic;
            req.query.mode = req.query.mode || 'all';
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return getFeed(req, res, next);
      } catch (error) {
            return next(error);
      }
};

const getCreatorFeed = async (req, res, next) => {
      try {
            const { username } = req.params;
            const viewerId = getViewerId(req.user);
            const viewerObjectId = toObjectId(viewerId);
            const limitNum = toPositiveInt(req.query.limit, DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT);
            const decodedCursor = decodeCursor(req.query.cursor);
            const viewerBlockedIds = (req.user?.blockedUsers || [])
                  .map((value) => toObjectId(value))
                  .filter(Boolean);

            const aggregation = await User.aggregate([
                  { $match: { username } },
                  { $limit: 1 },
                  {
                        $addFields: {
                              isOwnProfile: viewerObjectId
                                    ? { $eq: ['$_id', viewerObjectId] }
                                    : false,
                              blockedByViewer: { $in: ['$_id', viewerBlockedIds] },
                              hasBlockedViewer: viewerObjectId
                                    ? { $in: [viewerObjectId, { $ifNull: ['$blockedUsers', []] }] }
                                    : false
                        }
                  },
                  {
                        $match: {
                              blockedByViewer: false,
                              hasBlockedViewer: false
                        }
                  },
                  {
                        $facet: {
                              creator: [
                                    {
                                          $project: {
                                                _id: 1,
                                                id: '$_id',
                                                username: 1,
                                                displayName: { $ifNull: ['$displayName', '$username'] },
                                                avatar: { $ifNull: ['$avatar', ''] },
                                                bio: { $ifNull: ['$bio', ''] },
                                                role: 1,
                                                interests: { $ifNull: ['$interests', []] },
                                                isVerified: { $toBool: '$isVerified' },
                                                verificationRequest: {
                                                      $cond: [
                                                            { $gt: [{ $type: '$verificationRequest' }, 'missing'] },
                                                            {
                                                                  status: '$verificationRequest.status',
                                                                  requestedAt: '$verificationRequest.requestedAt'
                                                            },
                                                            null
                                                      ]
                                                },
                                                followersCount: { $size: { $ifNull: ['$followers', []] } },
                                                followingCount: { $size: { $ifNull: ['$following', []] } },
                                                profileSong: { $ifNull: ['$profileSong', null] },
                                                stats: { $ifNull: ['$stats', {}] },
                                                createdAt: '$createdAt'
                                          }
                                    }
                              ],
                              contentPage: [
                                    {
                                          $lookup: {
                                                from: 'contents',
                                                let: {
                                                      profileUserId: '$_id',
                                                      isOwnProfile: '$isOwnProfile'
                                                },
                                                pipeline: [
                                                      {
                                                            $match: {
                                                                  $expr: {
                                                                        $and: [
                                                                              { $eq: ['$creator', '$$profileUserId'] },
                                                                              { $eq: ['$isApproved', true] },
                                                                              { $not: [{ $in: ['$contentType', CONTENT_EXCLUDED_TYPES] }] },
                                                                              {
                                                                                    $or: [
                                                                                          '$$isOwnProfile',
                                                                                          {
                                                                                                $and: [
                                                                                                      { $eq: ['$visibility', 'public'] },
                                                                                                      { $eq: ['$status', 'published'] }
                                                                                                ]
                                                                                          }
                                                                                    ]
                                                                              }
                                                                        ]
                                                                  }
                                                            }
                                                      },
                                                      ...(buildCursorMatch(decodedCursor) ? [{ $match: buildCursorMatch(decodedCursor) }] : []),
                                                      { $sort: { createdAt: -1, _id: -1 } },
                                                      { $limit: limitNum + 1 },
                                                      ...buildContentEnrichmentStages({ viewerId })
                                                ],
                                                as: 'contents'
                                          }
                                    },
                                    {
                                          $project: {
                                                contents: '$contents'
                                          }
                                    }
                              ]
                        }
                  }
            ]);

            const root = aggregation?.[0];
            const creator = root?.creator?.[0];

            if (!creator) {
                  return res.status(404).json({
                        success: false,
                        message: 'Creator not found'
                  });
            }

            const { items, hasMore, nextCursor } = unpackCursorPage(
                  root?.contentPage?.[0]?.contents || [],
                  limitNum
            );

            res.setHeader(
                  'Cache-Control',
                  viewerId && creator?._id?.toString?.() === viewerId.toString()
                        ? 'private, no-store'
                        : 'public, max-age=30'
            );

            return res.json({
                  success: true,
                  data: {
                        creator,
                        contents: items.map(stripSilentMetrics),
                        pagination: {
                              limit: limitNum,
                              hasMore,
                              nextCursor
                        }
                  }
            });
      } catch (error) {
            return next(error);
      }
};

const searchContent = async (req, res, next) => {
      try {
            const query = String(req.query.q || '').trim();
            const limitNum = toPositiveInt(req.query.limit, DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT);
            const viewerId = getViewerId(req.user);
            const viewerBlockedIds = req.user?.blockedUsers || [];

            if (query.length < 2) {
                  return res.status(400).json({
                        success: false,
                        message: 'Search query must be at least 2 characters'
                  });
            }

            const buildSearchAggregation = (matchStage, sortStage) => Content.aggregate([
                  {
                        $match: {
                              status: 'published',
                              visibility: 'public',
                              isApproved: true,
                              contentType: { $nin: CONTENT_EXCLUDED_TYPES },
                              ...(Array.isArray(viewerBlockedIds) && viewerBlockedIds.length > 0
                                    ? {
                                            creator: {
                                                  $nin: viewerBlockedIds
                                                        .map((value) => toObjectId(value))
                                                        .filter(Boolean)
                                            }
                                    }
                                    : {}),
                              ...matchStage
                        }
                  },
                  { $sort: sortStage },
                  {
                        $facet: {
                              contents: [
                                    { $limit: limitNum + 1 },
                                    ...buildContentEnrichmentStages({
                                          viewerId,
                                          creatorLookupMatch: buildCreatorVisibilityFilter(viewerId)
                                    })
                              ]
                        }
                  }
            ]);

            let aggregation;

            try {
                  aggregation = await buildSearchAggregation(
                        { $text: { $search: query } },
                        { score: { $meta: 'textScore' }, createdAt: -1, _id: -1 }
                  );
            } catch (error) {
                  aggregation = await buildSearchAggregation(
                        {
                              $or: [
                                    { title: { $regex: query, $options: 'i' } },
                                    { body: { $regex: query, $options: 'i' } },
                                    { tags: { $regex: query, $options: 'i' } }
                              ]
                        },
                        { createdAt: -1, _id: -1 }
                  );
            }

            const { items, hasMore, nextCursor } = unpackCursorPage(
                  aggregation?.[0]?.contents || [],
                  limitNum
            );

            return res.json(buildFeedResponse({
                  contents: items.map(stripSilentMetrics),
                  mode: 'search',
                  limit: limitNum,
                  hasMore,
                  nextCursor,
                  query
            }));
      } catch (error) {
            return next(error);
      }
};

const getActiveStories = async (req, res, next) => {
      try {
            const viewerId = getViewerId(req.user);
            const viewerObjectId = toObjectId(viewerId);
            const viewerBlockedIds = (req.user?.blockedUsers || [])
                  .map((value) => toObjectId(value))
                  .filter(Boolean);

            const stories = await Content.aggregate([
                  {
                        $match: {
                              contentType: { $in: ['story', 'text-status'] },
                              expiresAt: { $gt: new Date() },
                              status: 'published',
                              visibility: 'public',
                              ...(viewerBlockedIds.length > 0
                                    ? { creator: { $nin: viewerBlockedIds } }
                                    : {})
                        }
                  },
                  { $sort: { createdAt: 1, _id: 1 } },
                  {
                        $lookup: {
                              from: 'users',
                              let: { creatorId: '$creator' },
                              pipeline: [
                                    {
                                          $match: {
                                                $expr: { $eq: ['$_id', '$$creatorId'] }
                                          }
                                    },
                                    ...buildCreatorVisibilityFilter(viewerId),
                                    {
                                          $project: {
                                                _id: 1,
                                                username: 1,
                                                displayName: { $ifNull: ['$displayName', '$username'] },
                                                avatar: { $ifNull: ['$avatar', ''] }
                                          }
                                    }
                              ],
                              as: 'creatorDoc'
                        }
                  },
                  { $unwind: '$creatorDoc' },
                  {
                        $project: {
                              _id: 1,
                              creator: {
                                    _id: '$creatorDoc._id',
                                    username: '$creatorDoc.username',
                                    displayName: '$creatorDoc.displayName',
                                    avatar: '$creatorDoc.avatar'
                              },
                              contentType: 1,
                              body: 1,
                              media: 1,
                              createdAt: 1,
                              expiresAt: 1,
                              backgroundColor: 1,
                              fontStyle: 1,
                              textAlign: 1,
                              metrics: 1
                        }
                  }
            ]);

            const groupedStories = stories.reduce((accumulator, story) => {
                  const creatorId = story.creator._id.toString();
                  if (!accumulator[creatorId]) {
                        accumulator[creatorId] = {
                              creator: story.creator,
                              stories: [],
                              isFollowing: false
                        };
                  }

                  accumulator[creatorId].stories.push(story);
                  return accumulator;
            }, {});

            if (viewerObjectId && Array.isArray(req.user?.following)) {
                  const followingIds = new Set((req.user.following || []).map((entry) => entry.toString()));
                  Object.values(groupedStories).forEach((group) => {
                        group.isFollowing = followingIds.has(group.creator._id.toString());
                  });
            }

            const groupedStoryList = Object.values(groupedStories).sort((left, right) => {
                  const leftLatest = left.stories[left.stories.length - 1]?.createdAt || 0;
                  const rightLatest = right.stories[right.stories.length - 1]?.createdAt || 0;
                  return new Date(rightLatest) - new Date(leftLatest);
            });

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            return res.json({
                  success: true,
                  data: groupedStoryList
            });
      } catch (error) {
            return next(error);
      }
};

module.exports = {
      getFeed,
      getFeedByTopic,
      getCreatorFeed,
      searchContent,
      getActiveStories
};
