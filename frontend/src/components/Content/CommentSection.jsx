import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import { SendIcon, TrashIcon } from '../Icons/ActionIcons';

const CommentSection = ({ contentId, onCountChange }) => {
      const { token, user: currentUser } = useAuth();
      const [comments, setComments] = useState([]);
      const [newComment, setNewComment] = useState('');
      const [loading, setLoading] = useState(true);
      const [submitting, setSubmitting] = useState(false);

      useEffect(() => {
            fetchComments();
      }, [contentId]);

      useEffect(() => {
            onCountChange?.(comments.length);
      }, [comments.length, onCountChange]);

      const fetchComments = async () => {
            setLoading(true);
            try {
                  const res = await fetch(`${API_URL}/comments/${contentId}`);
                  const data = await res.json();
                  if (data.success) {
                        setComments(data.data.comments || []);
                  }
            } catch (error) {
                  console.error('Failed to load comments', error);
            } finally {
                  setLoading(false);
            }
      };

      const handleSubmit = async (e) => {
            e.preventDefault();
            if (!newComment.trim() || !token || submitting) return;

            setSubmitting(true);
            try {
                  const res = await fetch(`${API_URL}/comments/${contentId}`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: newComment.trim() })
                  });

                  const data = await res.json();
                  if (data.success) {
                        setComments((prev) => [data.data.comment, ...prev]);
                        setNewComment('');
                  }
            } catch (error) {
                  console.error('Failed to post comment', error);
            } finally {
                  setSubmitting(false);
            }
      };

      const handleDelete = async (commentId) => {
            if (!token || !window.confirm('Delete this comment?')) return;

            try {
                  const res = await fetch(`${API_URL}/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: {
                              Authorization: `Bearer ${token}`
                        }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setComments((prev) => prev.filter((comment) => comment._id !== commentId));
                  }
            } catch (error) {
                  console.error('Failed to delete comment', error);
            }
      };

      return (
            <section id="comments" className="comment-section card">
                  <div className="comment-section-header">
                        <div>
                              <h3 className="text-xl font-bold">Comments</h3>
                              <p className="text-sm text-secondary">{comments.length} conversation{comments.length === 1 ? '' : 's'}</p>
                        </div>
                  </div>

                  {token ? (
                        <form onSubmit={handleSubmit} className="comment-composer">
                              <div className="avatar avatar-sm">
                                    {currentUser?.avatar ? (
                                          <img src={currentUser.avatar} alt={currentUser.displayName} />
                                    ) : (
                                          currentUser?.displayName?.charAt(0).toUpperCase() || 'U'
                                    )}
                              </div>
                              <div className="comment-composer-field">
                                    <input
                                          type="text"
                                          value={newComment}
                                          onChange={(e) => setNewComment(e.target.value)}
                                          placeholder="Write a thoughtful reply..."
                                          className="comment-input"
                                    />
                                    <button
                                          type="submit"
                                          disabled={!newComment.trim() || submitting}
                                          className="comment-send-btn"
                                    >
                                          <SendIcon size={16} />
                                          <span>{submitting ? 'Sending' : 'Post'}</span>
                                    </button>
                              </div>
                        </form>
                  ) : (
                        <p className="mb-lg text-sm text-secondary">
                              <Link to="/login" className="text-primary">Log in</Link> to join the conversation.
                        </p>
                  )}

                  {loading ? (
                        <div className="comment-empty-state">Loading comments...</div>
                  ) : comments.length === 0 ? (
                        <div className="comment-empty-state">No comments yet. Start the conversation.</div>
                  ) : (
                        <div className="comments-list">
                              {comments.map((comment) => (
                                    <article key={comment._id} className="comment-item">
                                          <Link to={`/u/${comment.user.username}`}>
                                                <div className="avatar avatar-sm">
                                                      {comment.user.avatar ? (
                                                            <img src={comment.user.avatar} alt={comment.user.displayName} />
                                                      ) : (
                                                            comment.user.displayName?.charAt(0).toUpperCase() || 'U'
                                                      )}
                                                </div>
                                          </Link>

                                          <div className="comment-bubble">
                                                <div className="comment-meta">
                                                      <Link to={`/u/${comment.user.username}`} className="font-semibold">
                                                            {comment.user.displayName || comment.user.username}
                                                      </Link>
                                                      <span className="text-xs text-secondary">
                                                            @{comment.user.username}
                                                      </span>
                                                      <span className="text-xs text-secondary">
                                                            {new Date(comment.createdAt).toLocaleString()}
                                                      </span>
                                                </div>
                                                <p className="comment-text">{comment.text}</p>
                                          </div>

                                          {currentUser?._id === comment.user._id ? (
                                                <button
                                                      onClick={() => handleDelete(comment._id)}
                                                      className="comment-delete-btn"
                                                      title="Delete comment"
                                                >
                                                      <TrashIcon size={16} />
                                                </button>
                                          ) : null}
                                    </article>
                              ))}
                        </div>
                  )}
            </section>
      );
};

export default CommentSection;
