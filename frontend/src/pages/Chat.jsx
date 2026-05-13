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
    <main className="flex h-[calc(100vh-72px)] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Chat</h1>
          <p className={`text-sm ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
            {connected ? 'Realtime connected' : 'Reconnecting...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => call.startCall(userId, 'audio')} className="rounded bg-slate-100 px-3 py-2 text-sm">Audio</button>
          <button onClick={() => call.startCall(userId, 'video')} className="rounded bg-indigo-600 px-3 py-2 text-sm text-white">Video</button>
        </div>
      </header>

      {connectionError && <div className="bg-amber-50 px-4 py-2 text-sm text-amber-700">{connectionError}</div>}
      {chat.error && <div className="bg-rose-50 px-4 py-2 text-sm text-rose-700">{chat.error}</div>}

      <section className="min-h-0 flex-1">
        {chat.loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">Loading messages...</div>
        ) : (
          <MessageList
            messages={chat.messages}
            currentUserId={currentUserId}
            hasMore={chat.hasMore}
            onLoadMore={chat.loadMore}
            height={Math.max(360, window.innerHeight - 220)}
          />
        )}
      </section>

      <TypingIndicator visible={isTyping} />

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            chat.emitTyping();
          }}
          className="flex-1 rounded border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          placeholder="Type a message..."
        />
        <button disabled={!text.trim()} className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">Send</button>
      </form>

      <CallModal call={call} />
    </main>
  );
};

export default Chat;
