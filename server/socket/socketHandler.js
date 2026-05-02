const User = require('../models/User'); // import user model
const Message = require('../models/Message'); // import message model
const Conversation = require('../models/Conversation'); // import conversation model

const onlineUsers = new Map(); // store online users (userId -> socketIds)

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys()); // return all online userIds
}

function isUserOnline(userId) {
  const sockets = onlineUsers.get(userId); // get sockets for user
  return sockets && sockets.size > 0; // check if user has active sockets
}

function setupSocket(io) { // initialize socket
  io.on('connection', (socket) => { // on client connect
    console.log(`🔌 Socket connected: ${socket.id}`); // log connection

    socket.on('userOnline', async (userId) => { // user comes online
      if (!userId) return; // validate userId

      socket.userId = userId; // attach userId to socket

      if (!onlineUsers.has(userId)) { // check if user exists
        onlineUsers.set(userId, new Set()); // create set
      }
      onlineUsers.get(userId).add(socket.id); // add socketId

      socket.join(userId); // join personal room

      try {
        await User.findByIdAndUpdate(userId, { online: true }); // mark user online
      } catch (err) {
        console.error('Error updating user status:', err.message); // log error
      }

      try {
        const userConversations = await Conversation.find({ participants: userId }); // get conversations
        const conversationIds = userConversations.map((c) => c._id); // extract ids

        const undeliveredMessages = await Message.find({ // find pending messages
          conversationId: { $in: conversationIds },
          sender: { $ne: userId },
          status: 'sent',
        });

        if (undeliveredMessages.length > 0) { // if messages exist
          await Message.updateMany( // update status
            { _id: { $in: undeliveredMessages.map((m) => m._id) } },
            { $set: { status: 'delivered' } }
          );

          undeliveredMessages.forEach((msg) => { // notify senders
            io.to(msg.conversationId.toString()).emit('messageStatusUpdate', {
              messageId: msg._id.toString(),
              status: 'delivered',
            });
          });
        }
      } catch (err) {
        console.error('Error auto-delivering messages:', err.message); // log error
      }

      io.emit('userStatusChanged', { userId, online: true }); // broadcast online status

      socket.emit('onlineUsers', getOnlineUserIds()); // send online users list

      console.log(`👤 User ${userId} is online (${onlineUsers.get(userId).size} sockets). Total online users: ${onlineUsers.size}`); // log
    });

    socket.on('joinConversation', (conversationId) => { // join room
      if (!conversationId) return; // validate
      socket.join(conversationId); // join conversation
      console.log(`📝 Socket ${socket.id} joined conversation ${conversationId}`); // log
    });

    socket.on('leaveConversation', (conversationId) => { // leave room
      if (!conversationId) return; // validate
      socket.leave(conversationId); // leave conversation
    });

    socket.on('typing', ({ conversationId, userId, userName }) => { // typing event
      socket.to(conversationId).emit('userTyping', { // notify others
        conversationId,
        userId,
        userName,
      });
    });

    socket.on('stopTyping', ({ conversationId, userId }) => { // stop typing
      socket.to(conversationId).emit('userStoppedTyping', { // notify others
        conversationId,
        userId,
      });
    });

    const callRoom = (id) => (id == null ? '' : String(id)); // helper for room id

    socket.on('call:offer', ({ toUserId, payload }) => { // send offer
      const room = callRoom(toUserId); // get room
      if (!room) return; // validate
      io.to(room).emit('call:offer', { fromUserId: socket.userId, payload }); // emit
    });

    socket.on('call:answer', ({ toUserId, payload }) => { // send answer
      const room = callRoom(toUserId); // get room
      if (!room) return; // validate
      io.to(room).emit('call:answer', { fromUserId: socket.userId, payload }); // emit
    });

    socket.on('call:ice-candidate', ({ toUserId, payload }) => { // ICE candidate
      const room = callRoom(toUserId); // get room
      if (!room) return; // validate
      io.to(room).emit('call:ice-candidate', { fromUserId: socket.userId, payload }); // emit
    });

    socket.on('call:reject', ({ toUserId }) => { // reject call
      const room = callRoom(toUserId); // get room
      if (!room) return; // validate
      io.to(room).emit('call:reject', { fromUserId: socket.userId }); // emit
    });

    socket.on('call:end', ({ toUserId }) => { // end call
      const room = callRoom(toUserId); // get room
      if (!room) return; // validate
      io.to(room).emit('call:end', { fromUserId: socket.userId }); // emit
    });

    socket.on('messageDelivered', ({ messageId, conversationId }) => { // manual delivery event
      socket.to(conversationId).emit('messageStatusUpdate', { // notify others
        messageId,
        status: 'delivered',
      });
    });

    socket.on('disconnect', async () => { // on disconnect
      const userId = socket.userId; // get userId

      if (userId && onlineUsers.has(userId)) { // check user
        onlineUsers.get(userId).delete(socket.id); // remove socket

        if (onlineUsers.get(userId).size === 0) { // no sockets left
          onlineUsers.delete(userId); // remove user

          const lastSeen = new Date(); // set last seen
          try {
            await User.findByIdAndUpdate(userId, { online: false, lastSeen }); // update DB
          } catch (err) {
            console.error('Error updating user status:', err.message); // log error
          }

          io.emit('userStatusChanged', { userId, online: false, lastSeen: lastSeen.toISOString() }); // broadcast
          console.log(`👤 User ${userId} went offline. Total online users: ${onlineUsers.size}`); // log
        } else {
          console.log(`🔌 Socket removed for user ${userId} (${onlineUsers.get(userId).size} sockets remaining)`); // log
        }
      }

      console.log(`🔌 Socket disconnected: ${socket.id}`); // log disconnect
    });
  });
}

module.exports = { setupSocket, isUserOnline, getOnlineUserIds }; // export functions
