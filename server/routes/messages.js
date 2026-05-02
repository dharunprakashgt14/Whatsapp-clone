const express = require('express'); // import express
const router = express.Router(); // create router
const Message = require('../models/Message'); // import message model
const Conversation = require('../models/Conversation'); // import conversation model
const { isUserOnline } = require('../socket/socketHandler'); // import online check function

// Send a message
router.post('/', async (req, res) => { // route to send message
  try {
    const {
      conversationId, // conversation id
      sender, // sender id
      text, // message text
      replyTo, // reply message reference
      forwarded, // forwarded flag
      type = 'text', // message type
      fileUrl = '', // file URL
      fileName = '', // file name
      fileSize = 0, // file size
      mimeType = '', // file type
      durationSec = 0, // duration for media
    } = req.body;

    if (!conversationId || !sender) { // validate required fields
      return res.status(400).json({ error: 'conversationId and sender are required' });
    }

    const trimmedText = (text || '').trim(); // clean text
    const hasFile = Boolean(fileUrl); // check file existence
    if (!trimmedText && !hasFile) { // validate message content
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const conversation = await Conversation.findById(conversationId); // fetch conversation
    if (!conversation) { // check existence
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const receiverId = conversation.participants.find( // find receiver
      (p) => p.toString() !== sender
    );

    const initialStatus = receiverId && isUserOnline(receiverId.toString()) // check online
      ? 'delivered'
      : 'sent';

    const message = new Message({ // create message
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
    await message.save(); // save message

    conversation.lastMessage = { // update last message
      text: trimmedText || (type === 'voice' ? 'Voice message' : (fileName || 'Attachment')),
      sender,
      timestamp: message.createdAt,
    };

    conversation.participants.forEach((participantId) => { // update unread count
      if (participantId.toString() !== sender) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });

    await conversation.save(); // save conversation

    const populatedMessage = await Message.findById(message._id) // populate message
      .populate('sender', 'name email avatar')
      .populate({
        path: 'replyTo',
        select: 'text sender',
        populate: { path: 'sender', select: 'name' },
      });

    const io = req.app.get('io'); // get socket instance

    io.to(conversationId).emit('newMessage', populatedMessage); // emit to room

    conversation.participants.forEach((participantId) => { // emit to users
      io.to(participantId.toString()).emit('newMessage', populatedMessage);
    });

    conversation.participants.forEach((participantId) => { // emit conversation update
      io.to(participantId.toString()).emit('conversationUpdated', {
        conversationId,
        lastMessage: conversation.lastMessage,
        unreadCount: conversation.unreadCount.get(participantId.toString()) || 0,
      });
    });

    if (initialStatus === 'delivered') { // update delivery status
      io.to(conversationId).emit('messageStatusUpdate', {
        messageId: populatedMessage._id.toString(),
        status: 'delivered',
      });
      io.to(sender).emit('messageStatusUpdate', {
        messageId: populatedMessage._id.toString(),
        status: 'delivered',
      });
    }

    res.status(201).json(populatedMessage); // send response
  } catch (err) {
    console.error('Send message error:', err); // log error
    res.status(500).json({ error: 'Server error' }); // error response
  }
});

// Get messages
router.get('/:conversationId', async (req, res) => { // fetch messages
  try {
    const { page = 1, limit = 50 } = req.query; // pagination
    const { userId } = req.query; // user id
    const skip = (page - 1) * limit; // calculate skip

    let query = { conversationId: req.params.conversationId }; // base query

    if (userId) { // exclude deleted messages
      query.deletedFor = { $ne: userId };
    }

    const messages = await Message.find(query) // fetch messages
      .populate('sender', 'name email avatar')
      .populate({
        path: 'replyTo',
        select: 'text sender deletedForEveryone',
        populate: { path: 'sender', select: 'name' },
      })
      .sort({ createdAt: 1 }) // sort ascending
      .skip(skip) // pagination skip
      .limit(parseInt(limit)); // pagination limit

    const transformedMessages = messages.map((msg) => { // transform messages
      const m = msg.toObject();
      if (m.deletedForEveryone) {
        m.text = ''; // hide text
      }
      return m;
    });

    const total = await Message.countDocuments(query); // total count

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
    res.status(500).json({ error: 'Server error' }); // error
  }
});

// Delete message
router.post('/:messageId/delete', async (req, res) => { // delete route
  try {
    const { userId, deleteType } = req.body; // inputs

    const message = await Message.findById(req.params.messageId); // find message

    if (!message) {
      return res.status(404).json({ error: 'Message not found' }); // not found
    }

    const io = req.app.get('io'); // socket

    if (deleteType === 'everyone') { // delete for all
      const msgSenderId = String(message.sender._id || message.sender); // sender id

      if (msgSenderId !== String(userId)) {
        return res.status(403).json({ error: 'Only the sender can delete for everyone' });
      }

      message.deletedForEveryone = true; // mark deleted
      message.text = ''; // clear text
      await message.save(); // save

      const conversation = await Conversation.findById(message.conversationId); // fetch convo
      if (conversation) {
        conversation.participants.forEach((p) => { // notify users
          io.to(p.toString()).emit('messageDeleted', {
            messageId: message._id.toString(),
            deleteType: 'everyone',
          });
        });
      }
    } else {
      if (!message.deletedFor.map(String).includes(String(userId))) { // delete for me
        message.deletedFor.push(userId);
        await message.save();
      }
    }

    res.json({ message: 'Message deleted', deleteType }); // response
  } catch (err) {
    res.status(500).json({ error: 'Server error' }); // error
  }
});

// Edit message
router.put('/:messageId', async (req, res) => { // edit route
  try {
    const { userId, text } = req.body; // inputs
    const message = await Message.findById(req.params.messageId); // find message

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const editSenderId = message.sender._id ? message.sender._id.toString() : message.sender.toString(); // sender id
    if (editSenderId !== userId) {
      return res.status(403).json({ error: 'Only the sender can edit the message' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }

    message.text = text.trim(); // update text
    message.edited = true; // mark edited
    await message.save(); // save

    const io = req.app.get('io'); // socket
    const conversation = await Conversation.findById(message.conversationId); // fetch convo
    if (conversation) {
      conversation.participants.forEach((p) => { // notify users
        io.to(p.toString()).emit('messageEdited', {
          messageId: message._id.toString(),
          text: message.text,
          edited: true,
        });
      });
    }

    res.json(message); // response
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// React to message
router.post('/:messageId/react', async (req, res) => { // reaction route
  try {
    const { userId, emoji } = req.body; // inputs
    const message = await Message.findById(req.params.messageId); // find message

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const currentUsers = message.reactions.get(emoji) || []; // get users
    const userIndex = currentUsers.indexOf(userId); // check user

    if (userIndex > -1) {
      currentUsers.splice(userIndex, 1); // remove reaction
      if (currentUsers.length === 0) {
        message.reactions.delete(emoji);
      } else {
        message.reactions.set(emoji, currentUsers);
      }
    } else {
      currentUsers.push(userId); // add reaction
      message.reactions.set(emoji, currentUsers);
    }

    await message.save(); // save

    const io = req.app.get('io'); // socket
    const reactionsObj = Object.fromEntries(message.reactions); // convert map
    const conversation = await Conversation.findById(message.conversationId); // convo
    if (conversation) {
      conversation.participants.forEach((p) => {
        io.to(p.toString()).emit('messageReaction', {
          messageId: message._id.toString(),
          reactions: reactionsObj,
        });
      });
    }

    res.json({ reactions: reactionsObj }); // response
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forward message
router.post('/forward', async (req, res) => { // forward route
  try {
    const { messageId, sender, targetConversationId } = req.body; // inputs

    const original = await Message.findById(messageId); // original msg
    if (!original) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    const conversation = await Conversation.findById(targetConversationId); // target convo
    if (!conversation) {
      return res.status(404).json({ error: 'Target conversation not found' });
    }

    const receiverId = conversation.participants.find((p) => p.toString() !== sender); // receiver
    const initialStatus = receiverId && isUserOnline(receiverId.toString()) ? 'delivered' : 'sent'; // status

    const forwardedMsg = new Message({ // create forwarded msg
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
    await forwardedMsg.save(); // save

    conversation.lastMessage = { // update last msg
      text: original.text || (original.type === 'voice' ? 'Voice message' : (original.fileName || 'Attachment')),
      sender,
      timestamp: forwardedMsg.createdAt,
    };

    conversation.participants.forEach((participantId) => { // unread count
      if (participantId.toString() !== sender) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });

    await conversation.save(); // save

    const populated = await Message.findById(forwardedMsg._id) // populate
      .populate('sender', 'name email avatar');

    const io = req.app.get('io'); // socket
    io.to(targetConversationId).emit('newMessage', populated); // emit
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('newMessage', populated);
      io.to(participantId.toString()).emit('conversationUpdated', {
        conversationId: targetConversationId,
        lastMessage: conversation.lastMessage,
        unreadCount: conversation.unreadCount.get(participantId.toString()) || 0,
      });
    });

    res.status(201).json(populated); // response
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search messages
router.get('/search/:conversationId', async (req, res) => { // search route
  try {
    const { q } = req.query; // query text
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const messages = await Message.find({ // search query
      conversationId: req.params.conversationId,
      text: { $regex: q.trim(), $options: 'i' },
      deletedForEveryone: { $ne: true },
    })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(messages); // response
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; // export router
