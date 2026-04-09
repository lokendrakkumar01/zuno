import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL, API_BASE_URL } from '../../config';
import {
      BookmarkIcon,
      CheckIcon,
      CommentIcon,
      HeartIcon,
      ShareIcon
} from '../Icons/ActionIcons';
import { shareContentLink } from '../../utils/shareContent';

const buildMediaUrl = (url) =>
      url ? (url.startsWith('http') ? url : `${API_BASE_URL}${url}`) : '';

const normalizeContentState = (content) => ({
      ...content,
      metrics: {
            helpfulCount: 0,
            commentCount: 0,
            saveCount: 0,
            shareCount: 0,
            ...(content.metrics || {})
      },
      viewerState: {
            isHelpful: false,
            isSaved: false,
            ...(content.viewerState || {})
      }
});

const ContentCard = ({ content, onSaveChange }) => {
      const { token } = useAuth();
      const [contentState, setContentState] = useState(() => normalizeContentState(content));
      const [statusMessage, setStatusMessage] = useState('');

      useEffect(() => {
            setContentState(normalizeContentState(content));
      }, [content]);

      const isVideo = useMemo(
            () => ['short-video', 'long-video'].includes(contentState.contentType),
            [contentState.contentType]
      );

      const mediaUrl = buildMediaUrl(contentState.media?.[0]?.url);
      const isHelpful = contentState.viewerState?.isHelpful;
      const isSaved = contentState.viewerState?.isSaved;

      const updateContentState = (updater) => {
            setContentState((prev) => normalizeContentState(
                  typeof updater === 'function' ? updater(prev) : updater
            ));
      };

      const handleHelpful = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!token) return;

            try {
                  const res = await fetch(`${API_URL}/content/${contentState._id}/helpful`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (!data.success) return;

                  updateContentState((prev) => ({
                        ...prev,
                        viewerState: {
                              ...prev.viewerState,
                              isHelpful: data.data?.isHelpful ?? !prev.viewerState.isHelpful
                        },
                        metrics: {
                              ...prev.metrics,
                              helpfulCount: data.data?.helpfulCount ?? prev.metrics.helpfulCount
                        }
                  }));
            } catch (error) {
                  console.error('Failed to mark helpful:', error);
            }
      };

      const handleSave = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!token) return;

            try {
                  const res = await fetch(`${API_URL}/content/${contentState._id}/save`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (!data.success) return;

                  const nextSaved = data.data?.isSaved ?? !contentState.viewerState.isSaved;
                  const nextSaveCount = data.data?.saveCount ?? contentState.metrics.saveCount;

                  updateContentState((prev) => ({
                        ...prev,
                        viewerState: {
                              ...prev.viewerState,
                              isSaved: nextSaved
                        },
                        metrics: {
                              ...prev.metrics,
                              saveCount: nextSaveCount
                        }
                  }));

                  onSaveChange?.(contentState._id, nextSaved);
            } catch (error) {
                  console.error('Failed to save content:', error);
            }
      };

      const handleShare = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
                  const result = await shareContentLink({
                        contentId: contentState._id,
                        title: contentState.title || contentState.body,
                        token
                  });

                  if (!result.success) return;

                  if (result.shareCount !== null) {
                        updateContentState((prev) => ({
                              ...prev,
                              metrics: {
                                    ...prev.metrics,
                                    shareCount: result.shareCount
                              }
                        }));
                  }

                  setStatusMessage(result.message);
                  window.setTimeout(() => setStatusMessage(''), 2200);
            } catch (error) {
                  console.error('Failed to share content:', error);
            }
      };

      return (
            <article className="content-card standard-card">
                  <div className="content-card-header">
                        <div className="flex items-center gap-sm">
                              <Link to={`/u/${contentState.creator?.username}`} onClick={(e) => e.stopPropagation()}>
                                    <div className="avatar avatar-sm">
                                          {contentState.creator?.avatar ? (
                                                <img src={contentState.creator.avatar} alt={contentState.creator.username} />
                                          ) : (
                                                contentState.creator?.username?.charAt(0).toUpperCase()
                                          )}
                                    </div>
                              </Link>
                              <div className="content-card-creator">
                                    <Link
                                          to={`/u/${contentState.creator?.username}`}
                                          className="content-card-creator-name"
                                          onClick={(e) => e.stopPropagation()}
                                    >
                                          {contentState.creator?.displayName || contentState.creator?.username}
                                    </Link>
                                    <div className="text-xs text-secondary">
                                          {new Date(contentState.createdAt).toLocaleDateString()}
                                    </div>
                              </div>
                        </div>
                        <div className="tag">{contentState.contentType}</div>
                  </div>

                  <Link to={`/content/${contentState._id}`} className="content-card-media-link">
                        <div className="content-card-media">
                              {isVideo ? (
                                    <video src={mediaUrl} muted playsInline loop preload="metadata" />
                              ) : (
                                    <img src={mediaUrl || 'https://via.placeholder.com/400'} alt={contentState.title || 'ZUNO content'} loading="lazy" />
                              )}
                              {contentState.purpose ? (
                                    <div className="content-card-purpose-chip">{contentState.purpose}</div>
                              ) : null}
                        </div>
                  </Link>

                  <div className="content-card-body">
                        <h3 className="content-card-title">
                              <Link to={`/content/${contentState._id}`}>{contentState.title || 'Untitled post'}</Link>
                        </h3>
                        <p className="content-card-text line-clamp-2">{contentState.body || 'Open this post to view the full content.'}</p>
                  </div>

                  <div className="content-card-footer">
                        <div className="content-action-row">
                              <button
                                    className={`interaction-btn ${isHelpful ? 'active helpful' : ''}`}
                                    onClick={handleHelpful}
                                    aria-label="Mark as helpful"
                              >
                                    <HeartIcon filled={isHelpful} size={18} />
                                    <span>{contentState.metrics.helpfulCount || 0}</span>
                              </button>

                              <Link
                                    to={`/content/${contentState._id}#comments`}
                                    className="interaction-btn interaction-link"
                                    aria-label="View comments"
                              >
                                    <CommentIcon size={18} />
                                    <span>{contentState.metrics.commentCount || 0}</span>
                              </Link>

                              <button
                                    className={`interaction-btn ${isSaved ? 'active' : ''}`}
                                    onClick={handleSave}
                                    aria-label={isSaved ? 'Remove from saved' : 'Save content'}
                              >
                                    <BookmarkIcon filled={isSaved} size={18} />
                                    <span>{contentState.metrics.saveCount || 0}</span>
                              </button>

                              <button
                                    className="interaction-btn"
                                    onClick={handleShare}
                                    aria-label="Share content"
                              >
                                    <ShareIcon size={18} />
                                    <span>{contentState.metrics.shareCount || 0}</span>
                              </button>
                        </div>

                        {statusMessage ? (
                              <div className="content-inline-status">
                                    <CheckIcon size={14} />
                                    <span>{statusMessage}</span>
                              </div>
                        ) : null}
                  </div>
            </article>
      );
};

export default ContentCard;
