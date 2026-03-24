import { resolveMediaUrl } from '../services/api';

const ChatListItem = ({ conversation, contact, isActive, isOnline, isTyping, unreadCount, onClick, isGroup, memberCount }) => {
  const getInitials = (name) => {
    return name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 2 * oneDay) {
      return 'Yesterday';
    } else if (diff < 7 * oneDay) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const lastMessageText = isTyping
    ? 'typing...'
    : conversation.lastMessage?.text || (isGroup ? 'Group created' : 'Start a conversation');

  return (
    <div
      className={`chat-list-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className={`chat-avatar ${isGroup ? 'group-avatar' : ''}`}>
        {isGroup ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.8 }}>
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        ) : (
          contact.avatar ? <img src={resolveMediaUrl(contact.avatar)} alt={contact.name} className="avatar-img" /> : getInitials(contact.name)
        )}
        {!isGroup && isOnline && <span className="online-dot" />}
      </div>
      <div className="chat-info">
        <div className="chat-info-top">
          <span className="chat-name">{contact.name}</span>
          <span className={`chat-time ${unreadCount > 0 ? 'unread' : ''}`}>
            {formatTime(conversation.lastMessage?.timestamp || conversation.updatedAt)}
          </span>
        </div>
        <div className="chat-info-bottom">
          <span
            className="chat-last-message"
            style={isTyping ? { color: 'var(--accent-green)', fontStyle: 'italic' } : {}}
          >
            {lastMessageText}
          </span>
          {unreadCount > 0 && (
            <span className="chat-unread-badge">{unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatListItem;
