const express = require('express');
const router = express.Router();
const { getEarnings, withdrawEarnings } = require('../controllers/volunteerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All volunteer routes require authentication and the volunteer role
router.use(protect);
router.use(authorize('volunteer'));

// ─── Volunteer Wallet / Earnings ──────────────────────────────────────────────
// GET  /api/volunteer/earnings   → wallet summary + transaction history
// POST /api/volunteer/withdraw   → simulate a withdrawal
router.get('/earnings', getEarnings);
router.post('/withdraw', withdrawEarnings);

module.exports = router;
