import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import useChat from '../hooks/useChat';
import useCall from '../hooks/useCall';
import MessageList from '../components/MessageList';
import TypingIndicator from '../components/TypingIndicator';
import CallModal from '../components/CallModal';

const Chat = () => {
  const { userId } = useParams();
  const { token, user } = useAuth();
  const [text, setText] = useState('');
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

  return (
    <main className="chat-page-container">
      <header className="chat-header glass">
        <div className="chat-header-info">
          <h1 className="chat-title">Chat</h1>
          <div className="chat-status">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
            <span className={connected ? 'text-success' : 'text-warning'}>
              {connected ? 'Realtime Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        <div className="chat-actions">
          <button 
            onClick={() => call.startCall(userId, 'audio')} 
            className="chat-action-btn audio-btn"
            title="Start Audio Call"
          >
            <span>📞</span> Audio
          </button>
          <button 
            onClick={() => call.startCall(userId, 'video')} 
            className="chat-action-btn video-btn"
            title="Start Video Call"
          >
            <span>📹</span> Video
          </button>
        </div>
      </header>

      {connectionError && <div className="chat-alert error">{connectionError}</div>}
      {chat.error && <div className="chat-alert error">{chat.error}</div>}

      <section className="chat-messages-section">
        {chat.loading ? (
          <div className="chat-loader-shell">
            <div className="loader"></div>
            <p>Gathering your messages...</p>
          </div>
        ) : (
          <MessageList
            messages={chat.messages}
            currentUserId={currentUserId}
            hasMore={chat.hasMore}
            onLoadMore={chat.loadMore}
            height={window.innerHeight - 160}
          />
        )}
      </section>

      <div className="chat-typing-wrapper">
        <TypingIndicator visible={isTyping} />
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-form">
          <input
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              chat.emitTyping();
            }}
            className="chat-input-field"
            placeholder="Type a message..."
            autoComplete="off"
          />
          <button 
            disabled={!text.trim()} 
            className="chat-send-btn"
          >
            <span className="send-icon">➤</span>
          </button>
        </form>
      </div>

      <CallModal call={call} />

      <style>{`
        .chat-page-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 64px);
          background: var(--color-bg-primary);
          overflow: hidden;
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--color-border-light);
          z-index: 10;
        }

        .chat-title {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0;
          color: var(--color-text-primary);
        }

        .chat-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.online {
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
        }

        .status-dot.offline {
          background: #f59e0b;
        }

        .chat-actions {
          display: flex;
          gap: 0.75rem;
        }

        .chat-action-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 600;
          border: 1px solid var(--color-border-light);
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .video-btn {
          background: var(--color-primary) !important;
          color: white !important;
          border: none !important;
        }

        .chat-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .chat-messages-section {
          flex: 1;
          min-height: 0;
          padding: 0 1rem;
        }

        .chat-loader-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--color-text-muted);
          gap: 1rem;
        }

        .chat-input-container {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--color-border-light);
          background: var(--color-bg-primary);
        }

        .chat-form {
          display: flex;
          gap: 1rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .chat-input-field {
          flex: 1;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          padding: 0.875rem 1.25rem;
          border-radius: var(--radius-full);
          color: var(--color-text-primary);
          font-size: 0.95rem;
          outline: none;
          transition: all 0.25s ease;
        }

        .chat-input-field:focus {
          border-color: var(--color-primary);
          background: var(--color-bg-primary);
          box-shadow: 0 0 0 3px rgba(0, 149, 246, 0.1);
        }

        .chat-send-btn {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .chat-send-btn:hover:not(:disabled) {
          transform: scale(1.1);
          box-shadow: var(--shadow-glow);
        }

        .chat-alert {
          margin: 0.5rem 1rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
        }

        .chat-alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fee2e2;
        }

        @media (max-width: 768px) {
          .chat-header {
            padding: 0.75rem 1rem;
          }
          .chat-actions span {
            display: none;
          }
          .chat-action-btn {
            padding: 0.5rem;
          }
        }
      `}</style>
    </main>
  );
};

export default Chat;
