const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { isUserOnline } = require('../socket/socketHandler');

// Send a message
router.post('/', async (req, res) => {
  try {
    const {
      conversationId,
      sender,
      text,
      replyTo,
      forwarded,
      type = 'text',
      fileUrl = '',
      fileName = '',
      fileSize = 0,
      mimeType = '',
      durationSec = 0,
    } = req.body;

    if (!conversationId || !sender) {
      return res.status(400).json({ error: 'conversationId and sender are required' });
    }

    const trimmedText = (text || '').trim();
    const hasFile = Boolean(fileUrl);
    if (!trimmedText && !hasFile) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Verify conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Determine the receiver
    const receiverId = conversation.participants.find(
      (p) => p.toString() !== sender
    );

    // Check if receiver is online — if so, mark as delivered immediately
    const initialStatus = receiverId && isUserOnline(receiverId.toString()) ? 'delivered' : 'sent';

    const message = new Message({
      conversationId,
      sender,
      text: trimmedText,
      status: initialStatus,
      replyTo: replyTo || null,
      forwarded: forwarded || false,
      type,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      durationSec,
    });
    await message.save();

    // Update conversation's last message
    conversation.lastMessage = {
      text: trimmedText || (type === 'voice' ? 'Voice message' : (fileName || 'Attachment')),
      sender,
      timestamp: message.createdAt,
    };

    // Increment unread count for other participants
    conversation.participants.forEach((participantId) => {
      if (participantId.toString() !== sender) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });

    await conversation.save();

    // Populate sender info and replyTo
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email avatar')
      .populate({
        path: 'replyTo',
        select: 'text sender',
        populate: { path: 'sender', select: 'name' },
      });

    // Emit message via Socket.IO
    const io = req.app.get('io');

    // Emit to the conversation room
    io.to(conversationId).emit('newMessage', populatedMessage);

    // Also emit to each participant's personal room (for users not yet in the conversation room)
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('newMessage', populatedMessage);
    });

    // Emit conversation update to all participants
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('conversationUpdated', {
        conversationId,
        lastMessage: conversation.lastMessage,
        unreadCount: conversation.unreadCount.get(participantId.toString()) || 0,
      });
    });

    // If message was auto-delivered, notify the sender about the delivery status
    if (initialStatus === 'delivered') {
      io.to(conversationId).emit('messageStatusUpdate', {
        messageId: populatedMessage._id.toString(),
        status: 'delivered',
      });
      io.to(sender).emit('messageStatusUpdate', {
        messageId: populatedMessage._id.toString(),
        status: 'delivered',
      });
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a conversation
router.get('/:conversationId', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { userId } = req.query;
    const skip = (page - 1) * limit;

    let query = { conversationId: req.params.conversationId };

    // Exclude messages deleted for this user
    if (userId) {
      query.deletedFor = { $ne: userId };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name email avatar')
      .populate({
        path: 'replyTo',
        select: 'text sender deletedForEveryone',
        populate: { path: 'sender', select: 'name' },
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Transform deleted-for-everyone messages
    const transformedMessages = messages.map((msg) => {
      const m = msg.toObject();
      if (m.deletedForEveryone) {
        m.text = '';
      }
      return m;
    });

    const total = await Message.countDocuments(query);

    res.json({
      messages: transformedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a message (using POST because DELETE body is unreliable)
router.post('/:messageId/delete', async (req, res) => {
  try {
    const { userId, deleteType } = req.body; // deleteType: 'me' or 'everyone'
    console.log(`[DELETE] messageId=${req.params.messageId} userId=${userId} deleteType=${deleteType}`);

    const message = await Message.findById(req.params.messageId);

    if (!message) {
      console.log('[DELETE] Message not found');
      return res.status(404).json({ error: 'Message not found' });
    }

    const io = req.app.get('io');

    if (deleteType === 'everyone') {
      // Only sender can delete for everyone
      const msgSenderId = String(message.sender._id || message.sender);
      console.log(`[DELETE] Comparing sender=${msgSenderId} vs userId=${userId}`);

      if (msgSenderId !== String(userId)) {
        console.log('[DELETE] DENIED: Not the sender');
        return res.status(403).json({ error: 'Only the sender can delete for everyone' });
      }

      message.deletedForEveryone = true;
      message.text = '';
      await message.save();
      console.log('[DELETE] Message marked as deletedForEveryone in DB');

      // Notify all users in conversation via personal rooms
      const conversation = await Conversation.findById(message.conversationId);
      if (conversation) {
        conversation.participants.forEach((p) => {
          io.to(p.toString()).emit('messageDeleted', {
            messageId: message._id.toString(),
            deleteType: 'everyone',
          });
        });
        console.log(`[DELETE] Emitted messageDeleted to ${conversation.participants.length} participants`);
      }
    } else {
      // Delete for me — just add user to deletedFor array
      if (!message.deletedFor.map(String).includes(String(userId))) {
        message.deletedFor.push(userId);
        await message.save();
        console.log('[DELETE] Message deleted for user:', userId);
      }
    }

    res.json({ message: 'Message deleted', deleteType });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Edit a message
router.put('/:messageId', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const editSenderId = message.sender._id ? message.sender._id.toString() : message.sender.toString();
    if (editSenderId !== userId) {
      return res.status(403).json({ error: 'Only the sender can edit the message' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }

    message.text = text.trim();
    message.edited = true;
    await message.save();

    const io = req.app.get('io');
    // Emit to each participant's personal room (reliable cross-user delivery)
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      conversation.participants.forEach((p) => {
        io.to(p.toString()).emit('messageEdited', {
          messageId: message._id.toString(),
          text: message.text,
          edited: true,
        });
      });
    }

    res.json(message);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle reaction on a message
router.post('/:messageId/react', async (req, res) => {
  try {
    const { userId, emoji } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Get current users for this emoji
    const currentUsers = message.reactions.get(emoji) || [];
    const userIndex = currentUsers.indexOf(userId);

    if (userIndex > -1) {
      // Remove reaction
      currentUsers.splice(userIndex, 1);
      if (currentUsers.length === 0) {
        message.reactions.delete(emoji);
      } else {
        message.reactions.set(emoji, currentUsers);
      }
    } else {
      // Add reaction
      currentUsers.push(userId);
      message.reactions.set(emoji, currentUsers);
    }

    await message.save();

    const io = req.app.get('io');
    const reactionsObj = Object.fromEntries(message.reactions);
    // Emit to each participant's personal room (reliable cross-user delivery)
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      conversation.participants.forEach((p) => {
        io.to(p.toString()).emit('messageReaction', {
          messageId: message._id.toString(),
          reactions: reactionsObj,
        });
      });
    }

    res.json({ reactions: reactionsObj });
  } catch (err) {
    console.error('React to message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forward a message
router.post('/forward', async (req, res) => {
  try {
    const { messageId, sender, targetConversationId } = req.body;

    const original = await Message.findById(messageId);
    if (!original) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    const conversation = await Conversation.findById(targetConversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Target conversation not found' });
    }

    const receiverId = conversation.participants.find(
      (p) => p.toString() !== sender
    );
    const initialStatus = receiverId && isUserOnline(receiverId.toString()) ? 'delivered' : 'sent';

    const forwardedMsg = new Message({
      conversationId: targetConversationId,
      sender,
      text: original.text,
      status: initialStatus,
      forwarded: true,
      type: original.type || 'text',
      fileUrl: original.fileUrl || '',
      fileName: original.fileName || '',
      fileSize: original.fileSize || 0,
      mimeType: original.mimeType || '',
      durationSec: original.durationSec || 0,
    });
    await forwardedMsg.save();

    // Update conversation
    conversation.lastMessage = {
      text: original.text || (original.type === 'voice' ? 'Voice message' : (original.fileName || 'Attachment')),
      sender,
      timestamp: forwardedMsg.createdAt,
    };
    conversation.participants.forEach((participantId) => {
      if (participantId.toString() !== sender) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });
    await conversation.save();

    const populated = await Message.findById(forwardedMsg._id)
      .populate('sender', 'name email avatar');

    const io = req.app.get('io');
    io.to(targetConversationId).emit('newMessage', populated);
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('newMessage', populated);
      io.to(participantId.toString()).emit('conversationUpdated', {
        conversationId: targetConversationId,
        lastMessage: conversation.lastMessage,
        unreadCount: conversation.unreadCount.get(participantId.toString()) || 0,
      });
    });

    res.status(201).json(populated);
  } catch (err) {
    console.error('Forward message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search messages
router.get('/search/:conversationId', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const messages = await Message.find({
      conversationId: req.params.conversationId,
      text: { $regex: q.trim(), $options: 'i' },
      deletedForEveryone: { $ne: true },
    })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(messages);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
