import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { API_URL } from '../../config';

const CommentSection = ({ contentId }) => {
      const { token, user: currentUser } = useAuth();
      const [comments, setComments] = useState([]);
      const [newComment, setNewComment] = useState('');
      const [loading, setLoading] = useState(true);

      useEffect(() => {
            fetchComments();
      }, [contentId]);

      const fetchComments = async () => {
            try {
                  const res = await fetch(`${API_URL}/comments/${contentId}`);
                  const data = await res.json();
                  if (data.success) {
                        setComments(data.data.comments);
                  }
            } catch (error) {
                  console.error('Failed to load comments', error);
            } finally {
                  setLoading(false);
            }
      };

      const handleSubmit = async (e) => {
            e.preventDefault();
            if (!newComment.trim() || !token) return;

            try {
                  const res = await fetch(`${API_URL}/comments/${contentId}`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: newComment })
                  });

                  const data = await res.json();
                  if (data.success) {
                        setComments([data.data.comment, ...comments]);
                        setNewComment('');
                  }
            } catch (error) {
                  console.error('Failed to post comment', error);
            }
      };

      const handleDelete = async (commentId) => {
            if (!window.confirm('Delete this comment?')) return;
            try {
                  const res = await fetch(`${API_URL}/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: {
                              'Authorization': `Bearer ${token}`
                        }
                  });
                  if (res.ok) {
                        setComments(comments.filter(c => c._id !== commentId));
                  }
            } catch (error) {
                  console.error('Failed to delete comment', error);
            }
      };

      if (loading) return <div className="p-4 text-center text-gray-500">Loading comments...</div>;

      return (
            <div className="comment-section">
                  <h4 className="mb-md">Comments ({comments.length})</h4>

                  {token ? (
                        <form onSubmit={handleSubmit} className="comment-form mb-lg">
                              <div className="flex gap-sm">
                                    <div className="avatar sm">
                                          {currentUser?.avatar ? (
                                                <img src={currentUser.avatar} alt={currentUser.displayName} />
                                          ) : (
                                                currentUser?.displayName?.charAt(0).toUpperCase() || 'U'
                                          )}
                                    </div>
                                    <div className="flex-1 flex gap-sm">
                                          <input
                                                type="text"
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                placeholder="Add a comment..."
                                                className="comment-input"
                                          />
                                          <button
                                                type="submit"
                                                disabled={!newComment.trim()}
                                                className="btn btn-text text-primary font-bold"
                                          >
                                                Post
                                          </button>
                                    </div>
                              </div>
                        </form>
                  ) : (
                        <p className="mb-lg text-center text-sm text-gray-500">
                              <Link to="/login" className="text-primary">Log in</Link> to comment
                        </p>
                  )}

                  <div className="comments-list">
                        {comments.map(comment => (
                              <div key={comment._id} className="comment-item flex gap-sm mb-md">
                                    <Link to={`/u/${comment.user.username}`}>
                                          <div className="avatar sm">
                                                {comment.user.avatar ? (
                                                      <img src={comment.user.avatar} alt={comment.user.displayName} />
                                                ) : (
                                                      comment.user.displayName?.charAt(0).toUpperCase() || 'U'
                                                )}
                                          </div>
                                    </Link>
                                    <div className="comment-content flex-1">
                                          <div className="flex justify-between items-start">
                                                <div>
                                                      <span className="font-bold mr-xs">
                                                            <Link to={`/u/${comment.user.username}`}>
                                                                  {comment.user.username}
                                                            </Link>
                                                      </span>
                                                      <span className="comment-text">{comment.text}</span>
                                                </div>
                                                {(currentUser?._id === comment.user._id) && (
                                                      <button
                                                            onClick={() => handleDelete(comment._id)}
                                                            className="text-xs text-gray-400 hover:text-red-500 ml-2"
                                                            title="Delete"
                                                      >
                                                            ✕
                                                      </button>
                                                )}
                                          </div>
                                          <div className="text-xs text-gray-400 mt-xs">
                                                {new Date(comment.createdAt).toLocaleDateString()}
                                          </div>
                                    </div>
                              </div>
                        ))}
                  </div>
            </div>
      );
};

export default CommentSection;
