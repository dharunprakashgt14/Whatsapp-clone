import { useState } from 'react';

const CreateGroupModal = ({ users, currentUserId, onCreateGroup, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(1); // 1 = select members, 2 = name group

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filtered = users.filter((u) =>
    u._id !== currentUserId &&
    (u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const getInitials = (name) =>
    name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || '?';

  const handleCreate = () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    onCreateGroup(groupName.trim(), selectedUsers);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-close" onClick={step === 2 ? () => setStep(1) : onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              {step === 2 ? (
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              ) : (
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              )}
            </svg>
          </button>
          <h3>{step === 1 ? 'Add group members' : 'New group'}</h3>
        </div>

        {step === 1 ? (
          <>
            {/* Selected chips */}
            {selectedUsers.length > 0 && (
              <div className="group-selected-chips">
                {selectedUsers.map((uid) => {
                  const u = users.find((us) => us._id === uid);
                  return (
                    <div key={uid} className="group-chip" onClick={() => toggleUser(uid)}>
                      <span>{u?.name || 'Unknown'}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-search">
              <div className="search-input-wrapper">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-user-list">
              {filtered.map((u) => (
                <div
                  key={u._id}
                  className={`modal-user-item ${selectedUsers.includes(u._id) ? 'selected' : ''}`}
                  onClick={() => toggleUser(u._id)}
                >
                  <div className="chat-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                    {getInitials(u.name)}
                  </div>
                  <div className="modal-user-info">
                    <h4>{u.name}</h4>
                    <p>{u.about || u.email}</p>
                  </div>
                  <div className={`group-checkbox ${selectedUsers.includes(u._id) ? 'checked' : ''}`}>
                    {selectedUsers.includes(u._id) && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Next button */}
            {selectedUsers.length > 0 && (
              <button className="group-next-btn" onClick={() => setStep(2)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
            )}
          </>
        ) : (
          <div className="group-name-step">
            <div className="group-avatar-large">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            <div className="group-name-input">
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                maxLength={25}
              />
            </div>
            <p className="group-member-count">{selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected</p>

            <button
              className="group-create-btn"
              onClick={handleCreate}
              disabled={!groupName.trim()}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupModal;
