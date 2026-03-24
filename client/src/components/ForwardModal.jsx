import { useState } from 'react';

const ForwardModal = ({ conversations, currentUserId, onForward, onClose }) => {
  const [search, setSearch] = useState('');

  const getContactName = (conv) => {
    const contact = conv.participants?.find((p) => p._id !== currentUserId);
    return contact?.name || 'Unknown';
  };

  const getContactInitials = (conv) => {
    const name = getContactName(conv);
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const filtered = conversations.filter((conv) =>
    getContactName(conv).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          <h3>Forward to...</h3>
        </div>
        <div className="modal-search">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-user-list">
          {filtered.map((conv) => (
            <div
              key={conv._id}
              className="modal-user-item"
              onClick={() => onForward(conv._id)}
            >
              <div className="chat-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                {getContactInitials(conv)}
              </div>
              <div className="modal-user-info">
                <h4>{getContactName(conv)}</h4>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No conversations found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
