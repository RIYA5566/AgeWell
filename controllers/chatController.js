const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const HelpRequest = require('../models/HelpRequest');
const cloudinary = require('../config/cloudinary');

// Helper to broadcast via Socket.IO if available
const emitSocketEvent = (req, room, event, data) => {
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(room).emit(event, data);
    }
  } catch (err) {
    console.warn('Socket broadcast warning:', err.message);
  }
};

// Helper: Ensure 3-way Task Conversation exists and is up to date
const ensureTaskConversation = async (taskId) => {
  const request = await HelpRequest.findById(taskId)
    .populate('senior', 'name role')
    .populate('volunteer', 'name role');

  if (!request) return null;

  const participantIds = [];
  if (request.senior) {
    participantIds.push(request.senior._id ? request.senior._id.toString() : request.senior.toString());
  }
  if (request.volunteer) {
    participantIds.push(request.volunteer._id ? request.volunteer._id.toString() : request.volunteer.toString());
  }

  // Also check if senior has a linked family caregiver
  if (request.senior) {
    const sId = request.senior._id || request.senior;
    const seniorUser = await User.findById(sId).select('linkedCaregiver');
    if (seniorUser && seniorUser.linkedCaregiver) {
      participantIds.push(seniorUser.linkedCaregiver.toString());
    }
    // Also look up caregivers linked to this senior
    const familyUsers = await User.find({ role: 'family', seniorEmail: seniorUser?.email }).select('_id');
    familyUsers.forEach(f => {
      const fId = f._id.toString();
      if (!participantIds.includes(fId)) participantIds.push(fId);
    });
  }

  const uniqueParticipants = [...new Set(participantIds)];

  let conversation = await Conversation.findOne({ taskId: request._id });
  if (!conversation) {
    conversation = await Conversation.create({
      taskId: request._id,
      type: 'task',
      title: `Task #${request._id.toString().slice(-4).toUpperCase()}: ${request.title}`,
      participants: uniqueParticipants,
      lastMessage: `Task chat initialized for: ${request.title}`,
      lastMessageAt: new Date()
    });

    // Create initial system announcement
    await Message.create({
      conversationId: conversation._id,
      senderId: null,
      senderRole: 'system',
      messageType: 'system',
      text: `Task chat active for "${request.title}". Senior, Caregiver, and Assigned Volunteer can now coordinate in real time.`
    });
  } else {
    // Ensure all current participants are joined
    let updated = false;
    uniqueParticipants.forEach(p => {
      if (!conversation.participants.some(cp => cp.toString() === p)) {
        conversation.participants.push(p);
        updated = true;
      }
    });
    if (updated) {
      await conversation.save();
    }
  }

  return conversation;
};

// @desc    Get all conversations for logged-in user
// @route   GET /api/chat/conversations
// @access  Private
exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Auto-discover user's active/assigned help requests and ensure 3-way task conversations exist
    try {
      let userTasks = [];
      if (req.user.role === 'volunteer') {
        userTasks = await HelpRequest.find({ volunteer: userId }).select('_id');
      } else if (req.user.role === 'senior') {
        userTasks = await HelpRequest.find({ senior: userId }).select('_id');
      } else if (req.user.role === 'family') {
        if (req.user.linkedSenior) {
          userTasks = await HelpRequest.find({ senior: req.user.linkedSenior }).select('_id');
        } else if (req.user.seniorEmail) {
          const linkedSeniorUser = await User.findOne({ email: req.user.seniorEmail, role: 'senior' }).select('_id');
          if (linkedSeniorUser) {
            userTasks = await HelpRequest.find({ senior: linkedSeniorUser._id }).select('_id');
          }
        }
      }
      
      for (const t of userTasks) {
        await ensureTaskConversation(t._id);
      }
    } catch (taskErr) {
      console.warn('Auto task conversation discovery warning:', taskErr.message);
    }

    // Find all conversations where user is participant
    const conversations = await Conversation.find({
      participants: userId,
      isArchived: false
    })
      .populate('participants', 'name email phone role verificationStatus isIdVerified isPoliceVerified')
      .populate('taskId', 'title category status urgency allowedBudget actualPurchaseCost serviceFee')
      .populate('lastMessageSender', 'name role')
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    const formatted = conversations.map(c => {
      const unreadCount = (c.unreadCounts && c.unreadCounts.get(userId.toString())) || 0;
      return {
        _id: c._id,
        taskId: c.taskId,
        type: c.type,
        title: c.title,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        lastMessageSender: c.lastMessageSender,
        participants: c.participants,
        unreadCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Get User Conversations Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving conversations' });
  }
};

// @desc    Get or create direct conversation with another user
// @route   POST /api/chat/direct
// @access  Private
exports.getOrCreateDirectConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }

    if (recipientId.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
    }

    const recipient = await User.findById(recipientId).select('name role email phone verificationStatus');
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient user not found' });
    }

    // Check if direct conversation already exists between these 2 users
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [userId, recipientId], $size: 2 }
    })
      .populate('participants', 'name email phone role verificationStatus isIdVerified isPoliceVerified')
      .populate('lastMessageSender', 'name role');

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'direct',
        participants: [userId, recipientId],
        title: `${req.user.name} & ${recipient.name}`,
        lastMessage: 'Conversation started',
        lastMessageAt: new Date()
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name email phone role verificationStatus isIdVerified isPoliceVerified');
    }

    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Direct Conversation Error:', error);
    res.status(500).json({ success: false, message: 'Server error creating direct conversation' });
  }
};

// @desc    Get or create 3-way Task conversation
// @route   POST /api/chat/task/:taskId
// @access  Private
exports.getOrCreateTaskConversation = async (req, res) => {
  try {
    const { taskId } = req.params;
    const conversation = await ensureTaskConversation(taskId);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    // Verify user is allowed to access this task chat
    const isParticipant = conversation.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not a participant in this task chat' });
    }

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name email phone role verificationStatus isIdVerified isPoliceVerified')
      .populate('taskId', 'title category status urgency allowedBudget actualPurchaseCost serviceFee merchantDetails')
      .populate('lastMessageSender', 'name role');

    res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    console.error('Task Conversation Error:', error);
    res.status(500).json({ success: false, message: 'Server error creating task conversation' });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/conversations/:id/messages
// @access  Private
exports.getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Security Check: is caller a participant?
    const isParticipant = conversation.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. You are not a participant in this conversation.' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const messages = await Message.find({ conversationId: id })
      .populate('senderId', 'name role verificationStatus')
      .sort({ createdAt: 1 })
      .limit(limit);

    // Auto mark as read for this user
    if (conversation.unreadCounts) {
      conversation.unreadCounts.set(req.user._id.toString(), 0);
      await conversation.save();
    }

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving messages' });
  }
};

// @desc    Send a message in a conversation
// @route   POST /api/chat/conversations/:id/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, messageType = 'text', attachmentUrl, actionData } = req.body;

    if (!text && !attachmentUrl && !actionData) {
      return res.status(400).json({ success: false, message: 'Message content or attachment is required' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Security Check: is caller a participant?
    const isParticipant = conversation.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Cannot send message to this conversation.' });
    }

    const message = await Message.create({
      conversationId: id,
      senderId: req.user._id,
      senderRole: req.user.role,
      text: text || '',
      messageType,
      attachmentUrl: attachmentUrl || null,
      actionData: actionData || null,
      readBy: [req.user._id]
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name role verificationStatus');

    // Update conversation metadata & unread counts
    let lastMsgPreview = text || (messageType === 'image' ? '📷 Photo attached' : (messageType === 'purchase_request' ? '💰 Purchase Request' : '📎 Attachment'));
    conversation.lastMessage = lastMsgPreview;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSender = req.user._id;

    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }

    // Increment unread count for all other participants
    conversation.participants.forEach(p => {
      const pStr = p.toString();
      if (pStr !== req.user._id.toString()) {
        const currentCount = conversation.unreadCounts.get(pStr) || 0;
        conversation.unreadCounts.set(pStr, currentCount + 1);
      }
    });

    await conversation.save();

    // Broadcast message to Socket.IO room
    emitSocketEvent(req, id, 'newMessage', populatedMessage);

    // Also notify individual user channels for badge increment
    conversation.participants.forEach(p => {
      const pStr = p.toString();
      if (pStr !== req.user._id.toString()) {
        emitSocketEvent(req, `user_${pStr}`, 'conversationUpdated', {
          conversationId: id,
          lastMessage: lastMsgPreview,
          lastMessageAt: conversation.lastMessageAt,
          senderName: req.user.name
        });
      }
    });

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};

// @desc    Upload media attachment for chat
// @route   POST /api/chat/conversations/:id/upload
// @access  Private
exports.uploadChatAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    let attachmentUrl = '';
    let metadata = {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };

    // Upload to Cloudinary if available
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'agewell/chat_attachments',
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      attachmentUrl = result.secure_url;
    } catch (uploadErr) {
      console.warn('Cloudinary chat upload fallback:', uploadErr.message);
      // Local fallback
      attachmentUrl = `/uploads/${req.file.filename || req.file.originalname}`;
    }

    const messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    const message = await Message.create({
      conversationId: id,
      senderId: req.user._id,
      senderRole: req.user.role,
      text: req.body.caption || (messageType === 'image' ? 'Photo attached' : 'File attached'),
      messageType,
      attachmentUrl,
      attachmentMetadata: metadata,
      readBy: [req.user._id]
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name role verificationStatus');

    conversation.lastMessage = messageType === 'image' ? '📷 Photo' : '📎 Attachment';
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSender = req.user._id;

    if (!conversation.unreadCounts) conversation.unreadCounts = new Map();
    conversation.participants.forEach(p => {
      const pStr = p.toString();
      if (pStr !== req.user._id.toString()) {
        const c = conversation.unreadCounts.get(pStr) || 0;
        conversation.unreadCounts.set(pStr, c + 1);
      }
    });
    await conversation.save();

    emitSocketEvent(req, id, 'newMessage', populatedMessage);

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Chat Upload Error:', error);
    res.status(500).json({ success: false, message: 'Server error uploading chat attachment' });
  }
};

// @desc    Mark conversation as read
// @route   PATCH /api/chat/conversations/:id/read
// @access  Private
exports.markConversationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (conversation.unreadCounts) {
      conversation.unreadCounts.set(userId.toString(), 0);
      await conversation.save();
    }

    await Message.updateMany(
      { conversationId: id, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ success: false, message: 'Server error marking conversation as read' });
  }
};

// @desc    Get total unread message count for current user
// @route   GET /api/chat/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const conversations = await Conversation.find({ participants: req.user._id });

    let totalUnread = 0;
    conversations.forEach(c => {
      if (c.unreadCounts) {
        totalUnread += (c.unreadCounts.get(userId) || 0);
      }
    });

    res.status(200).json({
      success: true,
      unreadCount: totalUnread
    });
  } catch (error) {
    console.error('Unread Count Error:', error);
    res.status(500).json({ success: false, message: 'Server error counting unread messages' });
  }
};

// Export helper for external system card broadcasts (requests & payments)
exports.ensureTaskConversation = ensureTaskConversation;
exports.emitSocketEvent = emitSocketEvent;
