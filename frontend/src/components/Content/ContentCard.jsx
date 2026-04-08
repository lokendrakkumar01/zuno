import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL, API_BASE_URL } from '../../config';

const ContentCard = ({ content }) => {
      const { user: currentUser, token } = useAuth();
      const [isHelpful, setIsHelpful] = useState(false);
      const [helpfulCount, setHelpfulCount] = useState(content.metrics?.helpfulCount || 0);
      const [isSaved, setIsSaved] = useState(false);
      
      const isVideo = content.contentType === 'short-video' || content.contentType === 'long-video';
      const mediaUrl = content.media?.[0]?.url 
            ? (content.media[0].url.startsWith('http') ? content.media[0].url : `${API_BASE_URL}${content.media[0].url}`)
            : '';

      const handleHelpful = async (e) => {
            e.stopPropagation();
            if (!token) return;

            try {
                  const res = await fetch(`${API_URL}/content/${content._id}/helpful`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok) {
                        setIsHelpful(!isHelpful);
                        setHelpfulCount(prev => isHelpful ? prev - 1 : prev + 1);
                  }
            } catch (error) {
                  console.error('Failed to like:', error);
            }
      };

      const handleSave = async (e) => {
            e.stopPropagation();
            if (!token) return;
            try {
                  const res = await fetch(`${API_URL}/content/${content._id}/save`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok) {
                        setIsSaved(!isSaved);
                  }
            } catch (error) {
                  console.error('Failed to save content:', error);
            }
      };

      return (
            <div className="content-card">
                  <div className="content-card-header">
                        <div className="flex items-center gap-sm">
                              <Link to={`/u/${content.creator?.username}`} onClick={e => e.stopPropagation()}>
                                    <div className="avatar avatar-sm">
                                          {content.creator?.avatar ? (
                                                <img src={content.creator.avatar} alt={content.creator.username} />
                                          ) : (
                                                content.creator?.username?.charAt(0).toUpperCase()
                                          )}
                                    </div>
                              </Link>
                              <div>
                                    <Link to={`/u/${content.creator?.username}`} className="font-semibold text-sm hover:underline" onClick={e => e.stopPropagation()}>
                                          {content.creator?.displayName || content.creator?.username}
                                    </Link>
                                    <div className="text-xs text-secondary">
                                          {new Date(content.createdAt).toLocaleDateString()}
                                    </div>
                              </div>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-tertiary" style={{ background: 'var(--color-bg-tertiary)' }}>
                              {content.contentType}
                        </div>
                  </div>

                  <Link to={`/content/${content._id}`} className="content-card-media-link">
                        <div className="content-card-media">
                              {isVideo ? (
                                    <video src={mediaUrl} muted playsInline loop />
                              ) : (
                                    <img src={mediaUrl || 'https://via.placeholder.com/400'} alt={content.title} loading="lazy" />
                              )}
                              {content.purpose && (
                                    <div style={{
                                          position: 'absolute',
                                          top: '10px',
                                          left: '10px',
                                          background: 'rgba(0,0,0,0.5)',
                                          color: 'white',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          backdropFilter: 'blur(4px)'
                                    }}>
                                          {content.purpose}
                                    </div>
                              )}
                        </div>
                  </Link>

                  <div className="content-card-body">
                        <h3 className="font-bold mb-xs line-clamp-1">{content.title}</h3>
                        <p className="text-sm text-secondary line-clamp-2">{content.body}</p>
                  </div>

                  <div className="content-card-footer">
                        <button 
                              className={`interaction-btn ${isHelpful ? 'active helpful' : ''}`}
                              onClick={handleHelpful}
                        >
                              {isHelpful ? '❤️' : '🤍'} {helpfulCount}
                        </button>
                        <button className="interaction-btn">
                              💬 {content.metrics?.commentCount || 0}
                        </button>
                        <button 
                              className={`interaction-btn ${isSaved ? 'active' : ''}`}
                              onClick={handleSave}
                        >
                              {isSaved ? '🔖' : '📑'}
                        </button>
                  </div>
            </div>
      );
};

export default ContentCard;
