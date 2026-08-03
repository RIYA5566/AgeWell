const express = require('express');
const router = express.Router();
const { getFamilyDashboard } = require('../controllers/familyController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All family routes require authentication + family role
router.use(protect);
router.use(authorize('family'));

// GET /api/family/dashboard
router.get('/dashboard', getFamilyDashboard);

module.exports = router;
