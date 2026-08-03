const express = require('express');
const router = express.Router();
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

// All request routes require authentication
router.use(protect);

router.route('/')
  .post(authorize('senior'), createRequest)
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
