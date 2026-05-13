const statusLabel = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed'
};

const MessageItem = ({ message, mine }) => {
  return (
    <div className={`flex px-4 py-1 ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
        {message.media?.url && (
          message.media.type === 'video'
            ? <video className="mb-2 max-h-72 rounded" src={message.media.url} controls />
            : <img className="mb-2 max-h-72 rounded object-cover" src={message.media.url} alt="" loading="lazy" />
        )}
        {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        <div className={`mt-1 text-[11px] ${mine ? 'text-indigo-100' : 'text-slate-500'}`}>
          {mine ? statusLabel[message.status] || 'Sent' : new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
