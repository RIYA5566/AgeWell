const express = require('express');
const router = express.Router();
const { getAdminStats, getAllUsers, deleteUser, verifyVolunteer } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.put('/volunteers/:id/verify', verifyVolunteer);

module.exports = router;
