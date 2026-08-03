const User = require('../models/User');
const HelpRequest = require('../models/HelpRequest');

// @desc    Get dashboard metrics and stats
// @route   GET /api/admin/stats
// @access  Private (Admin only)
exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers        = await User.countDocuments();
    const seniorsCount      = await User.countDocuments({ role: 'senior' });
    const volunteersCount   = await User.countDocuments({ role: 'volunteer' });
    const familyCount       = await User.countDocuments({ role: 'family' });
    const adminsCount       = await User.countDocuments({ role: 'admin' });

    const totalRequests         = await HelpRequest.countDocuments();
    const pendingCount          = await HelpRequest.countDocuments({ status: 'pending' });
    const awaitingApprovalCount = await HelpRequest.countDocuments({ status: 'awaiting_approval' });
    const acceptedCount         = await HelpRequest.countDocuments({ status: 'accepted' });
    const completedCount        = await HelpRequest.countDocuments({ status: 'completed' });
    const emergencyCount        = await HelpRequest.countDocuments({ urgency: 'emergency' });

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          seniors: seniorsCount,
          volunteers: volunteersCount,
          family: familyCount,
          admins: adminsCount
        },
        requests: {
          total: totalRequests,
          pending: pendingCount,
          awaitingApproval: awaitingApprovalCount,
          accepted: acceptedCount,
          completed: completedCount,
          emergency: emergencyCount
        }
      }
    });
  } catch (error) {
    console.error('Get Admin Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching admin stats' });
  }
};

// @desc    Get list of all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching users list' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting oneself
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    // Clean up request references (or assign back to pending if accepted, etc.)
    // For simplicity, let's remove requests created by this senior, or free up requests accepted by this volunteer
    if (user.role === 'senior') {
      await HelpRequest.deleteMany({ senior: userId });
    } else if (user.role === 'volunteer') {
      // Revert accepted requests back to pending
      await HelpRequest.updateMany(
        { volunteer: userId, status: 'accepted' },
        { $set: { volunteer: null, status: 'pending', acceptedAt: null } }
      );
    }

    res.status(200).json({
      success: true,
      message: `User ${user.name} and their associated data managed successfully`
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting user' });
  }
};
