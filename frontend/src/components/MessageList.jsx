import { memo, useEffect, useRef } from 'react';
import MessageItem from './MessageItem';

const MessageList = memo(({ messages, currentUserId, height = 520, onLoadMore, hasMore }) => {
  const items = messages || [];
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  return (
    <div
      ref={containerRef}
      style={{
        height: height,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0',
        scrollBehavior: 'smooth',
      }}
    >
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
          <button
            onClick={onLoadMore}
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={e => e.target.style.borderColor = 'var(--color-primary)'}
            onMouseOut={e => e.target.style.borderColor = 'var(--color-border)'}
          >
            Load older messages
          </button>
        </div>
      )}
      {items.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'var(--color-text-muted)',
          gap: '12px',
        }}>
          <div style={{ fontSize: '3rem' }}>💬</div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No messages yet. Say hello!</p>
        </div>
      )}
      {items.map((message) => {
        const senderId = message.sender?._id || message.sender?.id || message.sender;
        return (
          <MessageItem
            key={message._id || message.clientMsgId}
            message={message}
            mine={String(senderId) === String(currentUserId)}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
