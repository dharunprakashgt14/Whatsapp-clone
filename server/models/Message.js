const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    default: '',
    trim: true,
  },
  type: {
    type: String,
    enum: ['text', 'document', 'voice', 'image', 'video', 'audio'],
    default: 'text',
  },
  fileUrl: {
    type: String,
    default: '',
  },
  fileName: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  mimeType: {
    type: String,
    default: '',
  },
  durationSec: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  // Track which users have read this message (for group blue ticks)
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Reply/Quote support
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  // Edit support
  edited: {
    type: Boolean,
    default: false,
  },
  // Delete support
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  deletedForEveryone: {
    type: Boolean,
    default: false,
  },
  // Reactions — emoji key maps to array of user IDs
  reactions: {
    type: Map,
    of: [String],
    default: {},
  },
  // Forward support
  forwarded: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Index for efficient message queries
messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
