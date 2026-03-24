import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { logoutUser, updateUser, uploadFile, resolveMediaUrl } from '../services/api';
import { disconnectSocket } from '../services/socket';
import ChatListItem from './ChatListItem';

const Sidebar = ({
  conversations,
  activeConversation,
  onSelectConversation,
  onlineUsers,
  typingUsers,
  currentUser,
  showNewChat,
  setShowNewChat,
  allUsers,
  onStartChat,
  onCreateGroup,
  onUserDataUpdated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [profileAbout, setProfileAbout] = useState(currentUser.about || '');
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  useEffect(() => {
    setSearchTerm('');
  }, [activeConversation?._id, showNewChat]);

  useEffect(() => {
    setProfileName(currentUser.name || '');
    setProfileAbout(currentUser.about || '');
    setProfilePhone(currentUser.phone || '');
  }, [currentUser]);

  const avatarInputRef = useRef(null);
  const { logout } = useAuth();

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    return conversations.filter((conv) => {
      if (conv.isGroup) {
        return conv.groupName?.toLowerCase().includes(searchTerm.toLowerCase());
      }
      const contact = conv.participants.find((p) => p._id !== currentUser._id);
      return contact?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [conversations, searchTerm, currentUser._id]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return allUsers;
    return allUsers.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allUsers, searchTerm]);

  const handleLogout = async () => {
    try {
      await logoutUser(currentUser._id);
    } catch (err) {
      console.error('Logout error:', err);
    }
    disconnectSocket();
    logout();
    setShowMenu(false);
  };

  const getInitials = (name) => {
    return name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  const handleAvatarPick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const { data: uploadData } = await uploadFile(file, 'avatar');
      const { data: updatedUser } = await updateUser(currentUser._id, {
        name: currentUser.name,
        about: currentUser.about,
        avatar: uploadData.fileUrl,
      });
      onUserDataUpdated?.(updatedUser);
    } catch (err) {
      console.error('Avatar update failed:', err);
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const getConversationDisplay = (conv) => {
    if (conv.isGroup) {
      return {
        name: conv.groupName,
        isGroup: true,
        memberCount: conv.participants?.length || 0,
      };
    }
    const contact = conv.participants.find((p) => p._id !== currentUser._id);
    return { name: contact?.name, contact, isGroup: false };
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      const { data: updatedUser } = await updateUser(currentUser._id, {
        name: profileName.trim(),
        about: profileAbout.trim(),
        phone: profilePhone.trim(),
        avatar: currentUser.avatar || '',
      });
      onUserDataUpdated?.(updatedUser);
      setShowProfileModal(false);
    } catch (err) {
      console.error('Profile update failed:', err);
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <div className="sidebar-avatar" onClick={handleAvatarPick} title="Change profile photo">
            {currentUser.avatar ? (
              <img src={resolveMediaUrl(currentUser.avatar)} alt={currentUser.name} className="avatar-img" />
            ) : (
              getInitials(currentUser.name)
            )}
            {avatarUploading && <span className="avatar-uploading-dot" />}
          </div>
          <span className="sidebar-user-name clickable-name" onClick={() => setShowProfileModal(true)} title="Edit profile">
            {currentUser.name}
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-btn" title="New chat" onClick={() => setShowNewChat(!showNewChat)}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/>
            </svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" title="Menu" onClick={() => setShowMenu(!showMenu)}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/>
              </svg>
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { onCreateGroup(); setShowMenu(false); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  New Group
                </div>
                <div className="dropdown-item" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16 13v-2H7V8l-5 4 5 4v-3z"/>
                    <path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z"/>
                  </svg>
                  Log out
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
          </svg>
          <input
            type="text"
            placeholder={showNewChat ? 'Search contacts' : 'Search or start new chat'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List or New Chat Users */}
      <div className="chat-list">
        {showNewChat ? (
          <>
            {filteredUsers.map((u) => (
              <div
                key={u._id}
                className="modal-user-item"
                onClick={() => onStartChat(u)}
              >
                <div className="chat-avatar">
                  {getInitials(u.name)}
                  {onlineUsers.includes(u._id) && <span className="online-dot" />}
                </div>
                <div className="modal-user-info">
                  <h4>{u.name}</h4>
                  <p>{u.about || u.phone || u.email || 'No status'}</p>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                No contacts found
              </div>
            )}
          </>
        ) : (
          <>
            {filteredConversations.map((conv) => {
              const display = getConversationDisplay(conv);
              if (!display.name) return null;

              if (conv.isGroup) {
                // Group conversation
                const isActive = activeConversation?._id === conv._id;
                const isTyping = typingUsers[conv._id];
                const unreadCount = conv.unreadCount?.[currentUser._id] || 0;

                return (
                  <ChatListItem
                    key={conv._id}
                    conversation={conv}
                    contact={{ name: conv.groupName, _id: conv._id }}
                    isActive={isActive}
                    isOnline={false}
                    isTyping={isTyping}
                    unreadCount={unreadCount}
                    onClick={() => onSelectConversation(conv)}
                    isGroup={true}
                    memberCount={conv.participants?.length}
                  />
                );
              }

              // 1:1 conversation
              const contact = conv.participants.find((p) => p._id !== currentUser._id);
              if (!contact) return null;
              const isActive = activeConversation?._id === conv._id;
              const isOnline = onlineUsers.includes(contact._id);
              const isTyping = typingUsers[conv._id];
              const unreadCount = conv.unreadCount?.[currentUser._id] || 0;

              return (
                <ChatListItem
                  key={conv._id}
                  conversation={conv}
                  contact={contact}
                  isActive={isActive}
                  isOnline={isOnline}
                  isTyping={isTyping}
                  unreadCount={unreadCount}
                  onClick={() => onSelectConversation(conv)}
                />
              );
            })}
            {filteredConversations.length === 0 && conversations.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                <p style={{ marginBottom: '12px' }}>No conversations yet</p>
                <p>Click the <strong>new chat</strong> icon above to start a conversation</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
          onClick={() => setShowMenu(false)}
        />
      )}

      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button className="modal-close" onClick={() => setShowProfileModal(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
              <h3>Edit profile</h3>
            </div>
            <form className="auth-form" style={{ padding: '16px 20px 20px' }} onSubmit={handleSaveProfile}>
              <div className="input-group">
                <label htmlFor="profile-name">Name</label>
                <input id="profile-name" type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} minLength={2} required />
              </div>
              <div className="input-group">
                <label htmlFor="profile-phone">Phone</label>
                <input id="profile-phone" type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="input-group">
                <label htmlFor="profile-about">About</label>
                <input id="profile-about" type="text" value={profileAbout} onChange={(e) => setProfileAbout(e.target.value)} maxLength={140} />
              </div>
              <button className="auth-btn" type="submit" disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
