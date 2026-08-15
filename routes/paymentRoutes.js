const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentStatus
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All payment routes require authentication
router.use(protect);

// POST /api/payments/create-order  → Create a Razorpay order (server-side amount)
router.post('/create-order', authorize('family'), createRazorpayOrder);

// POST /api/payments/verify        → Verify HMAC signature & execute lifecycle
router.post('/verify', authorize('family'), verifyRazorpayPayment);

// GET  /api/payments/status/:requestId → Get payment history for a request
router.get('/status/:requestId', authorize('family', 'admin'), getPaymentStatus);

module.exports = router;
