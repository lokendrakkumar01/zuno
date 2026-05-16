import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import useSocket from '../hooks/useSocket';
import useChat from '../hooks/useChat';
import useCall from '../hooks/useCall';
import MessageList from '../components/MessageList';
import TypingIndicator from '../components/TypingIndicator';
import CallModal from '../components/CallModal';

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
  </svg>
);

const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
);

const AttachIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{opacity: 0.6}}>
    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
  </svg>
);

const EmojiIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{opacity: 0.6}}>
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
  </svg>
);

const THEMES = {
  default: '',
  darkblue: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  sunset: 'linear-gradient(135deg, #4c1d95 0%, #be123c 100%)',
  forest: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)'
};

const Chat = () => {
  const { userId } = useParams();
  const { token, user } = useAuth();
  const [text, setText] = useState('');
  const [theme, setTheme] = useState('default');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { socket, connected, connectionError, emitWithAck } = useSocket(token);
  const chat = useChat({ token, user, receiverId: userId, socket, emitWithAck });
  const call = useCall({ socket, user });

  const currentUserId = user?.id || user?._id;
  const isTyping = chat.typingUsers.has(String(userId));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    const sent = await chat.sendMessage({ text: text.trim() });
    if (sent) setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleDeleteMessage = async (message, type) => {
    if (!window.confirm(`Are you sure you want to delete this message?`)) return;
    try {
      const res = await fetch(`${API_URL}/messages/delete/${message._id}?type=${type}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Optimistic delete
        if (type === 'everyone') {
          chat.setMessages?.(prev => prev.map(m => m._id === message._id ? { ...m, deletedForEveryone: true } : m));
        } else {
          chat.setMessages?.(prev => prev.filter(m => m._id !== message._id));
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleEditMessage = async (message) => {
    const newText = window.prompt("Edit message:", message.text);
    if (newText === null || newText.trim() === '' || newText === message.text) return;
    try {
      const res = await fetch(`${API_URL}/messages/edit/${message._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ text: newText })
      });
      const data = await res.json();
      if (data.success) {
        chat.setMessages?.(prev => prev.map(m => m._id === message._id ? { ...m, text: newText, edited: true } : m));
      }
    } catch (err) {
      console.error('Edit failed:', err);
    }
  };

  return (
    <main className="chat-shell" style={theme !== 'default' ? { background: THEMES[theme] } : {}}>
      {/* Header */}
      <header className="chat-hdr">
        <div className="chat-hdr-left">
          <Link to="/messages" className="chat-back-btn mobile-only" aria-label="Back to messages">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </Link>
          <div className="chat-peer-avatar">
            <div className={`chat-online-ring ${connected ? 'ring-online' : 'ring-offline'}`}></div>
          </div>
          <div>
            <h2 className="chat-peer-name">Chat</h2>
            <div className="chat-conn-status">
              <span className={`conn-dot ${connected ? 'conn-dot-on' : 'conn-dot-off'}`}></span>
              <span className={connected ? 'conn-label-on' : 'conn-label-off'}>
                {connected ? 'Realtime Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
        <div className="chat-hdr-actions">
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value)}
            className="chat-theme-select"
            title="Chat Theme"
          >
            <option value="default">Default Theme</option>
            <option value="darkblue">Dark Blue</option>
            <option value="sunset">Sunset</option>
            <option value="forest">Forest</option>
          </select>
          <button
            className="chat-call-btn audio-call-btn"
            onClick={() => call.startCall(userId, 'audio')}
            title="Audio Call"
          >
            <PhoneIcon />
            <span>Audio</span>
          </button>
          <button
            className="chat-call-btn video-call-btn"
            onClick={() => call.startCall(userId, 'video')}
            title="Video Call"
          >
            <VideoIcon />
            <span>Video</span>
          </button>
        </div>
      </header>

      {/* Alerts */}
      {connectionError && <div className="chat-banner error-banner">{connectionError}</div>}
      {chat.error && <div className="chat-banner error-banner">{chat.error}</div>}

      {/* Messages */}
      <section className="chat-messages">
        {chat.loading ? (
          <div className="chat-loading">
            <div className="chat-loading-dots">
              <span></span><span></span><span></span>
            </div>
            <p>Loading messages...</p>
          </div>
        ) : (
          <MessageList
            messages={chat.messages}
            currentUserId={currentUserId}
            hasMore={chat.hasMore}
            onLoadMore={chat.loadMore}
            height={window.innerHeight - 170}
            onDelete={handleDeleteMessage}
            onEdit={handleEditMessage}
          />
        )}
      </section>

      {/* Typing indicator */}
      {isTyping && (
        <div className="chat-typing-bar">
          <div className="typing-bubble">
            <span></span><span></span><span></span>
          </div>
          <span className="typing-text">Typing...</span>
        </div>
      )}

      {/* Input bar */}
      <div className={`chat-inputbar ${isInputFocused ? 'inputbar-focused' : ''}`}>
        <button className="chat-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
          <AttachIcon />
        </button>
        <button className="chat-icon-btn" title="Emoji">
          <EmojiIcon />
        </button>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,video/*" />
        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); chat.emitTyping(); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            className="chat-textarea"
            placeholder="Type a message... (Enter to send)"
            rows={1}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className={`chat-send-btn ${text.trim() ? 'send-active' : ''}`}
          >
            <SendIcon />
          </button>
        </form>
      </div>

      <CallModal call={call} />

      <style>{`
        .chat-shell {
          display: flex; flex-direction: column;
          height: calc(100vh - 64px);
          background: var(--color-bg-primary);
          overflow: hidden; position: relative;
        }

        /* ─── Header ─── */
        .chat-hdr {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: rgba(var(--color-bg-primary-rgb, 255,255,255), 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--color-border-light);
          box-shadow: 0 1px 12px rgba(0,0,0,0.06);
          z-index: 10; flex-shrink: 0;
        }
        .chat-hdr-left { display: flex; align-items: center; gap: 12px; }
        .chat-peer-avatar {
          width: 42px; height: 42px; border-radius: 50%;
          background: var(--gradient-primary);
          position: relative; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: white;
        }
        .chat-online-ring {
          position: absolute; bottom: 1px; right: 1px;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid var(--color-bg-primary);
        }
        .ring-online {
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34,197,94,0.7);
          animation: pulsering 2s infinite;
        }
        .ring-offline { background: #f59e0b; }
        @keyframes pulsering {
          0%, 100% { box-shadow: 0 0 6px rgba(34,197,94,0.7); }
          50% { box-shadow: 0 0 12px rgba(34,197,94,0.9); }
        }
        .chat-peer-name { margin: 0; font-size: 1.05rem; font-weight: 700; }
        .chat-conn-status { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
        .conn-dot { width: 7px; height: 7px; border-radius: 50%; }
        .conn-dot-on { background: #22c55e; }
        .conn-dot-off { background: #f59e0b; }
        .conn-label-on { font-size: 0.75rem; font-weight: 600; color: #22c55e; }
        .conn-label-off { font-size: 0.75rem; font-weight: 600; color: #f59e0b; }

        /* ─── Call Buttons & Select ─── */
        .chat-hdr-actions { display: flex; gap: 8px; align-items: center; }
        .chat-theme-select {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border-light);
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 0.8rem;
          outline: none;
          cursor: pointer;
        }
        .chat-call-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 24px;
          font-size: 0.82rem; font-weight: 600;
          border: none; cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
        }
        .audio-call-btn {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border-light);
        }
        .audio-call-btn:hover {
          background: var(--color-bg-tertiary);
          transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .video-call-btn {
          background: linear-gradient(135deg, #6366f1, #0095f6);
          color: white;
        }
        .video-call-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(99,102,241,0.4);
        }

        /* ─── Alert Banner ─── */
        .chat-banner {
          padding: 8px 16px; font-size: 0.82rem;
          font-weight: 500; flex-shrink: 0;
        }
        .error-banner {
          background: #fef2f2; color: #991b1b;
          border-bottom: 1px solid #fee2e2;
        }

        /* ─── Messages Area ─── */
        .chat-messages { flex: 1; min-height: 0; overflow: hidden; }

        /* ─── Loading ─── */
        .chat-loading {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; gap: 16px;
          color: var(--color-text-muted);
        }
        .chat-loading-dots { display: flex; gap: 6px; }
        .chat-loading-dots span {
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--color-primary);
          animation: bounce 1.2s infinite ease-in-out;
        }
        .chat-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .chat-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* ─── Typing ─── */
        .chat-typing-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 20px; flex-shrink: 0;
        }
        .typing-bubble {
          display: flex; gap: 4px; align-items: center;
          padding: 8px 12px;
          background: var(--color-bg-secondary);
          border-radius: 16px;
        }
        .typing-bubble span {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--color-text-muted);
          animation: bounce 1.2s infinite ease-in-out;
        }
        .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
        .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }
        .typing-text { font-size: 0.75rem; color: var(--color-text-muted); }

        /* ─── Input Bar ─── */
        .chat-inputbar {
          display: flex; align-items: flex-end; gap: 8px;
          padding: 10px 16px;
          background: var(--color-bg-primary);
          border-top: 1px solid var(--color-border-light);
          transition: box-shadow 0.2s ease;
          flex-shrink: 0;
        }
        .inputbar-focused {
          box-shadow: 0 -4px 20px rgba(99,102,241,0.08);
        }
        .chat-icon-btn {
          background: none; border: none; cursor: pointer;
          padding: 8px; border-radius: 50%; flex-shrink: 0;
          color: var(--color-text-secondary);
          transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .chat-icon-btn:hover {
          background: var(--color-bg-secondary);
          color: var(--color-primary);
        }
        .chat-input-form {
          display: flex; flex: 1; align-items: flex-end;
          background: var(--color-bg-secondary);
          border: 1.5px solid var(--color-border);
          border-radius: 24px;
          padding: 4px 4px 4px 16px;
          transition: all 0.25s ease;
          gap: 4px;
        }
        .chat-input-form:focus-within {
          border-color: var(--color-primary);
          background: var(--color-bg-primary);
          box-shadow: 0 0 0 3px rgba(0,149,246,0.12);
        }
        .chat-textarea {
          flex: 1; border: none; background: transparent;
          outline: none; resize: none;
          font-size: 0.93rem; line-height: 1.5;
          color: var(--color-text-primary);
          font-family: var(--font-family);
          max-height: 100px; overflow-y: auto;
          padding: 6px 0;
        }
        .chat-textarea::placeholder { color: var(--color-text-muted); }
        .chat-send-btn {
          width: 38px; height: 38px; flex-shrink: 0;
          border-radius: 50%; border: none;
          background: var(--color-bg-tertiary);
          color: var(--color-text-muted);
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .send-active {
          background: linear-gradient(135deg, #6366f1, #0095f6) !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(99,102,241,0.4);
        }
        .send-active:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 16px rgba(99,102,241,0.5);
        }
        .chat-send-btn:disabled { cursor: not-allowed; opacity: 0.5; }

        /* ─── Mobile ─── */
        @media (max-width: 600px) {
          .chat-hdr { padding: 10px 14px; }
          .chat-call-btn span { display: none; }
          .chat-call-btn { padding: 8px 10px; border-radius: 50%; }
          .chat-inputbar { padding: 8px 10px; }
          .chat-icon-btn:first-of-type { display: none; }
        }
      `}</style>
    </main>
  );
};

export default Chat;
