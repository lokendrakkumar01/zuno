import { useState } from 'react';

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

const MessageItem = ({ message, mine, onDelete, onEdit }) => {
  const [showMenu, setShowMenu] = useState(false);
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleDownload = async () => {
    if (!message.media?.url) return;
    try {
      const response = await fetch(message.media.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zuno_media_${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  if (message.deletedForEveryone) {
    return (
      <div className={`msg-row ${mine ? 'msg-row-mine' : 'msg-row-theirs'}`}>
        <div className={`msg-bubble ${mine ? 'msg-bubble-mine' : 'msg-bubble-theirs'} msg-deleted`}>
          <p className="msg-text" style={{ fontStyle: 'italic', opacity: 0.7 }}>🚫 This message was deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`msg-row ${mine ? 'msg-row-mine' : 'msg-row-theirs'}`} onMouseLeave={() => setShowMenu(false)}>
      {!mine && (
        <div className="msg-avatar">
          {message.sender?.avatar
            ? <img src={message.sender.avatar} alt="" />
            : <span>{(message.sender?.username || message.sender?.displayName || '?')[0].toUpperCase()}</span>
          }
        </div>
      )}
      <div className={`msg-bubble-wrapper ${mine ? 'wrapper-mine' : 'wrapper-theirs'}`}>
        {!mine && <div className="msg-sender-name">{message.sender?.displayName || message.sender?.username}</div>}
        <div className={`msg-bubble ${mine ? 'msg-bubble-mine' : 'msg-bubble-theirs'} ${message.status === 'failed' ? 'msg-bubble-failed' : ''}`}>
          
          <button className="msg-menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
          {showMenu && (
            <div className="msg-dropdown-menu">
              {mine && <button onClick={() => { setShowMenu(false); onEdit?.(message); }}>✏️ Edit</button>}
              <button onClick={() => { setShowMenu(false); onDelete?.(message, 'me'); }}>🗑️ Delete for Me</button>
              {mine && <button onClick={() => { setShowMenu(false); onDelete?.(message, 'everyone'); }}>🗑️ Delete for Everyone</button>}
              {message.media?.url && <button onClick={() => { setShowMenu(false); handleDownload(); }}>⬇️ Download</button>}
            </div>
          )}

          {message.media?.url && (
            message.media.type === 'video'
              ? <video className="msg-media" src={message.media.url} controls />
              : <img className="msg-media" src={message.media.url} alt="" loading="lazy" />
          )}
          {message.text && <p className="msg-text">{message.text} {message.edited && <span className="msg-edited-tag">(edited)</span>}</p>}
          <div className="msg-meta">
            <span className="msg-time">{time}</span>
            {mine && (
              <span className="msg-status" style={{ color: statusColor[message.status] || 'rgba(255,255,255,0.6)' }}>
                {statusIcon[message.status] || '✓'}
              </span>
            )}
          </div>
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

        .msg-bubble-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          max-width: min(75%, 360px);
        }
        .wrapper-mine { align-items: flex-end; }
        .msg-sender-name {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: 3px;
          margin-left: 4px;
          font-weight: 600;
        }
        .msg-deleted { background: transparent !important; border: 1px dashed rgba(255,255,255,0.2) !important; color: #94a3b8 !important; }

        .msg-bubble {
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
        .msg-bubble:hover .msg-menu-btn { opacity: 1; }

        .msg-menu-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.4);
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          z-index: 2;
        }

        .msg-dropdown-menu {
          position: absolute;
          top: 30px;
          right: 0;
          background: #1e1e2d;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 6px 0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          z-index: 10;
          min-width: 160px;
        }

        .msg-dropdown-menu button {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: #e2e8f0;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .msg-dropdown-menu button:hover { background: rgba(255,255,255,0.08); }

        .msg-edited-tag {
          font-size: 0.7rem;
          opacity: 0.6;
          margin-left: 4px;
          font-style: italic;
        }

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
          .msg-bubble-wrapper { max-width: 85%; }
          .msg-bubble { font-size: 0.85rem; }
          .msg-row { padding: 3px 8px; }
        }
      `}</style>
    </div>
  );
};

export default MessageItem;
