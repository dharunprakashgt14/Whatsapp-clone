import axios from 'axios';

/** Backend origin (no trailing slash). Set VITE_SERVER_URL in Vercel / .env for production. */
const SERVER_BASE_URL =
  (import.meta.env.VITE_SERVER_URL && String(import.meta.env.VITE_SERVER_URL).replace(/\/$/, '')) ||
  'http://localhost:5000';

const API_BASE_URL = `${SERVER_BASE_URL}/api`;

export { SERVER_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('whatsapp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('whatsapp_user');
      localStorage.removeItem('whatsapp_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const sendOtp = (data) => api.post('/auth/send-otp', data);
export const verifyOtp = (data) => api.post('/auth/verify-otp', data);
export const logoutUser = (userId) => api.post(`/auth/logout/${userId}`);

// User APIs
export const getUsers = (excludeId) => api.get(`/users?exclude=${excludeId}`);
export const getUser = (id) => api.get(`/users/${id}`);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const uploadFile = (file, kind = 'documents') => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/uploads?kind=${encodeURIComponent(kind)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${SERVER_BASE_URL}${url}`;
};

// Conversation APIs
export const createConversation = (senderId, receiverId) =>
  api.post('/conversations', { senderId, receiverId });
export const getConversations = (userId) => api.get(`/conversations/${userId}`);
export const markAsRead = (conversationId, userId) =>
  api.put(`/conversations/${conversationId}/read`, { userId });

// Message APIs
export const sendMessage = (data) => api.post('/messages', data);
export const getMessages = (conversationId, page = 1, userId = '') =>
  api.get(`/messages/${conversationId}?page=${page}&userId=${userId}`);
export const deleteMessage = (messageId, userId, deleteType) =>
  api.post(`/messages/${messageId}/delete`, { userId, deleteType });
export const editMessage = (messageId, userId, text) =>
  api.put(`/messages/${messageId}`, { userId, text });
export const reactToMessage = (messageId, userId, emoji) =>
  api.post(`/messages/${messageId}/react`, { userId, emoji });
export const forwardMessage = (messageId, sender, targetConversationId) =>
  api.post('/messages/forward', { messageId, sender, targetConversationId });
export const searchMessages = (conversationId, query) =>
  api.get(`/messages/search/${conversationId}?q=${encodeURIComponent(query)}`);

// Group APIs
export const createGroup = (adminId, participantIds, groupName) =>
  api.post('/conversations/group', { adminId, participantIds, groupName });
export const updateGroup = (conversationId, userId, data) =>
  api.put(`/conversations/${conversationId}/group`, { userId, ...data });

export default api;
