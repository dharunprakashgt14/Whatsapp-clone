import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getConversations, getUsers, createConversation, createGroup } from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import CallModal from '../components/CallModal';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import EmptyChat from '../components/EmptyChat';
import CreateGroupModal from '../components/CreateGroupModal';

const sameConvId = (a, b) => String(a) === String(b);
const sameUserId = (a, b) => String(a) === String(b);

// Notification sound for sidebar (non-active chat) messages
const sidebarNotificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgipyzrKF7UDY1WIebtq2ka0pBPV+Is7apfU8wOF6Mt7CmbUk6PlqOs7akdUQ5Q16OuK6Xaj06RGKVubGigEAyP12StK6ehUM4O16RuK2bfD8zQGKWuK2QcDs1QWCWuKyKaz00RGeduqx/YDI3RW2gvKh4VTA4UHuksaNuSDQ+V4azrJtyQTU+X4+3rJduPjI+XpG3q5NrOTM/YpW4q41kNzVDY5m7qolhNTZGZpy7qYVdNDZIaJ+7pn9XNDVNY6W9pXtTMTVRaa2+oHROMTRTa7C+nW9LMDRUY7W+mmpHMzVYcLe+lGRFMzVbdLm+j2BDNDVeen6+iVo/NTVlhbu/g1U8NTZoiby+fVA5NTdri76+d0w8NjhtkL++cUk5NTlxlL+/a0Y4NTt0mMC+aEQ4NTt3msG+Y0A3ND16n8K+Xz41ND6ApcO+WTk0MkCGqcS+UzYzMkKKrMW+TjMzMkWPsMa+SjAzMkeUtci+RSwxM0mYuMm+QSoxM0qdvMm+PSgxM0yiwsq+OCUwM06nyMu+NCMwM1Ctzsy+MSEwM1Gz1M2+LR8vM1O43s6+KRwvM1W+5M++JhkvM1fD6dG+IBcvM1nJ7tK+HRUuM1vO89O+GhMuM13U99W+FhEtM1/Z+9e+Ew8tM2Hf/9m+EQ0tM2Pl/9u+Dgw=');
sidebarNotificationSound.volume = 0.3;

const Chat = () => {
  const { user, login } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeContact, setActiveContact] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [pendingRemoteCall, setPendingRemoteCall] = useState(null);
  const activeConversationRef = useRef(null);
  const activeContactRef = useRef(null);
  const incomingRingRef = useRef(null);
  const globalCallDummyLocalVideoRef = useRef(null);
  const globalCallDummyRemoteVideoRef = useRef(null);
  const globalCallDummyRemoteAudioRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);

  const isInCallWith = useCallback(
    (otherUserId) => {
      const conv = activeConversationRef.current;
      const contact = activeContactRef.current;
      return Boolean(
        conv &&
          !conv.isGroup &&
          contact &&
          sameConvId(contact._id, otherUserId)
      );
    },
    []
  );

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await getConversations(user._id);
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, [user._id]);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await getUsers(user._id);
      setAllUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [user._id]);

  /** Merge a user object from the API into chats, active chat, directory list, and auth (if self). */
  const mergeUserIntoState = useCallback(
    (updatedUser) => {
      if (!updatedUser?._id) return;
      const uid = String(updatedUser._id);
      if (sameUserId(user._id, uid)) {
        const token = localStorage.getItem('whatsapp_token');
        login(updatedUser, token || undefined);
      }
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          participants: (conv.participants || []).map((p) =>
            sameUserId(p._id, uid) ? { ...p, ...updatedUser } : p
          ),
        }))
      );
      setActiveConversation((prev) => {
        if (!prev?.participants?.length) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            sameUserId(p._id, uid) ? { ...p, ...updatedUser } : p
          ),
        };
      });
      setActiveContact((prev) => {
        if (!prev) return prev;
        if (prev.isGroup && prev.participants) {
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              sameUserId(p._id, uid) ? { ...p, ...updatedUser } : p
            ),
          };
        }
        if (!prev.isGroup && sameUserId(prev._id, uid)) {
          return { ...prev, ...updatedUser };
        }
        return prev;
      });
      setAllUsers((prev) =>
        prev.map((u) => (sameUserId(u._id, uid) ? { ...u, ...updatedUser } : u))
      );
    },
    [user._id, login]
  );

  useEffect(() => {
    fetchConversations();
    fetchUsers();

    const socket = connectSocket(user._id);

    const onOnlineUsers = (users) => setOnlineUsers(users);

    const onUserStatusChanged = ({ userId, online, lastSeen }) => {
      setOnlineUsers((prev) => {
        if (online) return prev.includes(userId) ? prev : [...prev, userId];
        return prev.filter((id) => id !== userId);
      });
      if (!online && lastSeen) {
        setAllUsers((prev) =>
          prev.map((u) => (sameUserId(u._id, userId) ? { ...u, online: false, lastSeen } : u))
        );
      }
    };

    const onConversationUpdated = ({ conversationId, lastMessage, unreadCount }) => {
      setConversations((prev) => {
        const exists = prev.find((conv) => sameConvId(conv._id, conversationId));
        if (!exists) {
          fetchConversations();
          return prev;
        }
        return prev
          .map((conv) =>
            sameConvId(conv._id, conversationId)
              ? { ...conv, lastMessage, unreadCount: { ...conv.unreadCount, [user._id]: unreadCount } }
              : conv
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessage?.timestamp || b.updatedAt) - new Date(a.lastMessage?.timestamp || a.updatedAt)
          );
      });

      if (unreadCount > 0 && !sameConvId(activeConversationRef.current?._id, conversationId)) {
        sidebarNotificationSound.currentTime = 0;
        sidebarNotificationSound.play().catch(() => {});
      }
    };

    const onNewConversation = (conversation) => {
      setConversations((prev) => {
        if (prev.some((c) => sameConvId(c._id, conversation._id))) return prev;
        return [conversation, ...prev];
      });
    };

    const onGlobalCallOffer = ({ fromUserId, payload }) => {
      if (isInCallWith(fromUserId)) return;
      sidebarNotificationSound.currentTime = 0;
      sidebarNotificationSound.play().catch(() => {});
      setIncomingCall({
        fromUserId,
        mode: payload?.mode || 'voice',
        sdp: payload?.sdp,
        iceCandidates: [],
      });
    };

    const onGlobalCallIce = ({ fromUserId, payload }) => {
      if (isInCallWith(fromUserId)) return;
      setIncomingCall((prev) => {
        if (!prev || !sameConvId(prev.fromUserId, fromUserId)) return prev;
        return { ...prev, iceCandidates: [...prev.iceCandidates, payload] };
      });
    };

    const onGlobalCallReject = ({ fromUserId }) => {
      setIncomingCall((prev) => {
        if (!prev || !sameConvId(prev.fromUserId, fromUserId)) return prev;
        return null;
      });
    };

    const onGlobalCallEnd = ({ fromUserId }) => {
      setIncomingCall((prev) => {
        if (!prev || !sameConvId(prev.fromUserId, fromUserId)) return prev;
        return null;
      });
    };

    const onUserTyping = ({ conversationId, userName }) => {
      setTypingUsers((prev) => ({ ...prev, [conversationId]: userName }));
    };

    const onUserStoppedTyping = ({ conversationId }) => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });
    };

    socket.on('onlineUsers', onOnlineUsers);
    socket.on('userStatusChanged', onUserStatusChanged);
    socket.on('conversationUpdated', onConversationUpdated);
    socket.on('newConversation', onNewConversation);
    socket.on('call:offer', onGlobalCallOffer);
    socket.on('call:ice-candidate', onGlobalCallIce);
    socket.on('call:reject', onGlobalCallReject);
    socket.on('call:end', onGlobalCallEnd);
    socket.on('userTyping', onUserTyping);
    socket.on('userStoppedTyping', onUserStoppedTyping);

    const userRefreshInterval = setInterval(() => {
      fetchUsers();
    }, 15000);

    return () => {
      clearInterval(userRefreshInterval);
      socket.off('onlineUsers', onOnlineUsers);
      socket.off('userStatusChanged', onUserStatusChanged);
      socket.off('conversationUpdated', onConversationUpdated);
      socket.off('newConversation', onNewConversation);
      socket.off('call:offer', onGlobalCallOffer);
      socket.off('call:ice-candidate', onGlobalCallIce);
      socket.off('call:reject', onGlobalCallReject);
      socket.off('call:end', onGlobalCallEnd);
      socket.off('userTyping', onUserTyping);
      socket.off('userStoppedTyping', onUserStoppedTyping);
    };
  }, [user._id, fetchConversations, fetchUsers, isInCallWith]);

  useEffect(() => {
    const handleBeforeUnload = () => disconnectSocket();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleSelectConversation = useCallback((conversation) => {
    if (conversation.isGroup) {
      setActiveConversation(conversation);
      setActiveContact({
        _id: conversation._id,
        name: conversation.groupName,
        isGroup: true,
        participants: conversation.participants,
        groupAdmin: conversation.groupAdmin,
      });
    } else {
      const contact = conversation.participants.find((p) => !sameConvId(p._id, user._id));
      setActiveConversation(conversation);
      setActiveContact(contact);
    }
    setMobileShowChat(true);
  }, [user._id]);

  const handleStartChat = async (contactUser) => {
    try {
      const { data: conversation } = await createConversation(user._id, contactUser._id);
      const exists = conversations.some((c) => sameConvId(c._id, conversation._id));
      if (!exists) {
        setConversations((prev) => {
          if (prev.some((c) => sameConvId(c._id, conversation._id))) return prev;
          return [conversation, ...prev];
        });
      }
      const contact = conversation.participants.find((p) => !sameConvId(p._id, user._id));
      setActiveConversation(conversation);
      setActiveContact(contact);
      setShowNewChat(false);
      setMobileShowChat(true);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleCreateGroup = async (groupName, memberIds) => {
    try {
      const { data: conversation } = await createGroup(user._id, memberIds, groupName);
      const exists = conversations.some((c) => sameConvId(c._id, conversation._id));
      if (!exists) {
        setConversations((prev) => {
          if (prev.some((c) => sameConvId(c._id, conversation._id))) return prev;
          return [conversation, ...prev];
        });
      }
      setActiveConversation(conversation);
      setActiveContact({
        _id: conversation._id,
        name: conversation.groupName,
        isGroup: true,
        participants: conversation.participants,
        groupAdmin: conversation.groupAdmin,
      });
      setShowCreateGroup(false);
      setMobileShowChat(true);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleMessageSent = () => fetchConversations();

  const handleCloseChat = useCallback(() => {
    setActiveConversation(null);
    setActiveContact(null);
    setMobileShowChat(false);
  }, []);

  const handleMarkAsRead = useCallback((conversationId) => {
    setConversations((prev) =>
      prev.map((conv) =>
        sameConvId(conv._id, conversationId)
          ? { ...conv, unreadCount: { ...conv.unreadCount, [user._id]: 0 } }
          : conv
      )
    );
  }, [user._id]);

  useEffect(() => {
    if (!incomingCall) {
      if (incomingRingRef.current) {
        clearInterval(incomingRingRef.current);
        incomingRingRef.current = null;
      }
      return;
    }
    const tick = () => {
      sidebarNotificationSound.currentTime = 0;
      sidebarNotificationSound.play().catch(() => {});
    };
    tick();
    incomingRingRef.current = setInterval(tick, 2800);
    return () => {
      if (incomingRingRef.current) {
        clearInterval(incomingRingRef.current);
        incomingRingRef.current = null;
      }
    };
  }, [incomingCall]);

  const incomingCallerName =
    incomingCall &&
    (allUsers.find((u) => sameConvId(u._id, incomingCall.fromUserId))?.name ||
      conversations.find(
        (c) =>
          !c.isGroup &&
          c.participants?.some((p) => sameConvId(p._id, incomingCall.fromUserId))
      )?.participants?.find((p) => sameConvId(p._id, incomingCall.fromUserId))?.name ||
      'Someone');

  const acceptGlobalIncoming = useCallback(async () => {
    if (!incomingCall) return;
    const { fromUserId, mode, sdp, iceCandidates } = incomingCall;
    let conv = conversations.find(
      (c) =>
        !c.isGroup && c.participants?.some((p) => sameConvId(p._id, fromUserId))
    );
    if (!conv) {
      try {
        const { data } = await createConversation(user._id, fromUserId);
        conv = data;
        setConversations((prev) => {
          if (prev.some((c) => sameConvId(c._id, conv._id))) return prev;
          return [conv, ...prev];
        });
      } catch (err) {
        console.error('Failed to open chat for call:', err);
        return;
      }
    }
    setPendingRemoteCall({ fromUserId, mode, sdp, iceCandidates: [...iceCandidates] });
    setIncomingCall(null);
    handleSelectConversation(conv);
  }, [incomingCall, conversations, user._id, handleSelectConversation]);

  const declineGlobalIncoming = useCallback(() => {
    if (!incomingCall) return;
    getSocket()?.emit('call:reject', { toUserId: incomingCall.fromUserId });
    setIncomingCall(null);
  }, [incomingCall]);

  const consumePendingRemoteCall = useCallback(() => {
    setPendingRemoteCall(null);
  }, []);

  useEffect(() => {
    const totalUnread = conversations.reduce((sum, conv) => {
      const count = conv.unreadCount?.[user._id] || 0;
      return sum + count;
    }, 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) WhatsApp` : 'WhatsApp';
  }, [conversations, user._id]);

  return (
    <div className="app-wrapper">
      <div className={`app-container ${mobileShowChat && activeConversation ? 'mobile-show-chat' : ''}`}>
        <Sidebar
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={handleSelectConversation}
          onlineUsers={onlineUsers}
          typingUsers={typingUsers}
          currentUser={user}
          showNewChat={showNewChat}
          setShowNewChat={setShowNewChat}
          allUsers={allUsers}
          onStartChat={handleStartChat}
          onCreateGroup={() => setShowCreateGroup(true)}
          onUserDataUpdated={mergeUserIntoState}
        />
        {activeConversation && activeContact ? (
          <ChatWindow
            conversation={activeConversation}
            contact={activeContact}
            currentUser={user}
            onlineUsers={onlineUsers}
            typingUsers={typingUsers}
            onMessageSent={handleMessageSent}
            onBack={() => setMobileShowChat(false)}
            onCloseChat={handleCloseChat}
            onMarkAsRead={handleMarkAsRead}
            allUsers={allUsers}
            conversations={conversations}
            pendingRemoteCall={pendingRemoteCall}
            onPendingRemoteCallConsumed={consumePendingRemoteCall}
            onUserDataUpdated={mergeUserIntoState}
          />
        ) : (
          <EmptyChat />
        )}
      </div>

      {incomingCall && (
        <CallModal
          open
          mode={incomingCall.mode}
          status="Incoming call"
          contactName={incomingCallerName || 'Someone'}
          localVideoRef={globalCallDummyLocalVideoRef}
          remoteVideoRef={globalCallDummyRemoteVideoRef}
          remoteAudioRef={globalCallDummyRemoteAudioRef}
          isIncoming
          onAccept={acceptGlobalIncoming}
          onDecline={declineGlobalIncoming}
          onEnd={declineGlobalIncoming}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          users={allUsers}
          currentUserId={user._id}
          onCreateGroup={handleCreateGroup}
          onClose={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  );
};

export default Chat;
