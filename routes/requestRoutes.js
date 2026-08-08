const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const {
  createRequest,
  getRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  acceptRequest,
  submitPurchaseCost,
  approvePurchaseFunding,
  rejectPurchaseCost,
  completeRequest,
  familyApproveRequest,
  familyFulfillSelf,
  familyRejectRequest,
  verifyCompletionByFamily,
  verifyCompletionBySeniorVoice,
  submitFeedback
} = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ─── Multer config for Audio uploads ──────────────────────────────────────────
const audioDir = path.join(__dirname, '..', 'uploads', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
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

const handleAudioUpload = (req, res, next) => {
  uploadAudio.single('audio')(req, res, (err) => {
    if (err) {
      console.error('Multer Audio Upload Error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Error uploading audio file' });
    }
    next();
  });
};

// ─── Multer config for Receipt & Delivery Photo Proof Uploads ──────────────
const proofDir = path.join(__dirname, '..', 'uploads', 'proofs');
if (!fs.existsSync(proofDir)) {
  fs.mkdirSync(proofDir, { recursive: true });
}

const proofStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(proofDir)) {
      fs.mkdirSync(proofDir, { recursive: true });
    }
    cb(null, proofDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `proof-${uniqueSuffix}${ext}`);
  }
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed for receipt/delivery proof'), false);
    }
  }
});

const handleProofUpload = (req, res, next) => {
  // Catch any uploaded receipt or delivery proof photo file
  uploadProof.any()(req, res, (err) => {
    if (err) {
      console.error('Multer Proof Upload Error:', err);
      return res.status(400).json({ success: false, message: err.message || 'Error uploading delivery proof photo' });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
      console.log('📸 Delivery proof photo captured by Multer:', req.file.filename);
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

// Volunteer 11-step escrow workflow
router.put('/:id/accept',               authorize('volunteer'), acceptRequest);
router.put('/:id/submit-purchase-cost', authorize('volunteer'), handleProofUpload, submitPurchaseCost);
router.put('/:id/complete',             authorize('volunteer', 'admin'), handleProofUpload, completeRequest);

// Family/Caregiver volunteer approval, purchase funding & fulfillment workflow
router.put('/:id/family-approve',           authorize('family'), familyApproveRequest);
router.put('/:id/approve-purchase-funding', authorize('family'), approvePurchaseFunding);
router.put('/:id/reject-purchase-cost',     authorize('family'), rejectPurchaseCost);
router.put('/:id/family-fulfill', authorize('family'), familyFulfillSelf);
router.put('/:id/family-reject',  authorize('family'), familyRejectRequest);

// Task Completion Verification Workflow (Family Caregiver & Senior Voice IVR Call)
router.put('/:id/verify-completion-family', authorize('family'), verifyCompletionByFamily);
router.put('/:id/verify-completion-voice',  authorize('senior', 'admin'), verifyCompletionBySeniorVoice);

// Volunteer Feedback Submission Workflow
router.put('/:id/feedback', authorize('family', 'senior', 'admin'), submitFeedback);

module.exports = router;
