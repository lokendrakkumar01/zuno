import { Outlet, useLocation, useParams } from 'react-router-dom';
import MessagesSidebar from './Messages'; // We will rename the export of Messages.jsx to MessagesSidebar, or just use it as is
import './MessagesLayout.css';

const MessagesLayout = () => {
  const location = useLocation();
  const { userId, groupId } = useParams();
  
  // On mobile, if we are in a chat, hide the sidebar. Otherwise, hide the chat pane.
  const isChatActive = location.pathname !== '/messages' && location.pathname !== '/messages/';

  return (
    <div className="messages-dual-pane-container">
      <div className={`messages-sidebar-pane ${isChatActive ? 'mobile-hidden' : ''}`}>
        <MessagesSidebar isSidebarView={true} />
      </div>
      <div className={`messages-chat-pane ${!isChatActive ? 'mobile-hidden' : ''}`}>
        {isChatActive ? (
          <Outlet />
        ) : (
          <div className="messages-empty-chat-state">
            <div className="empty-chat-icon">💬</div>
            <h2>Your Messages</h2>
            <p>Select a conversation from the sidebar or start a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesLayout;
