const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  senderRole: {
    type: String,
    enum: ['senior', 'family', 'volunteer', 'admin', 'system'],
    default: 'system'
  },
  text: {
    type: String,
    trim: true,
    default: ''
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'purchase_request', 'payment_success', 'task_event', 'system'],
    default: 'text'
  },
  attachmentUrl: {
    type: String,
    default: null
  },
  attachmentMetadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String
  },
  actionData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
