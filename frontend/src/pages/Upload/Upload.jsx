import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const CONTENT_TYPES = [
      { id: 'photo', label: '🖼️ Photo', desc: 'Share ideas through images' },
      { id: 'post', label: '📝 Post', desc: 'Write thoughts, notes, tips' },
      { id: 'short-video', label: '🎥 Short Video', desc: '15-90 second clips' },
      { id: 'long-video', label: '🎬 Long Video', desc: 'Tutorials, explanations' },
      { id: 'story', label: '📖 Story', desc: 'Expires after 24 hours' }
];

const PURPOSES = [
      { id: 'idea', label: '💡 Idea' },
      { id: 'skill', label: '🛠️ Skill' },
      { id: 'explain', label: '📖 Explain' },
      { id: 'story', label: '📝 Story' },
      { id: 'question', label: '❓ Question' },
      { id: 'learning', label: '📚 Learning' },
      { id: 'inspiration', label: '✨ Inspiration' },
      { id: 'solution', label: '✅ Solution' }
];

const TOPICS = [
      'learning', 'technology', 'creativity', 'health',
      'business', 'science', 'arts', 'lifestyle',
      'problem-solving', 'mentoring'
];

const Upload = () => {
      const { token, isAuthenticated } = useAuth();
      const navigate = useNavigate();

      const [step, setStep] = useState(1);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');

      const [formData, setFormData] = useState({
            contentType: '',
            title: '',
            body: '',
            purpose: '',
            topics: [],
            visibility: 'public',
            silentMode: false,
            media: null
      });

      if (!isAuthenticated) {
            return (
                  <div className="empty-state animate-fadeIn">
                        <div className="empty-state-icon">🔒</div>
                        <h2 className="text-xl font-semibold mb-md">Login to Upload</h2>
                        <p className="text-muted mb-lg">You need to be logged in to share content.</p>
                        <button onClick={() => navigate('/login')} className="btn btn-primary">
                              Login
                        </button>
                  </div>
            );
      }

      const handleTypeSelect = (type) => {
            setFormData(prev => ({ ...prev, contentType: type }));
            setStep(2);
      };

      const handleFileChange = (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                  setFormData(prev => ({ ...prev, media: files }));
            }
      };

      const handleTopicToggle = (topic) => {
            setFormData(prev => ({
                  ...prev,
                  topics: prev.topics.includes(topic)
                        ? prev.topics.filter(t => t !== topic)
                        : [...prev.topics, topic]
            }));
      };

      const handleSubmit = async () => {
            setLoading(true);
            setError('');

            try {
                  const data = new FormData();
                  data.append('contentType', formData.contentType);
                  data.append('title', formData.title);
                  data.append('body', formData.body);
                  data.append('purpose', formData.purpose);
                  data.append('visibility', formData.visibility);
                  data.append('silentMode', formData.silentMode);

                  formData.topics.forEach(topic => {
                        data.append('topics', topic);
                  });

                  if (formData.media) {
                        Array.from(formData.media).forEach(file => {
                              data.append('media', file);
                        });
                  }

                  const res = await fetch(`${API_URL}/content`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: data
                  });

                  const result = await res.json();

                  if (result.success) {
                        navigate('/');
                  } else {
                        setError(result.message);
                  }
            } catch (err) {
                  setError('Upload failed. Please try again.');
            }
            setLoading(false);
      };

      return (
            <div className="upload-page animate-fadeIn">
                  <h1 className="text-2xl font-bold mb-lg">Share Something Valuable</h1>

                  {/* Step Indicator */}
                  <div className="flex gap-sm mb-xl">
                        {[1, 2, 3].map(s => (
                              <div
                                    key={s}
                                    className={`tag ${step >= s ? 'tag-primary' : ''}`}
                                    style={{ flex: 1, textAlign: 'center' }}
                              >
                                    Step {s}
                              </div>
                        ))}
                  </div>

                  {error && (
                        <div className="card p-md mb-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                              <p style={{ color: '#ef4444' }}>{error}</p>
                        </div>
                  )}

                  {/* Step 1: Select Type */}
                  {step === 1 && (
                        <div className="grid grid-cols-2 gap-md">
                              {CONTENT_TYPES.map(type => (
                                    <button
                                          key={type.id}
                                          className="card text-center"
                                          onClick={() => handleTypeSelect(type.id)}
                                          style={{ cursor: 'pointer' }}
                                    >
                                          <div className="text-3xl mb-sm">{type.label.split(' ')[0]}</div>
                                          <h3 className="font-semibold">{type.label.split(' ').slice(1).join(' ')}</h3>
                                          <p className="text-sm text-muted mt-sm">{type.desc}</p>
                                    </button>
                              ))}
                        </div>
                  )}

                  {/* Step 2: Content Details */}
                  {step === 2 && (
                        <div className="card">
                              <h2 className="text-lg font-semibold mb-lg">
                                    {CONTENT_TYPES.find(t => t.id === formData.contentType)?.label}
                              </h2>

                              {/* File Upload */}
                              {(formData.contentType === 'photo' || formData.contentType.includes('video') || formData.contentType === 'story') && (
                                    <div className="input-group mb-lg">
                                          <label className="input-label">Upload File</label>
                                          <input
                                                type="file"
                                                accept={formData.contentType === 'story' ? 'image/*,video/*' : formData.contentType === 'photo' ? 'image/*' : 'video/*'}
                                                multiple={formData.contentType === 'photo'}
                                                onChange={handleFileChange}
                                                className="input"
                                                style={{ padding: '0.5rem' }}
                                          />
                                          <p className="text-xs text-muted mt-sm">
                                                {formData.contentType === 'photo'
                                                      ? 'Max 10MB per image. JPEG, PNG, or WebP.'
                                                      : 'Max 100MB. MP4 or WebM.'}
                                          </p>
                                    </div>
                              )}

                              {/* Title */}
                              <div className="input-group mb-md">
                                    <label className="input-label">Title {formData.contentType === 'post' ? '(optional)' : ''}</label>
                                    <input
                                          type="text"
                                          className="input"
                                          placeholder="What's this about?"
                                          value={formData.title}
                                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    />
                              </div>

                              {/* Body */}
                              <div className="input-group mb-md">
                                    <label className="input-label">Description / Content</label>
                                    <textarea
                                          className="input"
                                          rows="5"
                                          placeholder="Share your knowledge..."
                                          value={formData.body}
                                          onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                                    ></textarea>
                              </div>

                              <button
                                    onClick={() => setStep(3)}
                                    className="btn btn-primary w-full"
                                    disabled={!formData.body && !formData.media}
                              >
                                    Next: Categorize
                              </button>
                        </div>
                  )}

                  {/* Step 3: Categorize */}
                  {step === 3 && (
                        <div className="card">
                              <h2 className="text-lg font-semibold mb-lg">Final Touches</h2>

                              {/* Purpose */}
                              <div className="mb-lg">
                                    <label className="input-label mb-sm">Purpose</label>
                                    <div className="flex flex-wrap gap-sm">
                                          {PURPOSES.map(p => (
                                                <button
                                                      key={p.id}
                                                      className={`tag ${formData.purpose === p.id ? 'tag-primary' : ''}`}
                                                      onClick={() => setFormData(prev => ({ ...prev, purpose: p.id }))}
                                                >
                                                      {p.label}
                                                </button>
                                          ))}
                                    </div>
                              </div>

                              {/* Topics */}
                              <div className="mb-lg">
                                    <label className="input-label mb-sm">Topics (Pick a few)</label>
                                    <div className="flex flex-wrap gap-sm">
                                          {TOPICS.map(t => (
                                                <button
                                                      key={t}
                                                      className={`tag ${formData.topics.includes(t) ? 'tag-primary' : ''}`}
                                                      onClick={() => handleTopicToggle(t)}
                                                >
                                                      #{t}
                                                </button>
                                          ))}
                                    </div>
                              </div>

                              {/* Visibility */}
                              <div className="mb-xl">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                                type="checkbox"
                                                checked={formData.silentMode}
                                                onChange={(e) => setFormData(prev => ({ ...prev, silentMode: e.target.checked }))}
                                          />
                                          <span>Silent Mode (Don't notify followers)</span>
                                    </label>
                              </div>

                              <div className="flex gap-md">
                                    <button onClick={() => setStep(2)} className="btn btn-secondary flex-1">
                                          Back
                                    </button>
                                    <button
                                          onClick={handleSubmit}
                                          className="btn btn-primary flex-1"
                                          disabled={loading}
                                    >
                                          {loading ? 'Publishing...' : 'Publish ✨'}
                                    </button>
                              </div>
                        </div>
                  )}
            </div>
      );
};

export default Upload;
