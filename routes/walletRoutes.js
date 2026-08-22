const express = require('express');
const router = express.Router();
const {
  getCaregiverWallet,
  topUpCaregiverWallet,
  getWalletTransactions,
  getReservedFundTasks
} = require('../controllers/walletController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All wallet routes require authentication
router.use(protect);

// GET  /api/wallet/caregiver             → Get caregiver wallet balances & stats
router.get('/caregiver', authorize('family', 'admin'), getCaregiverWallet);

// POST /api/wallet/caregiver/topup       → Add money to wallet via simulated mock gateway
router.post('/caregiver/topup', authorize('family'), topUpCaregiverWallet);

// GET  /api/wallet/caregiver/transactions → Get transaction history with filtering
router.get('/caregiver/transactions', authorize('family', 'admin'), getWalletTransactions);

// GET  /api/wallet/caregiver/reserved-tasks → Get active funded tasks with reserved funds
router.get('/caregiver/reserved-tasks', authorize('family', 'admin'), getReservedFundTasks);

module.exports = router;
