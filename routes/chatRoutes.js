const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  getUserConversations,
  getOrCreateDirectConversation,
  getOrCreateTaskConversation,
  getConversationMessages,
  sendMessage,
  uploadChatAttachment,
  markConversationRead,
  getUnreadCount
} = require('../controllers/chatController');

// Multer memory storage for chat attachments (photos, bills, audio, documents)
const chatStorage = multer.memoryStorage();
const uploadChatMedia = multer({
  storage: chatStorage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// All chat routes require authenticated session
router.use(protect);

router.get('/conversations', getUserConversations);
router.get('/unread-count', getUnreadCount);

router.post('/direct', getOrCreateDirectConversation);
router.post('/task/:taskId', getOrCreateTaskConversation);

router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/upload', uploadChatMedia.single('file'), uploadChatAttachment);
router.patch('/conversations/:id/read', markConversationRead);

module.exports = router;
