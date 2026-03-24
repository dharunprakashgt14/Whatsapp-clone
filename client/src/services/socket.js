import { io } from 'socket.io-client';

import { SERVER_BASE_URL } from './api';

const SOCKET_URL = SERVER_BASE_URL;

let socket = null;
let currentUserId = null;

export const connectSocket = (userId) => {
  // If already connected with same user, just return existing socket
  if (socket && socket.connected && currentUserId === userId) {
    return socket;
  }

  // If socket exists but for different user, disconnect first
  if (socket && currentUserId !== userId) {
    socket.disconnect();
    socket = null;
  }

  // If socket exists but is disconnected, clean it up
  if (socket && !socket.connected) {
    socket.removeAllListeners();
    socket = null;
  }

  currentUserId = userId;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    socket.emit('userOnline', userId);
  });

  socket.on('reconnect', () => {
    console.log('Socket reconnected:', socket.id);
    socket.emit('userOnline', userId);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};

export const joinConversation = (conversationId) => {
  if (socket && socket.connected) {
    socket.emit('joinConversation', conversationId);
  }
};

export const leaveConversation = (conversationId) => {
  if (socket && socket.connected) {
    socket.emit('leaveConversation', conversationId);
  }
};

export const emitTyping = (conversationId, userId, userName) => {
  if (socket && socket.connected) {
    socket.emit('typing', { conversationId, userId, userName });
  }
};

export const emitStopTyping = (conversationId, userId) => {
  if (socket && socket.connected) {
    socket.emit('stopTyping', { conversationId, userId });
  }
};

export default {
  connectSocket,
  getSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
  emitTyping,
  emitStopTyping,
};
