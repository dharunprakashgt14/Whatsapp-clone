import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  reactToMessage,
  forwardMessage,
  resolveMediaUrl,
  updateUser,
  getUser,
} from '../services/api';
import { getSocket, joinConversation, leaveConversation, emitTyping, emitStopTyping } from '../services/socket';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ForwardModal from './ForwardModal';
import CallModal from './CallModal';

// Notification sound
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgipyzrKF7UDY1WIebtq2ka0pBPV+Is7apfU8wOF6Mt7CmbUk6PlqOs7akdUQ5Q16OuK6Xaj06RGKVubGigEAyP12StK6ehUM4O16RuK2bfD8zQGKWuK2QcDs1QWCWuKyKaz00RGeduqx/YDI3RW2gvKh4VTA4UHuksaNuSDQ+V4azrJtyQTU+X4+3rJduPjI+XpG3q5NrOTM/YpW4q41kNzVDY5m7qolhNTZGZpy7qYVdNDZIaJ+7pn9XNDVNY6W9pXtTMTVRaa2+oHROMTRTa7C+nW9LMDRUY7W+mmpHMzVYcLe+lGRFMzVbdLm+j2BDNDVeen6+iVo/NTVlhbu/g1U8NTZoiby+fVA5NTdri76+d0w8NjhtkL++cUk5NTlxlL+/a0Y4NTt0mMC+aEQ4NTt3msG+Y0A3ND16n8K+Xz41ND6ApcO+WTk0MkCGqcS+UzYzMkKKrMW+TjMzMkWPsMa+SjAzMkeUtci+RSwxM0mYuMm+QSoxM0qdvMm+PSgxM0yiwsq+OCUwM06nyMu+NCMwM1Ctzsy+MSEwM1Gz1M2+LR8vM1O43s6+KRwvM1W+5M++JhkvM1fD6dG+IBcvM1nJ7tK+HRUuM1vO89O+GhMuM13U99W+FhEtM1/Z+9e+Ew8tM2Hf/9m+EQ0tM2Pl/9u+Dgw=');
notificationSound.volume = 0.3;
const playNotificationSound = () => { notificationSound.currentTime = 0; notificationSound.play().catch(() => {}); };

const sameUserId = (a, b) => String(a) === String(b);

const ChatWindow = ({
  conversation,
  contact,
  currentUser,
  onlineUsers,
  typingUsers,
  onMessageSent,
  onBack,
  onCloseChat,
  onMarkAsRead,
  allUsers,
  conversations,
  pendingRemoteCall,
  onPendingRemoteCallConsumed,
  onUserDataUpdated,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [contactEditPhone, setContactEditPhone] = useState('');
  const [contactEditAbout, setContactEditAbout] = useState('');
  const [contactInfoSaving, setContactInfoSaving] = useState(false);
  const messagesEndRef = useRef(null);
  const chatMenuRef = useRef(null);
  const chatMenuBtnRef = useRef(null);
  const [callState, setCallState] = useState({ open: false, mode: 'voice', status: '', isIncoming: false, fromUserId: null });
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingIceRef = useRef([]);
  const messagesAreaRef = useRef(null);
  const prevConversationId = useRef(null);
  const onMarkAsReadRef = useRef(onMarkAsRead);

  const isOnline = onlineUsers.some((id) => sameUserId(id, contact._id));
  const typingUser = typingUsers[conversation._id];
  const latestContact = allUsers?.find((u) => sameUserId(u._id, contact._id)) || contact;

  useEffect(() => { onMarkAsReadRef.current = onMarkAsRead; }, [onMarkAsRead]);

  useEffect(() => {
    setShowChatMenu(false);
    setShowSearchBar(false);
    setSearchQuery('');
    setShowContactInfo(false);
  }, [conversation._id]);

  useEffect(() => {
    if (!showChatMenu) return;
    const onDocClick = (e) => {
      const inMenu = chatMenuRef.current?.contains(e.target);
      const inBtn = chatMenuBtnRef.current?.contains(e.target);
      if (!inMenu && !inBtn) setShowChatMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showChatMenu]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior }); }, 50);
  }, []);

  const handleScroll = useCallback(() => {
    if (!messagesAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data } = await getMessages(conversation._id, 1, currentUser._id);
        setMessages(data.messages);
        scrollToBottom('auto');
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    };

    if (prevConversationId.current && prevConversationId.current !== conversation._id) {
      leaveConversation(prevConversationId.current);
    }

    joinConversation(conversation._id);
    prevConversationId.current = conversation._id;
    fetchMessages();

    // Reset reply/edit state on conversation change
    setReplyingTo(null);
    setEditingMessage(null);

    markAsRead(conversation._id, currentUser._id).catch(() => {});
    if (onMarkAsReadRef.current) onMarkAsReadRef.current(conversation._id);

    return () => { leaveConversation(conversation._id); };
  }, [conversation._id, currentUser._id, scrollToBottom]);

  // Socket listeners for ALL message events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.conversationId === conversation._id) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
        if (message.sender._id !== currentUser._id && message.sender !== currentUser._id) {
          markAsRead(conversation._id, currentUser._id).catch(() => {});
          if (onMarkAsReadRef.current) onMarkAsReadRef.current(conversation._id);
          playNotificationSound();
        }
      }
    };

    const handleMessagesRead = ({ conversationId, userId }) => {
      if (conversationId === conversation._id && userId !== currentUser._id) {
        if (contact.isGroup) {
          // For groups, re-fetch messages to get accurate status
          // (server determines if ALL participants read -> 'read' status)
          getMessages(conversation._id, 1, currentUser._id).then(({ data }) => {
            setMessages(data.messages);
          }).catch(() => {});
        } else {
          // For 1:1, mark sender's messages as read immediately
          setMessages((prev) => prev.map((msg) =>
            (msg.sender._id === currentUser._id || msg.sender === currentUser._id) ? { ...msg, status: 'read' } : msg
          ));
        }
      }
    };

    const handleMessageStatusUpdate = ({ messageId, status }) => {
      setMessages((prev) => prev.map((msg) => msg._id === messageId ? { ...msg, status } : msg));
    };

    // Phase 2: Delete listener
    const handleMessageDeleted = ({ messageId, deleteType }) => {
      if (deleteType === 'everyone') {
        setMessages((prev) => prev.map((msg) =>
          msg._id === messageId ? { ...msg, deletedForEveryone: true, text: '' } : msg
        ));
      }
    };

    // Phase 2: Edit listener
    const handleMessageEdited = ({ messageId, text, edited }) => {
      setMessages((prev) => prev.map((msg) =>
        msg._id === messageId ? { ...msg, text, edited } : msg
      ));
    };

    // Phase 2: Reaction listener
    const handleMessageReaction = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((msg) =>
        msg._id === messageId ? { ...msg, reactions } : msg
      ));
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('messageStatusUpdate', handleMessageStatusUpdate);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageReaction', handleMessageReaction);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('messageStatusUpdate', handleMessageStatusUpdate);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageReaction', handleMessageReaction);
    };
  }, [conversation._id, currentUser._id, scrollToBottom]);

  // === Phase 2 Handlers ===

  // Send (with reply support)
  const handleSend = async (payload) => {
    const text = payload?.text || '';
    if (!text.trim() && !payload?.fileUrl) return;
    try {
      const { data } = await sendMessage({
        conversationId: conversation._id,
        sender: currentUser._id,
        text,
        replyTo: replyingTo?._id || null,
        type: payload?.type || 'text',
        fileUrl: payload?.fileUrl || '',
        fileName: payload?.fileName || '',
        fileSize: payload?.fileSize || 0,
        mimeType: payload?.mimeType || '',
        durationSec: payload?.durationSec || 0,
      });
      setMessages((prev) => {
        if (prev.find((m) => m._id === data._id)) return prev;
        return [...prev, data];
      });
      scrollToBottom();
      setReplyingTo(null);
      onMessageSent();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Reply
  const handleReply = (message) => {
    setEditingMessage(null);
    setReplyingTo(message);
  };

  // Edit
  const handleStartEdit = (message) => {
    setReplyingTo(null);
    setEditingMessage(message);
  };

  const handleSaveEdit = async (messageId, newText) => {
    try {
      await editMessage(messageId, currentUser._id, newText);
      setMessages((prev) => prev.map((msg) =>
        msg._id === messageId ? { ...msg, text: newText, edited: true } : msg
      ));
      setEditingMessage(null);
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  // Delete
  const handleDelete = async (messageId, deleteType) => {
    try {
      const res = await deleteMessage(messageId, currentUser._id, deleteType);
      console.log('Delete response:', res.data);
      if (deleteType === 'me') {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      }
      // For 'everyone', the socket event 'messageDeleted' will handle UI update
      // but also update locally for immediate feedback
      if (deleteType === 'everyone') {
        setMessages((prev) => prev.map((msg) =>
          msg._id === messageId ? { ...msg, deletedForEveryone: true, text: '' } : msg
        ));
      }
    } catch (err) {
      console.error('Failed to delete message:', err?.response?.data || err);
    }
  };

  // React — update locally + socket event updates for other users
  const handleReact = async (messageId, emoji) => {
    try {
      const { data } = await reactToMessage(messageId, currentUser._id, emoji);
      // Update locally immediately for sender
      setMessages((prev) => prev.map((msg) =>
        msg._id === messageId ? { ...msg, reactions: data.reactions } : msg
      ));
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  // Forward
  const handleForwardStart = (message) => {
    setForwardingMessage(message);
  };

  const handleForwardTo = async (targetConversationId) => {
    try {
      await forwardMessage(forwardingMessage._id, currentUser._id, targetConversationId);
      setForwardingMessage(null);
      onMessageSent();
    } catch (err) {
      console.error('Failed to forward:', err);
    }
  };

  // Typing
  const handleTyping = () => { emitTyping(conversation._id, currentUser._id, currentUser.name); };
  const handleStopTyping = () => { emitStopTyping(conversation._id, currentUser._id); };

  const getPeerConnection = (targetUserId) => {
    if (peerRef.current) return peerRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit('call:ice-candidate', { toUserId: targetUserId, payload: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        [remoteVideoRef.current.srcObject] = [event.streams[0]];
        remoteVideoRef.current.play?.().catch(() => {});
      }
    };
    peerRef.current = pc;
    return pc;
  };

  const setupLocalMedia = async (mode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  const endCall = useCallback((notify = true) => {
    if (notify && !contact.isGroup) {
      getSocket()?.emit('call:end', { toUserId: contact._id });
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    setCallState({ open: false, mode: 'voice', status: '', isIncoming: false, fromUserId: null });
  }, [contact._id, contact.isGroup]);

  const startCall = async (mode) => {
    if (contact.isGroup) return;
    try {
      setCallState({ open: true, mode, status: 'Calling...', isIncoming: false, fromUserId: null });
      const socket = getSocket();
      const stream = await setupLocalMedia(mode);
      const pc = getPeerConnection(contact._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('call:offer', { toUserId: contact._id, payload: { sdp: offer, mode } });
    } catch (err) {
      console.error('Failed to start call:', err);
      endCall(false);
    }
  };

  const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || '?';

  const formatLastSeen = () => {
    if (isOnline) return 'online';
    const lastSeen = latestContact.lastSeen;
    if (lastSeen) {
      const date = new Date(lastSeen);
      const now = new Date();
      const diff = now - date;
      const oneDay = 24 * 60 * 60 * 1000;
      if (diff < oneDay) return `last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return '';
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const dateObj = new Date(msg.createdAt);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  const formatDateLabel = (dateStr) => {
    const date = new Date(`${dateStr}T00:00:00`);
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;
    if (diff < oneDay && date.getDate() === now.getDate()) return 'TODAY';
    if (diff < 2 * oneDay) return 'YESTERDAY';
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  };

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchMatches([]);
      setActiveSearchIndex(-1);
      return;
    }
    const matches = messages.filter((m) => {
      if (m.deletedForEveryone) return false;
      if (m.type === 'text' || !m.type) {
        return (m.text || '').toLowerCase().includes(q);
      }
      if (m.type === 'document') {
        return (m.fileName || '').toLowerCase().includes(q);
      }
      return false;
    }).map((m) => m._id);
    setSearchMatches(matches);
    setActiveSearchIndex(matches.length ? 0 : -1);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (activeSearchIndex < 0 || activeSearchIndex >= searchMatches.length) return;
    const id = searchMatches[activeSearchIndex];
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight-message');
    const t = setTimeout(() => el.classList.remove('highlight-message'), 1400);
    return () => clearTimeout(t);
  }, [activeSearchIndex, searchMatches]);

  const goToNextSearchMatch = () => {
    if (!searchMatches.length) return;
    setActiveSearchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const goToPrevSearchMatch = () => {
    if (!searchMatches.length) return;
    setActiveSearchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const openContactInfo = async () => {
    if (!contact.isGroup && !latestContact?.about) {
      try {
        const { data } = await updateUser(contact._id, {
          name: latestContact?.name || contact.name,
          about: 'Hey there! I am using WhatsApp.',
          avatar: latestContact?.avatar || contact.avatar || '',
          phone: latestContact?.phone || '',
        });
        onUserDataUpdated?.(data);
      } catch (err) {
        console.error('Failed to initialize contact info:', err);
      }
    }
    setShowContactInfo(true);
  };

  useEffect(() => {
    if (!showContactInfo || contact.isGroup) return;
    setContactEditPhone(String(latestContact.phone ?? ''));
    setContactEditAbout(String(latestContact.about ?? ''));
  }, [showContactInfo, contact.isGroup, latestContact.phone, latestContact.about, latestContact._id]);

  useEffect(() => {
    if (!showContactInfo || contact.isGroup || !onUserDataUpdated) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getUser(contact._id);
        if (!cancelled) onUserDataUpdated(data);
      } catch (err) {
        console.error('Failed to refresh contact info:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showContactInfo, contact._id, contact.isGroup, onUserDataUpdated]);

  const saveContactInfo = async (e) => {
    e?.preventDefault?.();
    if (contact.isGroup) return;
    try {
      setContactInfoSaving(true);
      const { data } = await updateUser(contact._id, {
        name: latestContact.name || contact.name,
        about: contactEditAbout.trim(),
        phone: contactEditPhone.trim(),
        avatar: latestContact.avatar || contact.avatar || '',
      });
      onUserDataUpdated?.(data);
    } catch (err) {
      console.error('Failed to save contact:', err);
    } finally {
      setContactInfoSaving(false);
    }
  };

  const isImageMessage = (msg) => {
    if (!msg) return false;
    if (msg.type === 'image' && msg.fileUrl) return true;
    return Boolean(msg.fileUrl && msg.mimeType?.startsWith('image/'));
  };

  useEffect(() => {
    if (pendingRemoteCall && !contact.isGroup && sameUserId(pendingRemoteCall.fromUserId, contact._id)) {
      pendingOfferRef.current = pendingRemoteCall.sdp;
      pendingIceRef.current = [...(pendingRemoteCall.iceCandidates || [])];
      setCallState({
        open: true,
        mode: pendingRemoteCall.mode || 'voice',
        status: 'Incoming call',
        isIncoming: true,
        fromUserId: pendingRemoteCall.fromUserId,
      });
      onPendingRemoteCallConsumed?.();
    }
  }, [pendingRemoteCall, contact._id, contact.isGroup, onPendingRemoteCallConsumed]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || contact.isGroup) return;

    const onOffer = async ({ fromUserId, payload }) => {
      if (!sameUserId(fromUserId, contact._id)) return;
      setCallState({ open: true, mode: payload.mode || 'voice', status: 'Incoming call', isIncoming: true, fromUserId });
      pendingOfferRef.current = payload.sdp;
    };
    const onAnswer = async ({ fromUserId, payload }) => {
      if (!sameUserId(fromUserId, contact._id) || !peerRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      setCallState((prev) => ({ ...prev, status: 'Connected', isIncoming: false }));
    };
    const onIce = async ({ fromUserId, payload }) => {
      if (!sameUserId(fromUserId, contact._id)) return;
      if (!peerRef.current) {
        pendingIceRef.current.push(payload);
        return;
      }
      await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
    };
    const onReject = ({ fromUserId }) => {
      if (!sameUserId(fromUserId, contact._id)) return;
      endCall(false);
    };
    const onEnd = ({ fromUserId }) => {
      if (!sameUserId(fromUserId, contact._id)) return;
      endCall(false);
    };

    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIce);
    socket.on('call:reject', onReject);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIce);
      socket.off('call:reject', onReject);
      socket.off('call:end', onEnd);
    };
  }, [contact._id, contact.isGroup, endCall]);

  const acceptCall = async () => {
    try {
      const stream = await setupLocalMedia(callState.mode);
      const pc = getPeerConnection(callState.fromUserId);
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      }
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      if (pendingIceRef.current.length > 0) {
        for (const ice of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(ice));
        }
        pendingIceRef.current = [];
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('call:answer', { toUserId: callState.fromUserId, payload: { sdp: answer } });
      pendingOfferRef.current = null;
      setCallState((prev) => ({ ...prev, status: 'Connected', isIncoming: false }));
    } catch (err) {
      console.error('Failed to accept call:', err);
      setCallState((prev) => ({ ...prev, status: 'Failed to connect. Try again.' }));
    }
  };

  const declineCall = () => {
    if (callState.fromUserId) {
      getSocket()?.emit('call:reject', { toUserId: callState.fromUserId });
    }
    endCall(false);
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={onBack} title="Back">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l1.4 1.4L7.8 11H20v2H7.8l5.6 5.6L12 20l-8-8z"/></svg>
        </button>
        <div className={`chat-avatar ${contact.isGroup ? 'group-avatar' : ''}`} style={{ width: 40, height: 40, fontSize: 16 }}>
          {contact.isGroup ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.9 }}>
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          ) : (
            <>
              {contact.avatar ? <img src={resolveMediaUrl(contact.avatar)} alt={contact.name} className="avatar-img" /> : getInitials(contact.name)}
              {isOnline && <span className="online-dot" style={{ width: 10, height: 10 }} />}
            </>
          )}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{contact.name}</div>
          <div className={`chat-header-status ${!contact.isGroup && isOnline ? 'online' : ''} ${typingUser ? 'typing' : ''}`}>
            {typingUser ? 'typing...' : (
              contact.isGroup
                ? (contact.participants?.map((p) => p.name || 'You').join(', ') || 'Group')
                : formatLastSeen()
            )}
          </div>
        </div>
        <div className="chat-header-actions">
          {!contact.isGroup && (
            <>
              <button className="icon-btn" title="Voice call" onClick={() => startCall('voice')}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.054 15.054 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.1.37 2.28.57 3.48.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.74 21 3 13.26 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.38.57 3.48a1 1 0 0 1-.24 1.01l-2.21 2.3z"/></svg>
              </button>
              <button className="icon-btn" title="Video call" onClick={() => startCall('video')}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4z"/></svg>
              </button>
            </>
          )}
          <button className="icon-btn" title="Search" onClick={() => { setShowSearchBar((v) => !v); setShowChatMenu(false); }}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>
          </button>
          <button ref={chatMenuBtnRef} className="icon-btn" title="Menu" onClick={() => setShowChatMenu((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/></svg>
          </button>
          {showChatMenu && (
            <div ref={chatMenuRef} className="chat-menu-dropdown">
              <div className="dropdown-item" onClick={() => { navigator.clipboard.writeText(contact.name || '').catch(() => {}); setShowChatMenu(false); }}>Copy contact name</div>
              <div className="dropdown-item" onClick={() => { openContactInfo(); setShowChatMenu(false); }}>Contact info</div>
              <div className="dropdown-item" onClick={() => { messagesAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); setShowChatMenu(false); }}>Go to first message</div>
              <div className="dropdown-item" onClick={() => { scrollToBottom(); setShowChatMenu(false); }}>Go to latest message</div>
              <div className="dropdown-item" onClick={() => { (onCloseChat || onBack)(); setShowChatMenu(false); }}>Close chat</div>
            </div>
          )}
        </div>
      </div>

      {showSearchBar && (
        <div className="chat-search-bar">
          <input
            type="text"
            placeholder="Search messages"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="chat-search-controls">
            <span>{searchMatches.length ? `${activeSearchIndex + 1}/${searchMatches.length}` : '0/0'}</span>
            <button className="icon-btn small" title="Previous match" onClick={goToPrevSearchMatch}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
            </button>
            <button className="icon-btn small" title="Next match" onClick={goToNextSearchMatch}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
            </button>
            <button className="icon-btn small" title="Close search" onClick={() => { setShowSearchBar(false); setSearchQuery(''); }}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="messages-area" ref={messagesAreaRef} onScroll={handleScroll}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="date-divider"><span>{formatDateLabel(date)}</span></div>
                {(() => {
                  const items = [];
                  for (let i = 0; i < msgs.length; i++) {
                    const msg = msgs[i];
                    const senderId = msg.sender._id || msg.sender;
                    const prev = msgs[i - 1];
                    const showTail = i === 0 || ((prev.sender._id || prev.sender) !== senderId);

                    if (isImageMessage(msg)) {
                      const group = [msg];
                      let j = i + 1;
                      while (j < msgs.length) {
                        const next = msgs[j];
                        const nextSender = next.sender._id || next.sender;
                        if (nextSender !== senderId || !isImageMessage(next)) break;
                        group.push(next);
                        j += 1;
                      }
                      items.push({ kind: 'image-group', messages: group, showTail });
                      i = j - 1;
                      continue;
                    }

                    items.push({ kind: 'single', message: msg, showTail });
                  }

                  return items.map((item) => {
                    const firstMsg = item.kind === 'image-group' ? item.messages[0] : item.message;
                    const isSent = ((firstMsg.sender?._id) || firstMsg.sender) === currentUser._id;
                    return (
                      <MessageBubble
                        key={item.kind === 'image-group' ? item.messages.map((m) => m._id).join('-') : item.message._id}
                        message={firstMsg}
                        imageGroup={item.kind === 'image-group' ? item.messages : null}
                        isSent={isSent}
                        showTail={item.showTail}
                        currentUserId={currentUser._id}
                        onReply={handleReply}
                        onEdit={handleStartEdit}
                        onDelete={handleDelete}
                        onReact={handleReact}
                        onForward={handleForwardStart}
                        isGroup={!!contact.isGroup}
                      />
                    );
                  });
                })()}
              </div>
            ))}
            {typingUser && (
              <div className="message-wrapper received">
                <div className="message-bubble received" style={{ padding: '8px 12px' }}>
                  <div className="typing-indicator">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button className="scroll-to-bottom-btn" onClick={() => scrollToBottom()} title="Scroll to bottom">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
        </button>
      )}

      {/* Message Input */}
      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={handleSaveEdit}
      />

      {/* Forward Modal */}
      {forwardingMessage && (
        <ForwardModal
          conversations={conversations || []}
          currentUserId={currentUser._id}
          onForward={handleForwardTo}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      <CallModal
        open={callState.open}
        mode={callState.mode}
        status={callState.status}
        contactName={contact.name}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteAudioRef={remoteAudioRef}
        isIncoming={callState.isIncoming}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={() => endCall(true)}
      />

      {showContactInfo && (
        <div className="modal-overlay" onClick={() => setShowContactInfo(false)}>
          <div className="modal-content contact-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button className="modal-close" onClick={() => setShowContactInfo(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
              <h3>{latestContact.name || contact.name}</h3>
            </div>
            <div className="contact-info-body">
              <div className="chat-avatar" style={{ width: 72, height: 72, fontSize: 28 }}>
                {(latestContact.avatar || contact.avatar) ? (
                  <img src={resolveMediaUrl(latestContact.avatar || contact.avatar)} alt="" className="avatar-img" />
                ) : (
                  getInitials(latestContact.name || contact.name)
                )}
              </div>
              <p><strong>Status:</strong> {formatLastSeen() || 'offline'}</p>
              {!contact.isGroup && (
                <form className="auth-form" style={{ marginTop: 12, gap: 10 }} onSubmit={saveContactInfo}>
                  <div className="input-group">
                    <label htmlFor="contact-phone">Phone</label>
                    <input
                      id="contact-phone"
                      type="tel"
                      value={contactEditPhone}
                      onChange={(e) => setContactEditPhone(e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="contact-about">About</label>
                    <input
                      id="contact-about"
                      type="text"
                      value={contactEditAbout}
                      onChange={(e) => setContactEditAbout(e.target.value)}
                      maxLength={140}
                      placeholder="About"
                    />
                  </div>
                  <button type="submit" className="auth-btn" disabled={contactInfoSaving}>
                    {contactInfoSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              )}
              {contact.isGroup && <p><strong>Members:</strong> {contact.participants?.length || 0}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
