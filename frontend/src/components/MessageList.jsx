import { memo, useEffect, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';

const MessageList = memo(({ messages, currentUserId, height = 520, onLoadMore, hasMore, onDelete, onEdit }) => {
  const virtuosoRef = useRef(null);
  const items = messages || [];

  useEffect(() => {
    if (!items.length) return;
    virtuosoRef.current?.scrollToIndex({
      index: items.length - 1,
      align: 'end',
      behavior: 'smooth'
    });
  }, [items.length]);

  if (!items.length && !hasMore) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          gap: '12px'
        }}
      >
        <div style={{ fontSize: '3rem' }}>DM</div>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>No messages yet. Say hello.</p>
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height, overflowX: 'hidden' }}
      data={items}
      firstItemIndex={Math.max(0, 100000 - items.length)}
      startReached={() => {
        if (hasMore) onLoadMore?.();
      }}
      followOutput="smooth"
      components={{
        Header: () => (
          hasMore ? (
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
                  cursor: 'pointer'
                }}
              >
                Load older messages
              </button>
            </div>
          ) : null
        )
      }}
      itemContent={(_, message) => {
        const senderId = message.sender?._id || message.sender?.id || message.sender;
        return (
          <MessageItem
            message={message}
            mine={String(senderId) === String(currentUserId)}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        );
      }}
      computeItemKey={(_, message) => message._id || message.clientMsgId}
    />
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
