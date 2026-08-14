const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { registerUser, loginUser, logoutUser, getMe, submitKYC, getVolunteerStats, updateLanguage } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Multer config for KYC Uploads
const kycDir = path.join(__dirname, '..', 'uploads', 'kyc');
if (!fs.existsSync(kycDir)) {
  fs.mkdirSync(kycDir, { recursive: true });
}

const kycStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(kycDir)) {
      fs.mkdirSync(kycDir, { recursive: true });
    }
    cb(null, kycDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `kyc-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const uploadKyc = multer({
  storage: kycStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const kycFields = uploadKyc.fields([
  { name: 'govtIdCard', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]);

router.post('/register', kycFields, registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.post('/kyc', protect, kycFields, submitKYC);
router.get('/volunteer-stats/:id', protect, getVolunteerStats);
router.patch('/language', protect, updateLanguage);

module.exports = router;
