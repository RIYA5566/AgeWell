const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpRequest',
    default: null
  },
  type: {
    type: String,
    enum: ['direct', 'task'],
    default: 'direct'
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  lastMessage: {
    type: String,
    trim: true,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  lastMessageSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ taskId: 1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
