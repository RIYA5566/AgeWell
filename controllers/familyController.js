const HelpRequest = require('../models/HelpRequest');
const User = require('../models/User');

// @desc    Get family dashboard — all requests for linked senior + notification count
// @route   GET /api/family/dashboard
// @access  Private (Family only)
exports.getFamilyDashboard = async (req, res) => {
  try {
    if (!req.user.linkedSenior) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not linked to any Senior Citizen. Please contact support.'
      });
    }

    // Fetch all requests for the linked senior
    let requests = await HelpRequest.find({ senior: req.user.linkedSenior })
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
      .populate('volunteerQuotes.volunteer', 'name phone email skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
      .populate('familyReviewedBy', 'name relationship')
      .sort({ createdAt: -1 });

    // Convert mongoose documents to plain objects to append tasksCompleted field
    requests = JSON.parse(JSON.stringify(requests));

    for (const r of requests) {
      if (r.volunteer) {
        const volId = typeof r.volunteer === 'object' ? r.volunteer._id : r.volunteer;
        r.volunteer.tasksCompleted = await HelpRequest.countDocuments({ volunteer: volId, status: 'completed' });
      }
      if (r.volunteerQuotes) {
        for (const q of r.volunteerQuotes) {
          if (q.volunteer) {
            const volId = typeof q.volunteer === 'object' ? q.volunteer._id : q.volunteer;
            q.volunteer.tasksCompleted = await HelpRequest.countDocuments({ volunteer: volId, status: 'completed' });
          }
        }
      }
    }

    // Requests specifically waiting for THIS family member's approval
    const pendingApprovals = requests.filter(r => r.status === 'awaiting_approval');

    // Fetch the linked senior's profile for display
    const senior = await User.findById(req.user.linkedSenior).select('name phone address emergencyContact email');

    res.status(200).json({
      success: true,
      senior,
      pendingApprovalCount: pendingApprovals.length,
      requests
    });
  } catch (error) {
    console.error('Family Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Server error loading family dashboard' });
  }
};
