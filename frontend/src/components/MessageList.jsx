import { memo, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import MessageItem from './MessageItem';

const MessageList = memo(({ messages, currentUserId, height = 520, onLoadMore, hasMore }) => {
  const items = useMemo(() => messages || [], [messages]);

  const Row = ({ index, style }) => {
    if (index === 0 && hasMore) {
      return (
        <div style={style} className="flex items-center justify-center">
          <button onClick={onLoadMore} className="rounded bg-slate-200 px-3 py-1 text-sm text-slate-700">Load older</button>
        </div>
      );
    }
    const message = items[hasMore ? index - 1 : index];
    if (!message) return null;
    const senderId = message.sender?._id || message.sender?.id || message.sender;
    return (
      <div style={style}>
        <MessageItem message={message} mine={String(senderId) === String(currentUserId)} />
      </div>
    );
  };

  const itemCount = items.length + (hasMore ? 1 : 0);
  return (
    <List height={height} itemCount={itemCount} itemSize={96} width="100%" itemKey={(index) => {
      const message = items[hasMore ? index - 1 : index];
      return message?._id || message?.id || `loader-${index}`;
    }}>
      {Row}
    </List>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
