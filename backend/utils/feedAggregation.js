const mongoose = require('mongoose');

const CONTENT_EXCLUDED_TYPES = ['story', 'status', 'text-status'];
const DEFAULT_FEED_LIMIT = 12;
const DEFAULT_PROFILE_LIMIT = 24;
const MAX_FEED_LIMIT = 30;
const MAX_PROFILE_LIMIT = 60;
const MAX_COMMENT_PREVIEW = 2;

const toObjectId = (value) => {
      if (!value) return null;
      if (value instanceof mongoose.Types.ObjectId) return value;
      return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const toPositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
      }
      return Math.min(parsed, max);
};

const encodeCursor = (value) => {
      if (!value?._id || !value?.createdAt) return null;
      return Buffer.from(
            JSON.stringify({
                  id: value._id.toString(),
                  createdAt: new Date(value.createdAt).toISOString()
            })
      ).toString('base64url');
};

const decodeCursor = (value) => {
      if (!value) return null;

      try {
            const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
            const id = toObjectId(parsed?.id);
            const createdAt = parsed?.createdAt ? new Date(parsed.createdAt) : null;

            if (!id || Number.isNaN(createdAt?.getTime?.())) {
                  return null;
            }

            return { _id: id, createdAt };
      } catch {
            return null;
      }
};

const buildCursorMatch = (cursor) => {
      if (!cursor?._id || !cursor?.createdAt) return null;

      return {
            $or: [
                  { createdAt: { $lt: cursor.createdAt } },
                  {
                        createdAt: cursor.createdAt,
                        _id: { $lt: cursor._id }
                  }
            ]
      };
};

const buildFeedModeMatch = (mode = 'all') => {
      switch (mode) {
            case 'learning':
                  return {
                        contentType: { $nin: CONTENT_EXCLUDED_TYPES },
                        purpose: { $in: ['skill', 'explain', 'learning', 'solution'] }
                  };
            case 'calm':
                  return {
                        contentType: { $nin: CONTENT_EXCLUDED_TYPES },
                        purpose: { $in: ['inspiration', 'story', 'idea'] }
                  };
            case 'video':
                  return {
                        contentType: { $in: ['short-video', 'long-video'] }
                  };
            case 'reading':
                  return {
                        contentType: 'post'
                  };
            case 'problem-solving':
                  return {
                        contentType: { $nin: CONTENT_EXCLUDED_TYPES },
                        purpose: { $in: ['question', 'discussion', 'solution'] }
                  };
            case 'all':
            default:
                  return {
                        contentType: { $nin: CONTENT_EXCLUDED_TYPES }
                  };
      }
};

const buildCreatorProjectionStage = (creatorField = '$creatorDoc') => ({
      _id: `${creatorField}._id`,
      id: `${creatorField}._id`,
      username: `${creatorField}.username`,
      displayName: { $ifNull: [`${creatorField}.displayName`, `${creatorField}.username`] },
      avatar: { $ifNull: [`${creatorField}.avatar`, ''] },
      bio: { $ifNull: [`${creatorField}.bio`, ''] },
      role: `${creatorField}.role`,
      interests: { $ifNull: [`${creatorField}.interests`, []] },
      isVerified: { $toBool: `${creatorField}.isVerified` },
      verificationRequest: {
            $cond: [
                  { $gt: [{ $type: `${creatorField}.verificationRequest` }, 'missing'] },
                  {
                        status: `${creatorField}.verificationRequest.status`,
                        requestedAt: `${creatorField}.verificationRequest.requestedAt`
                  },
                  null
            ]
      },
      followersCount: { $size: { $ifNull: [`${creatorField}.followers`, []] } },
      followingCount: { $size: { $ifNull: [`${creatorField}.following`, []] } },
      profileSong: { $ifNull: [`${creatorField}.profileSong`, null] },
      stats: { $ifNull: [`${creatorField}.stats`, {}] },
      createdAt: `${creatorField}.createdAt`
});

const buildUserProfileProjection = ({
      includePrivate = false,
      viewerFollowingIds = []
} = {}) => {
      const followingLiteral = Array.isArray(viewerFollowingIds)
            ? viewerFollowingIds.map((value) => toObjectId(value)).filter(Boolean)
            : [];

      return {
            _id: '$_id',
            id: '$_id',
            username: '$username',
            displayName: { $ifNull: ['$displayName', '$username'] },
            avatar: { $ifNull: ['$avatar', ''] },
            bio: { $ifNull: ['$bio', ''] },
            role: '$role',
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
            createdAt: '$createdAt',
            isFollowing: {
                  $in: ['$_id', followingLiteral]
            },
            ...(includePrivate
                  ? {
                          email: '$email',
                          preferredFeedMode: '$preferredFeedMode',
                          focusModeEnabled: { $toBool: '$focusModeEnabled' },
                          dailyUsageLimit: { $ifNull: ['$dailyUsageLimit', 0] },
                          language: '$language',
                          following: { $ifNull: ['$following', []] },
                          notificationSettings: { $ifNull: ['$notificationSettings', {}] },
                          blockedUsers: { $ifNull: ['$blockedUsers', []] },
                          preferredContentTypes: { $ifNull: ['$preferredContentTypes', []] },
                          isPrivate: { $toBool: '$isPrivate' },
                          profileVisibility: '$profileVisibility'
                  }
                  : {})
      };
};

const buildUserPreviewLookup = (idField) => ({
      $lookup: {
            from: 'users',
            let: { relatedUserId: idField },
            pipeline: [
                  {
                        $match: {
                              $expr: { $eq: ['$_id', '$$relatedUserId'] }
                        }
                  },
                  {
                        $project: {
                              _id: 1,
                              id: '$_id',
                              username: 1,
                              displayName: { $ifNull: ['$displayName', '$username'] },
                              avatar: { $ifNull: ['$avatar', ''] },
                              bio: { $ifNull: ['$bio', ''] },
                              isVerified: { $toBool: '$isVerified' }
                        }
                  }
            ],
            as: 'relatedUser'
      }
});

const buildContentProjection = () => ({
      _id: '$_id',
      creator: buildCreatorProjectionStage(),
      contentType: '$contentType',
      title: { $ifNull: ['$title', ''] },
      body: { $ifNull: ['$body', ''] },
      media: { $ifNull: ['$media', []] },
      purpose: { $ifNull: ['$purpose', null] },
      topics: { $ifNull: ['$topics', []] },
      qualityScore: { $ifNull: ['$qualityScore', 0] },
      createdAt: '$createdAt',
      updatedAt: '$updatedAt',
      expiresAt: '$expiresAt',
      silentMode: { $toBool: '$silentMode' },
      metrics: {
            helpfulCount: { $ifNull: ['$metrics.helpfulCount', 0] },
            notUsefulCount: { $ifNull: ['$metrics.notUsefulCount', 0] },
            viewCount: { $ifNull: ['$metrics.viewCount', 0] },
            saveCount: { $ifNull: ['$metrics.saveCount', 0] },
            shareCount: { $ifNull: ['$metrics.shareCount', 0] },
            commentCount: {
                  $max: [
                        { $ifNull: ['$metrics.commentCount', 0] },
                        { $ifNull: [{ $arrayElemAt: ['$commentBundle.total', 0] }, 0] }
                  ]
            }
      },
      music: { $ifNull: ['$music', null] },
      backgroundColor: { $ifNull: ['$backgroundColor', null] },
      fontStyle: { $ifNull: ['$fontStyle', 'bold'] },
      textAlign: { $ifNull: ['$textAlign', 'center'] },
      liveData: { $ifNull: ['$liveData', {}] },
      commentsPreview: { $ifNull: [{ $arrayElemAt: ['$commentBundle.preview', 0] }, []] },
      viewerState: {
            isHelpful: { $in: ['helpful', { $ifNull: [{ $arrayElemAt: ['$viewerInteraction.types', 0] }, []] }] },
            isSaved: { $in: ['save', { $ifNull: [{ $arrayElemAt: ['$viewerInteraction.types', 0] }, []] }] }
      }
});

const buildContentEnrichmentStages = ({ viewerId, creatorLookupMatch = [] } = {}) => {
      const viewerObjectId = toObjectId(viewerId);

      return [
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
                              ...creatorLookupMatch,
                              {
                                    $project: {
                                          _id: 1,
                                          username: 1,
                                          displayName: 1,
                                          avatar: 1,
                                          bio: 1,
                                          role: 1,
                                          interests: 1,
                                          isVerified: 1,
                                          verificationRequest: 1,
                                          followers: 1,
                                          following: 1,
                                          profileSong: 1,
                                          stats: 1,
                                          createdAt: 1
                                    }
                              }
                        ],
                        as: 'creatorDoc'
                  }
            },
            {
                  $unwind: '$creatorDoc'
            },
            {
                  $lookup: {
                        from: 'comments',
                        let: { contentId: '$_id' },
                        pipeline: [
                              {
                                    $match: {
                                          $expr: { $eq: ['$content', '$$contentId'] }
                                    }
                              },
                              { $sort: { createdAt: -1 } },
                              {
                                    $facet: {
                                          total: [{ $count: 'count' }],
                                          preview: [
                                                { $limit: MAX_COMMENT_PREVIEW },
                                                {
                                                      $lookup: {
                                                            from: 'users',
                                                            let: { commentUserId: '$user' },
                                                            pipeline: [
                                                                  {
                                                                        $match: {
                                                                              $expr: { $eq: ['$_id', '$$commentUserId'] }
                                                                        }
                                                                  },
                                                                  {
                                                                        $project: {
                                                                              _id: 1,
                                                                              id: '$_id',
                                                                              username: 1,
                                                                              displayName: { $ifNull: ['$displayName', '$username'] },
                                                                              avatar: { $ifNull: ['$avatar', ''] }
                                                                        }
                                                                  }
                                                            ],
                                                            as: 'userDoc'
                                                      }
                                                },
                                                {
                                                      $project: {
                                                            _id: 1,
                                                            text: 1,
                                                            createdAt: 1,
                                                            user: { $ifNull: [{ $arrayElemAt: ['$userDoc', 0] }, null] }
                                                      }
                                                }
                                          ]
                                    }
                              },
                              {
                                    $project: {
                                          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
                                          preview: '$preview'
                                    }
                              }
                        ],
                        as: 'commentBundle'
                  }
            },
            {
                  $lookup: viewerObjectId
                        ? {
                                from: 'interactions',
                                let: { contentId: '$_id' },
                                pipeline: [
                                      {
                                            $match: {
                                                  $expr: {
                                                        $and: [
                                                              { $eq: ['$content', '$$contentId'] },
                                                              { $eq: ['$user', viewerObjectId] },
                                                              { $in: ['$type', ['helpful', 'save']] }
                                                        ]
                                                  }
                                            }
                                      },
                                      {
                                            $group: {
                                                  _id: null,
                                                  types: { $addToSet: '$type' }
                                            }
                                      }
                                ],
                                as: 'viewerInteraction'
                        }
                        : {
                                from: 'interactions',
                                pipeline: [{ $limit: 0 }],
                                as: 'viewerInteraction'
                        }
            },
            {
                  $project: buildContentProjection()
            }
      ];
};

const unpackCursorPage = (items = [], limit = DEFAULT_FEED_LIMIT) => {
      const safeItems = Array.isArray(items) ? items : [];
      const hasMore = safeItems.length > limit;
      const pageItems = hasMore ? safeItems.slice(0, limit) : safeItems;
      const nextCursor = hasMore ? encodeCursor(pageItems[pageItems.length - 1]) : null;

      return {
            items: pageItems,
            hasMore,
            nextCursor
      };
};

module.exports = {
      CONTENT_EXCLUDED_TYPES,
      DEFAULT_FEED_LIMIT,
      DEFAULT_PROFILE_LIMIT,
      MAX_FEED_LIMIT,
      MAX_PROFILE_LIMIT,
      buildContentEnrichmentStages,
      buildCursorMatch,
      buildFeedModeMatch,
      buildUserPreviewLookup,
      buildUserProfileProjection,
      decodeCursor,
      encodeCursor,
      toObjectId,
      toPositiveInt,
      unpackCursorPage
};
