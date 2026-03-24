const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Create or get existing conversation between two users
router.post('/', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: 'senderId and receiverId are required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    }).populate('participants', '-password');

    if (conversation) {
      return res.json(conversation);
    }

    // Create new conversation
    conversation = new Conversation({
      participants: [senderId, receiverId],
    });
    await conversation.save();

    conversation = await Conversation.findById(conversation._id)
      .populate('participants', '-password');

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all conversations for a user
router.get('/:userId', async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.params.userId,
    })
      .populate('participants', '-password')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark messages as read in a conversation
router.put('/:conversationId/read', async (req, res) => {
  try {
    const { userId } = req.body;
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const io = req.app.get('io');

    if (conversation.isGroup) {
      // GROUP: Add this user to readBy for all unread messages
      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: { readBy: userId },
        }
      );

      // Find messages where ALL other participants have now read
      const otherParticipants = conversation.participants
        .filter((p) => p.toString() !== String(userId))
        .map((p) => p.toString());
      const totalOthers = otherParticipants.length;

      // Get messages from this conversation sent by the other participants
      // that now have readBy containing all other participants
      const allMessages = await Message.find({
        conversationId,
        sender: { $ne: userId },
      });

      for (const msg of allMessages) {
        const readByStrings = msg.readBy.map((r) => r.toString());
        // Count how many participants (excluding sender) have read this
        const otherReaders = conversation.participants
          .filter((p) => p.toString() !== msg.sender.toString())
          .map((p) => p.toString());
        const allRead = otherReaders.every((p) => readByStrings.includes(p));
        if (allRead && msg.status !== 'read') {
          msg.status = 'read';
          await msg.save();
        } else if (!allRead && msg.status !== 'read') {
          if (msg.status === 'sent') {
            msg.status = 'delivered';
            await msg.save();
          }
        }
      }

      // Emit read receipt to all participants
      conversation.participants.forEach((p) => {
        io.to(p.toString()).emit('messagesRead', { conversationId, userId });
      });
    } else {
      // 1:1 CHAT: Mark all as read immediately
      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: userId },
          status: { $ne: 'read' },
        },
        {
          $set: { status: 'read' },
          $addToSet: { readBy: userId },
        }
      );

      // Emit to conversation room + personal rooms
      io.to(conversationId).emit('messagesRead', { conversationId, userId });
      conversation.participants.forEach((p) => {
        io.to(p.toString()).emit('messagesRead', { conversationId, userId });
      });
    }

    // Reset unread count for this user
    if (conversation) {
      conversation.unreadCount.set(userId, 0);
      await conversation.save();
    }

    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a group conversation
router.post('/group', async (req, res) => {
  try {
    const { adminId, participantIds, groupName } = req.body;

    if (!adminId || !participantIds || participantIds.length < 1 || !groupName) {
      return res.status(400).json({ error: 'adminId, at least 1 participant, and groupName are required' });
    }

    // Ensure admin is included in participants
    const allParticipants = [...new Set([adminId, ...participantIds])];

    const conversation = new Conversation({
      participants: allParticipants,
      isGroup: true,
      groupName: groupName.trim(),
      groupAdmin: adminId,
    });
    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', '-password');

    // Notify all participants via socket
    const io = req.app.get('io');
    allParticipants.forEach((pId) => {
      io.to(pId.toString()).emit('newConversation', populated);
    });

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group (rename, add/remove members)
router.put('/:conversationId/group', async (req, res) => {
  try {
    const { userId, groupName, addMembers, removeMember } = req.body;
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Only admin can modify group
    if (conversation.groupAdmin.toString() !== userId) {
      return res.status(403).json({ error: 'Only the group admin can modify the group' });
    }

    if (groupName) {
      conversation.groupName = groupName.trim();
    }

    if (addMembers && addMembers.length > 0) {
      addMembers.forEach((memberId) => {
        if (!conversation.participants.includes(memberId)) {
          conversation.participants.push(memberId);
        }
      });
    }

    if (removeMember) {
      conversation.participants = conversation.participants.filter(
        (p) => p.toString() !== removeMember
      );
    }

    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', '-password');

    // Notify all participants
    const io = req.app.get('io');
    populated.participants.forEach((p) => {
      io.to(p._id.toString()).emit('conversationUpdated', {
        conversationId: conversation._id.toString(),
        lastMessage: conversation.lastMessage,
        unreadCount: 0,
      });
    });

    res.json(populated);
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
