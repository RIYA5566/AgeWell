const HelpRequest = require('../models/HelpRequest');
const User = require('../models/User');

// ─── Helper: check if a senior has any linked family members ──────────────
const seniorHasFamily = async (seniorId) => {
  const count = await User.countDocuments({ role: 'family', linkedSenior: seniorId });
  return count > 0;
};

// @desc    Create a new help request
// @route   POST /api/requests
// @access  Private (Senior Citizens only)
exports.createRequest = async (req, res) => {
  try {
    const { title, description, category, urgency } = req.body;
    const audioFile = req.file ? `/uploads/audio/${req.file.filename}` : '';

    // Ensure at least some content was provided
    const hasCategory = category && category !== 'Other';
    const hasTitle = title && title.trim().length > 0;
    const hasDescription = description && description.trim().length > 0;
    const hasAudio = !!req.file;

    if (!hasCategory && !hasTitle && !hasDescription && !hasAudio) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least a category, title, description, or voice recording'
      });
    }

    // Auto-generate a default title if not provided
    const finalTitle = (title && title.trim())
      ? title.trim()
      : `Help Request - ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const newRequest = new HelpRequest({
      title: finalTitle,
      description: description || '',
      category: category || 'Other',
      urgency: urgency || 'low',
      audioFile,
      senior: req.user.id,
      status: 'pending'
    });

    const request = await newRequest.save();
    res.status(201).json({ success: true, message: 'Help request created successfully', request });
  } catch (error) {
    console.error('Create Request Error Details:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating request' });
  }
};

// @desc    Get all requests (role-filtered)
// @route   GET /api/requests
// @access  Private
exports.getRequests = async (req, res) => {
  try {
    let requests;

    if (req.user.role === 'senior') {
      // Seniors see only their own requests
      requests = await HelpRequest.find({ senior: req.user.id })
        .populate('volunteer', 'name phone email skills')
        .populate('familyReviewedBy', 'name relationship')
        .sort({ createdAt: -1 });

    } else if (req.user.role === 'volunteer') {
      // Volunteers see: all pending + their own (awaiting/accepted/completed)
      requests = await HelpRequest.find({
        $or: [
          { status: 'pending' },
          { volunteer: req.user.id }
        ]
      })
        .populate('senior', 'name phone address emergencyContact')
        .populate('volunteer', 'name phone email')
        .sort({ createdAt: -1 });

    } else if (req.user.role === 'family') {
      // Family sees all requests for their linked senior
      if (!req.user.linkedSenior) {
        return res.status(400).json({ success: false, message: 'No senior linked to this family account.' });
      }
      requests = await HelpRequest.find({ senior: req.user.linkedSenior })
        .populate('senior', 'name phone address emergencyContact')
        .populate('volunteer', 'name phone email skills')
        .populate('familyReviewedBy', 'name relationship')
        .sort({ createdAt: -1 });

    } else if (req.user.role === 'admin') {
      requests = await HelpRequest.find()
        .populate('senior', 'name email phone address')
        .populate('volunteer', 'name email phone')
        .populate('familyReviewedBy', 'name relationship')
        .sort({ createdAt: -1 });
    }

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('Get Requests Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching requests' });
  }
};

// @desc    Get single request details
// @route   GET /api/requests/:id
// @access  Private
exports.getRequestById = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id)
      .populate('senior', 'name phone address email emergencyContact')
      .populate('volunteer', 'name phone email skills')
      .populate('familyReviewedBy', 'name relationship');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    // Role-based access check
    if (req.user.role === 'senior' && request.senior._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }
    if (req.user.role === 'family' && request.senior._id.toString() !== req.user.linkedSenior?.toString()) {
      return res.status(403).json({ success: false, message: 'This request does not belong to your linked senior' });
    }

    res.status(200).json({ success: true, request });
  } catch (error) {
    console.error('Get Request Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving request details' });
  }
};

// @desc    Update a help request (title/description while still pending)
// @route   PUT /api/requests/:id
// @access  Private (Senior Citizens only)
exports.updateRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id);

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.senior.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Cannot edit a request that is no longer pending' });
    }

    const { title, description, category, urgency } = req.body;
    request.title = title || request.title;
    request.description = description || request.description;
    request.category = category || request.category;
    request.urgency = urgency || request.urgency;
    request = await request.save();

    res.status(200).json({ success: true, message: 'Request updated successfully', request });
  } catch (error) {
    console.error('Update Request Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating request' });
  }
};

// @desc    Delete / cancel a request
// @route   DELETE /api/requests/:id
// @access  Private (Senior or Admin)
exports.deleteRequest = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (req.user.role !== 'admin' && request.senior.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this request' });
    }
    if (req.user.role !== 'admin' && request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Cannot delete a request that has already been accepted' });
    }

    await HelpRequest.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Help request cancelled successfully' });
  } catch (error) {
    console.error('Delete Request Error:', error);
    res.status(500).json({ success: false, message: 'Server error cancelling request' });
  }
};

// @desc    Volunteer accepts a request
//          → moves to 'awaiting_approval' if senior has family, else straight to 'accepted'
// @route   PUT /api/requests/:id/accept
// @access  Private (Volunteers only)
exports.acceptRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id);

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request is no longer available to accept' });
    }

    // Assign volunteer
    request.volunteer = req.user.id;

    // Determine if senior has any linked family members
    const hasFamilyCaregiver = await seniorHasFamily(request.senior);

    if (hasFamilyCaregiver) {
      // Wait for family approval before officially accepted
      request.status = 'awaiting_approval';
      request.familyApprovalStatus = 'none';
    } else {
      // No family linked — skip straight to accepted
      request.status = 'accepted';
      request.familyApprovalStatus = 'approved'; // implicitly auto-approved
      request.acceptedAt = Date.now();
    }

    await request.save();

    request = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email');

    const message = hasFamilyCaregiver
      ? 'Request accepted! Waiting for family/caregiver approval before you can proceed.'
      : 'Request accepted! The senior has no caregiver link — you may proceed immediately.';

    res.status(200).json({ success: true, message, request, awaitingFamilyApproval: hasFamilyCaregiver });
  } catch (error) {
    console.error('Accept Request Error:', error);
    res.status(500).json({ success: false, message: 'Server error accepting request' });
  }
};

// @desc    Family/Caregiver APPROVES the volunteer
//          → moves request to 'accepted'; volunteer may now proceed
// @route   PUT /api/requests/:id/family-approve
// @access  Private (Family only)
exports.familyApproveRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id)
      .populate('senior', 'name');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'This request is not pending family approval' });
    }

    // Verify this family member is linked to the request's senior
    if (req.user.linkedSenior?.toString() !== request.senior._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the caregiver for this senior' });
    }

    request.status = 'accepted';
    request.familyApprovalStatus = 'approved';
    request.familyReviewedBy = req.user.id;
    request.familyReviewedAt = Date.now();
    request.acceptedAt = Date.now();
    await request.save();

    request = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: `Volunteer approved! They can now proceed to assist ${request.senior.name}.`,
      request
    });
  } catch (error) {
    console.error('Family Approve Error:', error);
    res.status(500).json({ success: false, message: 'Server error approving volunteer' });
  }
};

// @desc    Family/Caregiver REJECTS the volunteer
//          → request resets to 'pending'; volunteer is unassigned
// @route   PUT /api/requests/:id/family-reject
// @access  Private (Family only)
exports.familyRejectRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id)
      .populate('senior', 'name');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'This request is not pending family approval' });
    }

    // Verify caregiver link
    if (req.user.linkedSenior?.toString() !== request.senior._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the caregiver for this senior' });
    }

    const { rejectionReason } = req.body;

    // Reset back to pending and clear volunteer assignment
    request.status = 'pending';
    request.familyApprovalStatus = 'rejected';
    request.familyReviewedBy = req.user.id;
    request.familyReviewedAt = Date.now();
    request.familyRejectionReason = rejectionReason || 'Rejected by family caregiver';
    request.volunteer = null;
    request.acceptedAt = undefined;
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Volunteer rejected. The request has been reset and is available for other volunteers.',
      request
    });
  } catch (error) {
    console.error('Family Reject Error:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting volunteer' });
  }
};

// @desc    Volunteer / Admin completes a request
// @route   PUT /api/requests/:id/complete
// @access  Private (Volunteer or Admin)
exports.completeRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id);

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'accepted') {
      return res.status(400).json({ success: false, message: 'Request must be in accepted status to mark complete' });
    }
    if (req.user.role !== 'admin' && request.volunteer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this request' });
    }

    const { resolutionNotes } = req.body;
    request.status = 'completed';
    request.completedAt = Date.now();
    request.resolutionNotes = resolutionNotes || 'Assistance successfully provided.';
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Request marked as completed. Thank you for your service!',
      request
    });
  } catch (error) {
    console.error('Complete Request Error:', error);
    res.status(500).json({ success: false, message: 'Server error completing request' });
  }
};
