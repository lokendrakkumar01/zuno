import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import SpotifySearch from '../../components/Music/SpotifySearch';

const CONTENT_TYPES = [
      { id: 'photo', label: '🖼️ Photo', desc: 'Share ideas through images' },
      { id: 'post', label: '📝 Post', desc: 'Write thoughts, notes, tips' },
      { id: 'short-video', label: '🎥 Short Video', desc: '15-90 second clips' },
      { id: 'long-video', label: '🎬 Long Video', desc: 'Tutorials, explanations' },
      { id: 'story', label: '📖 Story', desc: 'Image or video story' },
      { id: 'text-status', label: '✍️ Text Status', desc: 'WhatsApp-style text update' }
];

// Rich gradient themes for text status
const STATUS_THEMES = [
      { id: 'violet', bg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', label: '💜 Violet' },
      { id: 'rose',   bg: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)', label: '🌸 Rose' },
      { id: 'ocean',  bg: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', label: '🌊 Ocean' },
      { id: 'sunset', bg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', label: '🌅 Sunset' },
      { id: 'forest', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', label: '🌿 Forest' },
      { id: 'aurora', bg: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)', label: '✨ Aurora' },
      { id: 'fire',   bg: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)', label: '🔥 Fire' },
      { id: 'night',  bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', label: '🌙 Night' },
      { id: 'candy',  bg: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)', label: '🍭 Candy' },
      { id: 'gold',   bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', label: '✨ Gold' },
];

const STATUS_FONTS = [
      { id: 'bold',    label: 'Bold',    style: { fontWeight: '800', fontStyle: 'normal', fontFamily: 'inherit' } },
      { id: 'italic',  label: 'Italic',  style: { fontWeight: '600', fontStyle: 'italic', fontFamily: 'Georgia, serif' } },
      { id: 'mono',    label: 'Mono',    style: { fontWeight: '700', fontStyle: 'normal', fontFamily: 'monospace' } },
      { id: 'thin',    label: 'Light',   style: { fontWeight: '300', fontStyle: 'normal', letterSpacing: '3px', textTransform: 'uppercase' } },
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
      const [searchParams] = useSearchParams();

      const [step, setStep] = useState(1);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');

      const [formData, setFormData] = useState({
            contentType: searchParams.get('type') || '',
            title: '',
            body: '',
            purpose: '',
            topics: [],
            visibility: 'public',
            silentMode: false,
            media: null,
            mediaPreview: null, // For real-time previews
            music: null,
            backgroundColor: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            fontStyle: 'bold',
            textAlign: 'center'
      });

      useEffect(() => {
            const initialType = searchParams.get('type');
            if (initialType) {
                  setStep(2);
            }
      }, [searchParams]);

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
            setFormData(prev => ({
                  ...prev,
                  contentType: type,
                  // Auto-set purpose for story/text-status so backend validation passes
                  purpose: (type === 'story' || type === 'text-status') ? 'story' : prev.purpose
            }));
            setStep(2);
      };

      const handleFileChange = (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                  // Cleanup old previews to prevent memory leaks
                  if (formData.mediaPreview) {
                        if (Array.isArray(formData.mediaPreview)) {
                              formData.mediaPreview.forEach(url => URL.revokeObjectURL(url));
                        } else {
                              URL.revokeObjectURL(formData.mediaPreview);
                        }
                  }

                  const previews = files.map(file => URL.createObjectURL(file));

                  setFormData(prev => ({
                        ...prev,
                        media: files,
                        mediaPreview: formData.contentType === 'photo' ? previews : previews[0]
                  }));
            }
      };

      // Final cleanup on unmount
      useEffect(() => {
            return () => {
                  if (formData.mediaPreview) {
                        if (Array.isArray(formData.mediaPreview)) {
                              formData.mediaPreview.forEach(url => URL.revokeObjectURL(url));
                        } else {
                              URL.revokeObjectURL(formData.mediaPreview);
                        }
                  }
            };
      }, []);

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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            try {
                  const data = new FormData();
                  data.append('contentType', formData.contentType);
                  data.append('title', formData.title);
                  data.append('body', formData.body);
                  data.append('purpose', formData.purpose);
                  data.append('visibility', formData.visibility);
                  data.append('silentMode', formData.silentMode);

                  if (formData.backgroundColor) {
                        data.append('backgroundColor', formData.backgroundColor);
                  }
                  if (formData.contentType === 'text-status') {
                        if (formData.fontStyle) data.append('fontStyle', formData.fontStyle);
                        if (formData.textAlign) data.append('textAlign', formData.textAlign);
                  }

                  formData.topics.forEach(topic => {
                        data.append('topics', topic);
                  });

                  if (formData.media) {
                        Array.from(formData.media).forEach(file => {
                              data.append('media', file);
                        });
                  }

                  if (formData.music) {
                        data.append('music', JSON.stringify(formData.music));
                  }

                  const res = await fetch(`${API_URL}/content`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: data,
                        signal: controller.signal
                  });

                  clearTimeout(timeoutId);
                  const result = await res.json();

                  if (result.success) {
                        const FEED_MODES_TO_CLEAR = ['all', 'learning', 'calm', 'video', 'reading', 'problem-solving'];
                        try {
                              FEED_MODES_TO_CLEAR.forEach(mode => {
                                    localStorage.removeItem(`zuno_feedCache_${mode}`);
                              });
                        } catch (e) { }
                        navigate('/');
                  } else {
                        const rawMsg = result.message || result.error || '';
                        const isCloudinaryError = rawMsg.toLowerCase().includes('api_key') ||
                              rawMsg.toLowerCase().includes('cloudinary') ||
                              rawMsg.toLowerCase().includes('invalid');
                        if (isCloudinaryError) {
                              setError('Media upload service is currently unavailable. Please try uploading without a file.');
                        } else {
                              setError(rawMsg || 'Upload failed. Please try again.');
                        }
                  }
            } catch (err) {
                  clearTimeout(timeoutId);
                  if (err.name === 'AbortError') {
                        setError('Upload timed out. File too large or slow connection.');
                  } else {
                        setError('Upload failed. Check your connection.');
                  }
            }
            setLoading(false);
      };

      return (
            <div className="upload-page container animate-fadeIn" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '120px' }}>
                  <style>
                        {`
                              .upload-card {
                                    background: rgba(255, 255, 255, 0.7);
                                    backdrop-filter: blur(20px);
                                    border: 1px solid rgba(0, 0, 0, 0.05);
                                    border-radius: 24px;
                                    padding: 32px;
                                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
                                    animation: slideUp 0.5s ease-out;
                              }
                              @keyframes slideUp {
                                    from { opacity: 0; transform: translateY(20px); }
                                    to { opacity: 1; transform: translateY(0); }
                              }
                              .step-node {
                                    width: 40px;
                                    height: 40px;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-weight: bold;
                                    z-index: 2;
                                    transition: all 0.3s ease;
                              }
                              .step-line {
                                    position: absolute;
                                    top: 20px;
                                    left: 0;
                                    right: 0;
                                    height: 2px;
                                    background: #eee;
                                    z-index: 1;
                              }
                              .step-active-line {
                                    position: absolute;
                                    top: 20px;
                                    left: 0;
                                    height: 2px;
                                    background: var(--gradient-primary);
                                    z-index: 1;
                                    transition: width 0.5s ease;
                              }
                              .type-card {
                                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                              }
                              .type-card:hover {
                                    transform: translateY(-8px) scale(1.02);
                                    background: white !important;
                                    box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important;
                              }
                              .preview-container {
                                    width: 100%;
                                    border-radius: 12px;
                                    overflow: hidden;
                                    margin-bottom: 20px;
                                    background: #f8f9fa;
                                    border: 2px dashed #ddd;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-height: 200px;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    position: relative;
                              }
                              .preview-container:hover {
                                    border-color: var(--color-accent-primary);
                                    background: rgba(99, 102, 241, 0.02);
                              }
                        `}
                  </style>

                  <header style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '20px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: '800', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '12px' }}>
                              Share Something Valuable
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>Let's create something amazing today.</p>
                  </header>

                  {/* Enhanced Progress Tracker */}
                  <div style={{ position: 'relative', maxWidth: '300px', margin: '0 auto 48px', height: '60px' }}>
                        <div className="step-line"></div>
                        <div className="step-active-line" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              {[1, 2, 3].map(s => (
                                    <div key={s} style={{ textAlign: 'center', position: 'relative' }}>
                                          <div className="step-node shadow-sm" style={{
                                                background: step >= s ? 'var(--gradient-primary)' : 'white',
                                                color: step >= s ? 'white' : '#999',
                                                border: step >= s ? 'none' : '2px solid #eee',
                                                boxShadow: step === s ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none',
                                                transform: step === s ? 'scale(1.2)' : 'scale(1)'
                                          }}>
                                                {step > s ? '✓' : s}
                                          </div>
                                          <span style={{
                                                position: 'absolute',
                                                top: '48px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                color: step === s ? 'var(--color-accent-primary)' : '#999',
                                                whiteSpace: 'nowrap'
                                          }}>
                                                {s === 1 ? 'Choose' : s === 2 ? 'Design' : 'Finalize'}
                                          </span>
                                    </div>
                              ))}
                        </div>
                  </div>

                  {error && (
                        <div className="card p-md mb-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                              <p style={{ color: '#ef4444' }}>{error}</p>
                        </div>
                  )}

                  {/* Persistent Music Preview Player */}
                  {formData.music && (
                        <div className="card p-sm mb-lg flex items-center gap-sm bg-primary/5 border-primary/20 sticky top-0 z-10" style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)' }}>
                              <img src={formData.music.albumArt} alt="" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                              <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-xs truncate">{formData.music.name}</div>
                                    <div className="text-[10px] text-muted truncate">{formData.music.artist}</div>
                              </div>
                              {formData.music.previewUrl && (
                                    <div className="flex items-center gap-2">
                                          <audio
                                                src={formData.music.previewUrl}
                                                autoPlay
                                                loop
                                                id="upload-preview-audio"
                                          />
                                          <button
                                                className="btn btn-sm btn-icon bg-white shadow-sm"
                                                onClick={() => {
                                                      const audio = document.getElementById('upload-preview-audio');
                                                      if (audio.paused) audio.play();
                                                      else audio.pause();
                                                }}
                                          >
                                                🎵
                                          </button>
                                    </div>
                              )}
                              <button
                                    onClick={() => setFormData(prev => ({ ...prev, music: null }))}
                                    className="text-muted hover:text-red-500 p-1"
                              >
                                    ✕
                              </button>
                        </div>
                  )}

                  {step === 1 && (
                        <div className="grid grid-cols-2 gap-md" style={{ animation: 'slideUp 0.5s ease-out' }}>
                              {CONTENT_TYPES.map((type, index) => (
                                    <button
                                          key={type.id}
                                          className="card type-card text-center"
                                          onClick={() => handleTypeSelect(type.id)}
                                          style={{
                                                cursor: 'pointer',
                                                padding: '24px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(0,0,0,0.05)',
                                                background: 'white',
                                                animation: `slideUp 0.5s ease-out ${index * 0.1}s both`
                                          }}
                                    >
                                          <div style={{ fontSize: '40px', marginBottom: '12px' }}>{type.label.split(' ')[0]}</div>
                                          <h3 style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--color-text-primary)' }}>{type.label.split(' ').slice(1).join(' ')}</h3>
                                          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>{type.desc}</p>
                                    </button>
                              ))}
                        </div>
                  )}

                  {step === 2 && (
                        <div className="upload-card">
                              <h2 className="text-xl font-bold mb-xl flex items-center gap-2">
                                    <span style={{ fontSize: '24px' }}>{CONTENT_TYPES.find(t => t.id === formData.contentType)?.label.split(' ')[0]}</span>
                                    {CONTENT_TYPES.find(t => t.id === formData.contentType)?.label.split(' ').slice(1).join(' ')}
                              </h2>

                              {/* Music Search Integration */}
                              {formData.contentType && !formData.music && (
                                    <div className="mb-lg">
                                          <SpotifySearch
                                                selectedTrack={formData.music}
                                                onSelect={(track) => setFormData(prev => ({ ...prev, music: track }))}
                                          />
                                    </div>
                              )}

                              {/* Real-time Media Preview */}
                              {(formData.contentType === 'photo' || formData.contentType.includes('video') || formData.contentType === 'story') && (
                                    <div
                                          className="preview-container"
                                          onClick={() => document.getElementById('media-upload-input').click()}
                                    >
                                          {formData.mediaPreview ? (
                                                <div style={{ width: '100%', position: 'relative', padding: '10px' }}>
                                                      {formData.contentType.includes('video') || (formData.contentType === 'story' && formData.media && formData.media[0].type.includes('video')) ? (
                                                            <video src={Array.isArray(formData.mediaPreview) ? formData.mediaPreview[0] : formData.mediaPreview} controls style={{ width: '100%', maxHeight: '400px', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()} />
                                                      ) : (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                                                                  {Array.isArray(formData.mediaPreview) ? (
                                                                        formData.mediaPreview.map((url, idx) => (
                                                                              <img key={idx} src={url} alt={`Preview ${idx}`} style={{ width: formData.mediaPreview.length > 1 ? 'calc(50% - 5px)' : '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                                                                        ))
                                                                  ) : (
                                                                        <img src={formData.mediaPreview} alt="Preview" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }} />
                                                                  )}
                                                            </div>
                                                      )}
                                                      <button
                                                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                                            onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, media: null, mediaPreview: null })); }}
                                                      >✕</button>
                                                </div>
                                          ) : (
                                                <div style={{ textAlign: 'center', color: '#999' }}>
                                                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>📸</div>
                                                      <p className="font-semibold">Click to upload media</p>
                                                      <p style={{ fontSize: '11px', marginTop: '4px' }}>Photos, videos or stories</p>
                                                </div>
                                          )}
                                    </div>
                              )}

                              {/* Text Status Editor — Dynamic & Animated */}
                              {formData.contentType === 'text-status' && (() => {
                                    const activeFont = STATUS_FONTS.find(f => f.id === formData.fontStyle) || STATUS_FONTS[0];
                                    const charCount = formData.body.length;
                                    const charMax = 250;
                                    const fontSize = charCount < 60 ? '32px' : charCount < 120 ? '24px' : charCount < 200 ? '20px' : '16px';
                                    return (
                                          <div style={{ marginBottom: '24px' }}>
                                                <style>{`
                                                      @keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:0.85} }
                                                      @keyframes textPop { from{transform:scale(0.95);opacity:0} to{transform:scale(1);opacity:1} }
                                                      .status-preview-card { animation: statusPulse 4s ease-in-out infinite; }
                                                      .status-preview-card textarea::placeholder { color: rgba(255,255,255,0.45); }
                                                      .theme-btn { transition: transform 0.2s, box-shadow 0.2s; }
                                                      .theme-btn:hover { transform: scale(1.15); }
                                                      .theme-btn.active { transform: scale(1.25); box-shadow: 0 0 0 3px white, 0 0 0 5px rgba(255,255,255,0.4); }
                                                      .font-btn { transition: all 0.2s; border: 2px solid transparent; }
                                                      .font-btn:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.08); }
                                                      .font-btn.active { border-color: #6366f1; background: rgba(99,102,241,0.12); }
                                                `}</style>

                                                {/* Live Preview Card */}
                                                <div
                                                      className="status-preview-card"
                                                      style={{
                                                            background: formData.backgroundColor,
                                                            borderRadius: '20px',
                                                            minHeight: '320px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: '32px 24px 16px',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
                                                            transition: 'background 0.5s ease',
                                                      }}
                                                >
                                                      {/* Ambient Glow Orbs */}
                                                      <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                                                      <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

                                                      {/* Textarea */}
                                                      <textarea
                                                            placeholder="What's on your mind?"
                                                            maxLength={charMax}
                                                            rows={4}
                                                            value={formData.body}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                                                            style={{
                                                                  background: 'transparent',
                                                                  border: 'none',
                                                                  outline: 'none',
                                                                  color: 'white',
                                                                  fontSize,
                                                                  textAlign: formData.textAlign || 'center',
                                                                  width: '100%',
                                                                  resize: 'none',
                                                                  textShadow: '0 2px 12px rgba(0,0,0,0.25)',
                                                                  lineHeight: '1.35',
                                                                  transition: 'font-size 0.3s ease',
                                                                  zIndex: 2,
                                                                  position: 'relative',
                                                                  ...activeFont.style
                                                            }}
                                                      />

                                                      {/* Char counter */}
                                                      <div style={{ alignSelf: 'flex-end', marginTop: '8px', fontSize: '11px', color: charCount > 220 ? '#fca5a5' : 'rgba(255,255,255,0.5)', fontWeight: '600', zIndex: 2 }}>
                                                            {charCount}/{charMax}
                                                      </div>
                                                </div>

                                                {/* Controls Row */}
                                                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                                      {/* Gradient Themes */}
                                                      <div>
                                                            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>🎨 Theme</p>
                                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                                  {STATUS_THEMES.map(theme => (
                                                                        <button
                                                                              key={theme.id}
                                                                              className={`theme-btn ${formData.backgroundColor === theme.bg ? 'active' : ''}`}
                                                                              onClick={() => setFormData(prev => ({ ...prev, backgroundColor: theme.bg }))}
                                                                              style={{
                                                                                    width: '40px',
                                                                                    height: '40px',
                                                                                    borderRadius: '12px',
                                                                                    background: theme.bg,
                                                                                    border: 'none',
                                                                                    cursor: 'pointer',
                                                                              }}
                                                                              title={theme.label}
                                                                        />
                                                                  ))}
                                                            </div>
                                                      </div>

                                                      {/* Font Style + Alignment Row */}
                                                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                                            <div style={{ flex: 1 }}>
                                                                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>✍️ Font</p>
                                                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                        {STATUS_FONTS.map(f => (
                                                                              <button
                                                                                    key={f.id}
                                                                                    className={`font-btn ${formData.fontStyle === f.id ? 'active' : ''}`}
                                                                                    onClick={() => setFormData(prev => ({ ...prev, fontStyle: f.id }))}
                                                                                    style={{
                                                                                          padding: '6px 14px',
                                                                                          borderRadius: '8px',
                                                                                          background: 'var(--color-bg-secondary)',
                                                                                          color: 'var(--color-text-primary)',
                                                                                          cursor: 'pointer',
                                                                                          fontSize: '13px',
                                                                                          ...f.style
                                                                                    }}
                                                                              >{f.label}</button>
                                                                        ))}
                                                                  </div>
                                                            </div>
                                                            <div>
                                                                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>📐 Align</p>
                                                                  <div style={{ display: 'flex', gap: '8px' }}>
                                                                        {[['center','⬛'], ['left','◧'], ['right','◨']].map(([align, icon]) => (
                                                                              <button
                                                                                    key={align}
                                                                                    onClick={() => setFormData(prev => ({ ...prev, textAlign: align }))}
                                                                                    style={{
                                                                                          width: '36px', height: '36px',
                                                                                          borderRadius: '8px',
                                                                                          background: (formData.textAlign || 'center') === align ? '#6366f1' : 'var(--color-bg-secondary)',
                                                                                          color: (formData.textAlign || 'center') === align ? 'white' : 'var(--color-text-primary)',
                                                                                          border: 'none', cursor: 'pointer', fontSize: '14px',
                                                                                          transition: 'all 0.2s'
                                                                                    }}
                                                                              >{icon}</button>
                                                                        ))}
                                                                  </div>
                                                            </div>
                                                      </div>
                                                </div>
                                          </div>
                                    );
                              })()}

                              {(formData.contentType === 'photo' || formData.contentType.includes('video') || formData.contentType === 'story') && (
                                    <div className="input-group mb-lg">
                                          <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Upload File</label>
                                          <div style={{ position: 'relative', overflow: 'hidden' }}>
                                                <button className="btn btn-secondary w-full" style={{ borderRadius: '12px' }}>
                                                      {formData.media ? 'Change File' : 'Choose File'}
                                                </button>
                                                <input
                                                      id="media-upload-input"
                                                      type="file"
                                                      accept={formData.contentType === 'story' ? 'image/*,video/*' : formData.contentType === 'photo' ? 'image/*' : 'video/*'}
                                                      multiple={formData.contentType === 'photo'}
                                                      onChange={handleFileChange}
                                                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                                />
                                          </div>
                                    </div>
                              )}

                              {formData.contentType !== 'text-status' && (
                                    <>
                                          <div className="input-group mb-lg">
                                                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Title {formData.contentType === 'post' ? '(optional)' : ''}</label>
                                                <input
                                                      type="text"
                                                      className="input"
                                                      placeholder="Give it a catchy name..."
                                                      value={formData.title}
                                                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                                      style={{ borderRadius: '12px', background: '#f8f9fa' }}
                                                />
                                          </div>

                                          <div className="input-group mb-xl">
                                                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Description / Content</label>
                                                <textarea
                                                      className="input"
                                                      rows="5"
                                                      placeholder="Write your thoughts here..."
                                                      value={formData.body}
                                                      onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                                                      style={{ borderRadius: '12px', background: '#f8f9fa', resize: 'vertical' }}
                                                ></textarea>
                                          </div>
                                    </>
                              )}

                              <div style={{ display: 'flex', gap: '16px' }}>
                                    <button onClick={() => setStep(1)} className="btn btn-secondary flex-1" style={{ borderRadius: '12px' }}>
                                          Back
                                    </button>
                                    <button
                                          onClick={() => setStep(3)}
                                          className="btn btn-primary flex-[2]"
                                          disabled={
                                                formData.contentType === 'text-status'
                                                      ? !formData.body.trim()
                                                      : (!formData.body && !formData.media)
                                          }
                                          style={{ borderRadius: '12px' }}
                                    >
                                          Next: Finalize
                                    </button>
                              </div>
                        </div>
                  )}

                  {step === 3 && (
                        <div className="upload-card">
                              <h2 className="text-xl font-bold mb-xl">Final Touches</h2>

                              <div className="mb-xl">
                                    <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>What's the purpose? 🎯</label>
                                    <div className="flex flex-wrap gap-2">
                                          {PURPOSES.map(p => (
                                                <button
                                                      key={p.id}
                                                      className={`tag ${formData.purpose === p.id ? 'tag-primary' : ''}`}
                                                      onClick={() => setFormData(prev => ({ ...prev, purpose: p.id }))}
                                                      style={{
                                                            padding: '10px 18px',
                                                            fontSize: '14px',
                                                            borderRadius: '12px',
                                                            background: formData.purpose === p.id ? 'var(--gradient-primary)' : '#f0f0f0',
                                                            color: formData.purpose === p.id ? 'white' : 'inherit',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                      }}
                                                >
                                                      {p.label}
                                                </button>
                                          ))}
                                    </div>
                              </div>

                              <div className="mb-xl">
                                    <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Select Topics 🏷️</label>
                                    <div className="flex flex-wrap gap-2">
                                          {TOPICS.map(t => (
                                                <button
                                                      key={t}
                                                      className={`tag ${formData.topics.includes(t) ? 'tag-primary' : ''}`}
                                                      onClick={() => handleTopicToggle(t)}
                                                      style={{
                                                            padding: '8px 16px',
                                                            fontSize: '13px',
                                                            borderRadius: '99px',
                                                            background: formData.topics.includes(t) ? 'rgba(99, 102, 241, 0.1)' : '#fff',
                                                            color: formData.topics.includes(t) ? 'var(--color-accent-primary)' : '#666',
                                                            border: formData.topics.includes(t) ? '1px solid var(--color-accent-primary)' : '1px solid #eee',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                      }}
                                                >
                                                      #{t}
                                                </button>
                                          ))}
                                    </div>
                              </div>

                              <div className="mb-xl">
                                    <label className="flex items-center gap-3 cursor-pointer p-lg rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                          <input
                                                type="checkbox"
                                                checked={formData.silentMode}
                                                onChange={(e) => setFormData(prev => ({ ...prev, silentMode: e.target.checked }))}
                                                style={{ width: '20px', height: '20px', accentColor: 'var(--color-accent-primary)' }}
                                          />
                                          <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Silent Mode</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>Publish without notifying followers</div>
                                          </div>
                                    </label>
                              </div>

                              <div className="flex gap-md">
                                    <button onClick={() => setStep(2)} className="btn btn-secondary flex-1" style={{ borderRadius: '12px' }}>
                                          Back
                                    </button>
                                    <button
                                          onClick={handleSubmit}
                                          className="btn btn-primary flex-[2]"
                                          disabled={loading}
                                          style={{ borderRadius: '12px', padding: '16px' }}
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
