const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const {
  createRequest,
  getRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  acceptRequest,
  completeRequest,
  familyApproveRequest,
  familyRejectRequest
} = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/authMiddleware');

const fs = require('fs');

// ─── Multer config for audio uploads ──────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'audio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter: function (req, file, cb) {
    // Accept audio and webm/mp4 recordings from browser MediaRecorder
    if (
      !file.mimetype ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/webm') ||
      file.mimetype.startsWith('video/mp4') ||
      file.mimetype.includes('webm') ||
      file.mimetype.includes('ogg') ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Middleware wrapper to handle Multer errors cleanly
const handleAudioUpload = (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      console.error('Multer Audio Upload Error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Error uploading audio file' });
    }
    next();
  });
};

// All request routes require authentication
router.use(protect);

router.route('/')
  .post(authorize('senior'), handleAudioUpload, createRequest)
  .get(getRequests);

router.route('/:id')
  .get(getRequestById)
  .put(authorize('senior'), updateRequest)
  .delete(authorize('senior', 'admin'), deleteRequest);

// Volunteer workflow
router.put('/:id/accept',   authorize('volunteer'),        acceptRequest);
router.put('/:id/complete', authorize('volunteer', 'admin'), completeRequest);

// Family/Caregiver approval workflow
router.put('/:id/family-approve', authorize('family'), familyApproveRequest);
router.put('/:id/family-reject',  authorize('family'), familyRejectRequest);

module.exports = router;
