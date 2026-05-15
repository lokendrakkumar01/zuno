const statusIcon = {
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '✗'
};

const statusColor = {
  sent: 'rgba(255,255,255,0.6)',
  delivered: 'rgba(255,255,255,0.6)',
  read: '#7dd3fc',
  failed: '#f87171'
};

const MessageItem = ({ message, mine }) => {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`msg-row ${mine ? 'msg-row-mine' : 'msg-row-theirs'}`}>
      {!mine && (
        <div className="msg-avatar">
          {message.sender?.avatar
            ? <img src={message.sender.avatar} alt="" />
            : <span>{(message.sender?.username || message.sender?.displayName || '?')[0].toUpperCase()}</span>
          }
        </div>
      )}
      <div className={`msg-bubble ${mine ? 'msg-bubble-mine' : 'msg-bubble-theirs'} ${message.status === 'failed' ? 'msg-bubble-failed' : ''}`}>
        {message.media?.url && (
          message.media.type === 'video'
            ? <video className="msg-media" src={message.media.url} controls />
            : <img className="msg-media" src={message.media.url} alt="" loading="lazy" />
        )}
        {message.text && <p className="msg-text">{message.text}</p>}
        <div className="msg-meta">
          <span className="msg-time">{time}</span>
          {mine && (
            <span className="msg-status" style={{ color: statusColor[message.status] || 'rgba(255,255,255,0.6)' }}>
              {statusIcon[message.status] || '✓'}
            </span>
          )}
        </div>
      </div>

      <style>{`
        .msg-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 4px 12px;
          animation: msgSlideIn 0.2s ease forwards;
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-row-mine { flex-direction: row-reverse; }
        .msg-row-theirs { flex-direction: row; }

        .msg-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--gradient-primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white;
        }
        .msg-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .msg-bubble {
          max-width: min(75%, 360px);
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 0.9rem;
          line-height: 1.45;
          position: relative;
          word-break: break-word;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: transform 0.15s ease;
        }
        .msg-bubble:hover { transform: scale(1.01); }

        .msg-bubble-mine {
          background: linear-gradient(135deg, #6366f1 0%, #0095f6 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .msg-bubble-theirs {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border-light);
          border-bottom-left-radius: 4px;
        }
        .msg-bubble-failed {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
        }

        .msg-media {
          width: 100%; max-height: 220px;
          border-radius: 10px; object-fit: cover;
          margin-bottom: 6px; display: block;
        }
        .msg-text { margin: 0; white-space: pre-wrap; }

        .msg-meta {
          display: flex; align-items: center; gap: 4px;
          margin-top: 4px; justify-content: flex-end;
        }
        .msg-time { font-size: 10px; opacity: 0.7; }
        .msg-status { font-size: 11px; font-weight: 600; }

        @media (max-width: 600px) {
          .msg-bubble { max-width: 85%; font-size: 0.85rem; }
          .msg-row { padding: 3px 8px; }
        }
      `}</style>
    </div>
  );
};

export default MessageItem;
