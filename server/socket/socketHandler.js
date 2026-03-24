const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

function isUserOnline(userId) {
  const sockets = onlineUsers.get(userId);
  return sockets && sockets.size > 0;
}

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // User joins with their userId
    socket.on('userOnline', async (userId) => {
      if (!userId) return;

      socket.userId = userId;

      // Add this socket to user's set of connections
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      // Join personal room for notifications
      socket.join(userId);

      // Update user online status in DB
      try {
        await User.findByIdAndUpdate(userId, { online: true });
      } catch (err) {
        console.error('Error updating user status:', err.message);
      }

      // Auto-deliver all pending 'sent' messages to this user
      try {
        const userConversations = await Conversation.find({ participants: userId });
        const conversationIds = userConversations.map((c) => c._id);

        const undeliveredMessages = await Message.find({
          conversationId: { $in: conversationIds },
          sender: { $ne: userId },
          status: 'sent',
        });

        if (undeliveredMessages.length > 0) {
          await Message.updateMany(
            {
              _id: { $in: undeliveredMessages.map((m) => m._id) },
            },
            { $set: { status: 'delivered' } }
          );

          // Notify senders about delivery
          undeliveredMessages.forEach((msg) => {
            io.to(msg.conversationId.toString()).emit('messageStatusUpdate', {
              messageId: msg._id.toString(),
              status: 'delivered',
            });
          });
        }
      } catch (err) {
        console.error('Error auto-delivering messages:', err.message);
      }

      // Broadcast online status to all clients
      io.emit('userStatusChanged', { userId, online: true });

      // Send current online users list to this socket
      socket.emit('onlineUsers', getOnlineUserIds());

      console.log(`👤 User ${userId} is online (${onlineUsers.get(userId).size} sockets). Total online users: ${onlineUsers.size}`);
    });

    // Join a conversation room
    socket.on('joinConversation', (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`📝 Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leaveConversation', (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId);
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, userId, userName }) => {
      socket.to(conversationId).emit('userTyping', {
        conversationId,
        userId,
        userName,
      });
    });

    // Stop typing
    socket.on('stopTyping', ({ conversationId, userId }) => {
      socket.to(conversationId).emit('userStoppedTyping', {
        conversationId,
        userId,
      });
    });

    // 1:1 call signaling relay (room name must match String(userId) from socket.join)
    const callRoom = (id) => (id == null ? '' : String(id));

    socket.on('call:offer', ({ toUserId, payload }) => {
      const room = callRoom(toUserId);
      if (!room) return;
      io.to(room).emit('call:offer', { fromUserId: socket.userId, payload });
    });

    socket.on('call:answer', ({ toUserId, payload }) => {
      const room = callRoom(toUserId);
      if (!room) return;
      io.to(room).emit('call:answer', { fromUserId: socket.userId, payload });
    });

    socket.on('call:ice-candidate', ({ toUserId, payload }) => {
      const room = callRoom(toUserId);
      if (!room) return;
      io.to(room).emit('call:ice-candidate', { fromUserId: socket.userId, payload });
    });

    socket.on('call:reject', ({ toUserId }) => {
      const room = callRoom(toUserId);
      if (!room) return;
      io.to(room).emit('call:reject', { fromUserId: socket.userId });
    });

    socket.on('call:end', ({ toUserId }) => {
      const room = callRoom(toUserId);
      if (!room) return;
      io.to(room).emit('call:end', { fromUserId: socket.userId });
    });

    // Message delivered (kept for manual delivery acknowledgement)
    socket.on('messageDelivered', ({ messageId, conversationId }) => {
      socket.to(conversationId).emit('messageStatusUpdate', {
        messageId,
        status: 'delivered',
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const userId = socket.userId;
      if (userId && onlineUsers.has(userId)) {
        // Remove THIS specific socket from the user's set
        onlineUsers.get(userId).delete(socket.id);

        // Only mark user as offline if they have ZERO remaining sockets
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);

          const lastSeen = new Date();
          try {
            await User.findByIdAndUpdate(userId, { online: false, lastSeen });
          } catch (err) {
            console.error('Error updating user status:', err.message);
          }

          io.emit('userStatusChanged', { userId, online: false, lastSeen: lastSeen.toISOString() });
          console.log(`👤 User ${userId} went offline. Total online users: ${onlineUsers.size}`);
        } else {
          console.log(`🔌 Socket removed for user ${userId} (${onlineUsers.get(userId).size} sockets remaining)`);
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupSocket, isUserOnline, getOnlineUserIds };
