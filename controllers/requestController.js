const HelpRequest = require('../models/HelpRequest');
const User = require('../models/User');
const { recommendPlatforms } = require('../utils/platformRecommender');

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
    const { title, description, category, urgency, transcript, aiConfidenceScore, aiLowConfidence, shoppingPreference } = req.body;
    const audioFile = req.file ? `/uploads/audio/${req.file.filename}` : '';

    // Ensure at least some content was provided
    const hasCategory = category && category !== 'Other';
    const hasTitle = title && title.trim().length > 0;
    const hasDescription = description && description.trim().length > 0;
    const hasTranscript = transcript && transcript.trim().length > 0;
    const hasAudio = !!req.file;

    if (!hasCategory && !hasTitle && !hasDescription && !hasTranscript && !hasAudio) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least a category, title, description, or voice recording'
      });
    }

    // Auto-generate a default title if not provided
    let finalTitle = (title && title.trim()) ? title.trim() : '';
    if (!finalTitle && hasTranscript) {
      finalTitle = transcript.trim().slice(0, 60);
      if (transcript.trim().length > 60) finalTitle += '...';
    }
    if (!finalTitle) {
      finalTitle = `Help Request - ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    // Parse AI confidence score & flag
    let parsedConfidence = parseInt(aiConfidenceScore, 10);
    if (isNaN(parsedConfidence)) {
      parsedConfidence = 85;
    }

    let isLowConfidence = aiLowConfidence === true || aiLowConfidence === 'true';
    if (hasTranscript && transcript.trim().length < 15) {
      isLowConfidence = true;
      if (parsedConfidence > 65) parsedConfidence = 55;
    }
    if (parsedConfidence < 70) {
      isLowConfidence = true;
    }

    // If senior has family caregiver, require family allotment first; otherwise approve for volunteers directly
    const hasFamily = await seniorHasFamily(req.user.id);
    const initialFamilyApproval = hasFamily ? 'none' : 'approved';

    // All senior help requests start as 'pending'
    const initialStatus = 'pending';

    // Generate AI Platform Recommendations & Pre-filled Search URLs
    const { extractedItems, suggestedPlatforms } = recommendPlatforms({
      title: finalTitle,
      description: description || '',
      transcript: transcript || '',
      category: category || 'Other'
    });

    const newRequest = new HelpRequest({
      title: finalTitle,
      description: description || (hasTranscript ? transcript : ''),
      transcript: transcript || '',
      category: category || 'Other',
      urgency: urgency || 'low',
      audioFile,
      aiConfidenceScore: parsedConfidence,
      aiLowConfidence: isLowConfidence,
      extractedItems,
      suggestedPlatforms,
      senior: req.user.id,
      shoppingPreference: shoppingPreference ? shoppingPreference.trim() : 'No Preference',
      status: initialStatus,
      familyApprovalStatus: initialFamilyApproval
    });

    const request = await newRequest.save();

    let message = 'Help request created successfully! Your family caregiver has been notified to fulfill it directly or allot it to community volunteers.';

    res.status(201).json({ success: true, message, request, isLowConfidence });
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
      // Volunteers see:
      // 1. Pending & awaiting_approval requests allotted by family ('approved')
      // 2. Tasks where this volunteer is the assigned volunteer (accepted / completed)
      // 3. Tasks where this volunteer submitted a quote, but another volunteer was selected (for notification)
      requests = await HelpRequest.find({
        $or: [
          { status: 'pending', familyApprovalStatus: 'approved' },
          { status: 'awaiting_approval', familyApprovalStatus: 'approved' },
          { volunteer: req.user.id },
          { 'volunteerQuotes.volunteer': req.user.id, status: { $in: ['accepted', 'completed'] } }
        ]
      })
        .populate('senior', 'name phone address emergencyContact')
        .populate('volunteer', 'name phone email skills')
        .populate('volunteerQuotes.volunteer', 'name phone email skills')
        .sort({ createdAt: -1 });

    } else if (req.user.role === 'family') {
      // Family sees all requests for their linked senior
      if (!req.user.linkedSenior) {
        return res.status(400).json({ success: false, message: 'No senior linked to this family account.' });
      }
      requests = await HelpRequest.find({ senior: req.user.linkedSenior })
        .populate('senior', 'name phone address emergencyContact')
        .populate('volunteer', 'name phone email skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
        .populate('volunteerQuotes.volunteer', 'name phone email skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
        .populate('familyReviewedBy', 'name relationship')
        .sort({ createdAt: -1 });

    } else if (req.user.role === 'admin') {
      requests = await HelpRequest.find()
        .populate('senior', 'name email phone address')
        .populate('volunteer', 'name email phone skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
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
      .populate('volunteer', 'name phone email skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
      .populate('volunteerQuotes.volunteer', 'name phone email skills verificationStatus isIdVerified isPoliceVerified isPhoneVerified isEmailVerified govtIdCard selfiePhoto aadhaarNumber createdAt')
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
// @desc    Volunteer ACCEPTS & Quotes on a help request
// @route   PUT /api/requests/:id/accept
// @access  Private (Volunteers only)
exports.acceptRequest = async (req, res) => {
  try {
    const User = require('../models/User');
    const volunteerUser = await User.findById(req.user.id);
    if (!volunteerUser || volunteerUser.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can accept help requests' });
    }

    if (volunteerUser.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'KYC & Police Clearance Required: You must complete document submission and receive Admin & Police verification approval before accepting requests.'
      });
    }

    let request = await HelpRequest.findById(req.params.id);

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'pending' && request.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'Request is no longer available to accept' });
    }

    const { serviceFee, volunteerNotes } = req.body;
    const feeNum = serviceFee !== undefined && serviceFee !== null ? Math.max(0, Number(serviceFee)) : 0;
    const notesStr = volunteerNotes ? String(volunteerNotes).trim() : '';

    // Record or update quote in volunteerQuotes array
    if (!request.volunteerQuotes) request.volunteerQuotes = [];
    const existingIndex = request.volunteerQuotes.findIndex(q => q.volunteer && q.volunteer.toString() === req.user.id.toString());
    if (existingIndex >= 0) {
      request.volunteerQuotes[existingIndex].serviceFee = feeNum;
      request.volunteerQuotes[existingIndex].volunteerNotes = notesStr;
      request.volunteerQuotes[existingIndex].quotedAt = Date.now();
    } else {
      request.volunteerQuotes.push({
        volunteer: req.user.id,
        serviceFee: feeNum,
        volunteerNotes: notesStr,
        quotedAt: Date.now()
      });
    }

    // Determine if senior has any linked family members
    const hasFamilyCaregiver = await seniorHasFamily(request.senior);

    if (hasFamilyCaregiver) {
      // Move status to 'awaiting_approval' so caregiver knows volunteer quotes are pending review!
      request.status = 'awaiting_approval';
      request.familyApprovalStatus = 'approved';
    } else {
      // No family linked — auto-accept for this volunteer immediately!
      request.volunteer = req.user.id;
      request.serviceFee = feeNum;
      request.volunteerNotes = notesStr;
      request.status = 'accepted';
      request.familyApprovalStatus = 'approved';
      request.acceptedAt = Date.now();
    }

    await request.save();

    request = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email')
      .populate('volunteerQuotes.volunteer', 'name phone email skills');

    const message = hasFamilyCaregiver
      ? 'Quote submitted! Waiting for family/caregiver approval before you can proceed.'
      : 'Request accepted! The senior has no caregiver link — you may proceed immediately.';

    res.status(200).json({ success: true, message, request, awaitingFamilyApproval: hasFamilyCaregiver });
  } catch (error) {
    console.error('Accept Request Error:', error);
    res.status(500).json({ success: false, message: 'Server error accepting request' });
  }
};

// @desc    Family/Caregiver APPROVES a specific volunteer
//          → moves request to 'accepted'; volunteer may now proceed
// @desc    Family/Caregiver approves a volunteer OR allots a senior request to community volunteers
// @route   PUT /api/requests/:id/family-approve
// @access  Private (Family only)
exports.familyApproveRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id)
      .populate('senior', 'name');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'pending' && request.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'This request is not pending family decision' });
    }

    // Verify this family member is linked to the request's senior
    if (req.user.linkedSenior?.toString() !== request.senior._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the caregiver for this senior' });
    }

    const { volunteerId, shoppingPreference } = req.body || {};
    let selectedVolId = volunteerId || request.volunteer;

    if (shoppingPreference && typeof shoppingPreference === 'string') {
      request.shoppingPreference = shoppingPreference.trim();
    }

    if (selectedVolId) {
      request.volunteer = selectedVolId;
      request.status = 'accepted';
      request.acceptedAt = Date.now();

      // Set final service fee & notes from the selected volunteer's quote
      if (request.volunteerQuotes && request.volunteerQuotes.length > 0) {
        const match = request.volunteerQuotes.find(q => q.volunteer && (q.volunteer._id || q.volunteer).toString() === selectedVolId.toString());
        if (match) {
          request.serviceFee = match.serviceFee;
          request.volunteerNotes = match.volunteerNotes;
        }
      }
    } else {
      // Caregiver allotting request to community volunteers
      request.status = 'pending';
      request.aiLowConfidence = false;
    }
    request.familyApprovalStatus = 'approved';
    request.familyReviewedBy = req.user.id;
    request.familyReviewedAt = Date.now();
    await request.save();

    request = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills')
      .populate('volunteerQuotes.volunteer', 'name phone email skills');

    const approveMsg = request.volunteer
      ? `Volunteer approved! They can now proceed to assist ${request.senior.name}.`
      : `Request allotted to community volunteers! Volunteers can now assist ${request.senior.name}.`;

    res.status(200).json({
      success: true,
      message: approveMsg,
      request
    });
  } catch (error) {
    console.error('Family Approve Error:', error);
    res.status(500).json({ success: false, message: 'Server error approving request' });
  }
};

// @desc    Family/Caregiver chooses to FULFILL the request themselves
//          → sets status to 'fulfilled_by_family', completedAt, and completionVerified = 'verified'
// @route   PUT /api/requests/:id/family-fulfill
// @access  Private (Family only)
exports.familyFulfillSelf = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id)
      .populate('senior', 'name');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    // Verify this family member is linked to the request's senior
    if (req.user.linkedSenior?.toString() !== request.senior._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the caregiver for this senior' });
    }

    request.status = 'fulfilled_by_family';
    request.familyApprovalStatus = 'fulfilled_by_family';
    request.fulfilledByFamily = true;
    request.completionVerified = 'verified';
    request.resolutionNotes = 'Fulfilled directly by Family Caregiver';
    request.familyReviewedBy = req.user.id;
    request.familyReviewedAt = Date.now();
    request.completedAt = Date.now();

    await request.save();

    request = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact');

    res.status(200).json({
      success: true,
      message: `Request marked as fulfilled by you! ${request.senior.name} has been notified.`,
      request
    });
  } catch (error) {
    console.error('Family Fulfill Error:', error);
    res.status(500).json({ success: false, message: 'Server error fulfilling request' });
  }
};

// @desc    Family/Caregiver REJECTS the volunteer or request
// @route   PUT /api/requests/:id/family-reject
// @access  Private (Family only)
exports.familyRejectRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id)
      .populate('senior', 'name');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (request.status !== 'pending' && request.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'This request is not pending family decision' });
    }

    // Verify caregiver link
    if (req.user.linkedSenior?.toString() !== request.senior._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the caregiver for this senior' });
    }

    const { rejectionReason } = req.body;

    const hadVolunteer = !!request.volunteer;

    if (hadVolunteer) {
      // Reset back to pending for other volunteers
      request.status = 'pending';
      request.volunteer = null;
      request.acceptedAt = undefined;
    } else {
      // Caregiver rejected senior request
      request.status = 'rejected';
      request.resolutionNotes = rejectionReason || 'Rejected by family caregiver';
    }

    request.familyApprovalStatus = 'rejected';
    request.familyReviewedBy = req.user.id;
    request.familyReviewedAt = Date.now();
    request.familyRejectionReason = rejectionReason || 'Rejected by family caregiver';
    await request.save();

    const rejectMsg = hadVolunteer
      ? 'Volunteer rejected. The request has been reset and is available for other volunteers.'
      : 'Help request rejected and dismissed.';

    res.status(200).json({
      success: true,
      message: rejectMsg,
      request
    });
  } catch (error) {
    console.error('Family Reject Error:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting volunteer' });
  }
};

// @desc    Step 4-5: Volunteer submits actual purchase cost + cart/price proof image
// @route   PUT /api/requests/:id/submit-purchase-cost
// @access  Private (Volunteer)
exports.submitPurchaseCost = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    if (req.user.role !== 'admin' && (!request.volunteer || request.volunteer.toString() !== req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to submit purchase cost for this request' });
    }

    const { actualPurchaseCost, purchaseNotes } = req.body;
    const costNum = Number(actualPurchaseCost);
    if (isNaN(costNum) || costNum < 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid purchase cost amount' });
    }

    request.actualPurchaseCost = costNum;
    request.purchaseNotes = purchaseNotes ? purchaseNotes.trim() : '';
    if (req.files && req.files.length > 0) {
      request.purchaseProofDoc = `/uploads/proofs/${req.files[0].filename}`;
      request.purchaseProofDocs = req.files.map(f => `/uploads/proofs/${f.filename}`);
    } else if (req.file) {
      request.purchaseProofDoc = `/uploads/proofs/${req.file.filename}`;
      request.purchaseProofDocs = [`/uploads/proofs/${req.file.filename}`];
    }
    request.purchaseCostSubmittedAt = Date.now();
    request.status = 'purchase_cost_submitted';

    await request.save();

    const updated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: 'Actual purchase cost & cart proof submitted! Waiting for caregiver payment approval.',
      request: updated
    });
  } catch (error) {
    console.error('Submit Purchase Cost Error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting purchase cost' });
  }
};

// @desc    Step 6-7: Caregiver approves payment for actual purchase cost -> funds released for purchase
// @route   PUT /api/requests/:id/approve-purchase-funding
// @access  Private (Family Caregiver)
exports.approvePurchaseFunding = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    const { paymentMethod, transactionId } = req.body || {};

    request.purchaseFunded = true;
    request.purchaseFundedAt = Date.now();
    request.status = 'purchase_funded';
    request.purchasePaymentDetails = {
      amountPaid: request.actualPurchaseCost || 0,
      transactionId: transactionId || `TXN_${Date.now()}`,
      paymentMethod: paymentMethod || 'Escrow UPI',
      paidAt: Date.now()
    };

    await request.save();

    const updated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: `Purchase funds of ₹${request.actualPurchaseCost} approved & released to volunteer! Volunteer can now buy the items and complete the task.`,
      request: updated
    });
  } catch (error) {
    console.error('Approve Purchase Funding Error:', error);
    res.status(500).json({ success: false, message: 'Server error approving purchase payment' });
  }
};

// @desc    Caregiver rejects submitted purchase cost with note/feedback (e.g. bargain or better quality)
// @route   PUT /api/requests/:id/reject-purchase-cost
// @access  Private (Family Caregiver)
exports.rejectPurchaseCost = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    const { rejectionReason } = req.body;
    request.status = 'accepted';
    request.purchaseRejectionReason = rejectionReason ? rejectionReason.trim() : 'Caregiver requested purchase cost revision / quality change.';
    request.purchaseRejectedAt = Date.now();

    await request.save();

    const updated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: 'Purchase cost revision note sent to volunteer!',
      request: updated
    });
  } catch (error) {
    console.error('Reject Purchase Cost Error:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting purchase cost' });
  }
};

// @desc    Step 8-9: Volunteer completes task & uploads final store cash receipt photo
// @route   PUT /api/requests/:id/complete
// @access  Private (Volunteer or Admin)
exports.completeRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id).populate('senior');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (req.user.role !== 'admin' && (!request.volunteer || request.volunteer.toString() !== req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this request' });
    }

    const { resolutionNotes } = req.body;
    request.status = 'awaiting_verification';
    request.completedAt = Date.now();
    request.receiptUploadedAt = Date.now();
    request.resolutionNotes = resolutionNotes || 'Task completed & store receipt uploaded.';

    // Save final receipt / delivery photo proof if uploaded
    if (req.files && req.files.length > 0) {
      request.finalReceiptDoc = `/uploads/proofs/${req.files[0].filename}`;
      request.completionProof = `/uploads/proofs/${req.files[0].filename}`;
      request.finalReceiptDocs = req.files.map(f => `/uploads/proofs/${f.filename}`);
    } else if (req.file) {
      request.finalReceiptDoc = `/uploads/proofs/${req.file.filename}`;
      request.completionProof = `/uploads/proofs/${req.file.filename}`;
      request.finalReceiptDocs = [`/uploads/proofs/${req.file.filename}`];
    }

    const seniorId = request.senior._id || request.senior;
    const hasFamily = await seniorHasFamily(seniorId);

    request.completionVerified = 'pending_verification';
    request.verificationRejectionReason = '';

    if (hasFamily) {
      request.requiresSeniorVoiceCall = false;
      await request.save();
      return res.status(200).json({
        success: true,
        message: 'Task marked completed & final receipt uploaded! Submitted to family caregiver for verification and service charge release.',
        request,
        verificationChannel: 'family'
      });
    } else {
      request.requiresSeniorVoiceCall = true;
      await request.save();
      return res.status(200).json({
        success: true,
        message: 'Task marked completed & final receipt uploaded! Automated IVR voice confirmation call dispatched to senior citizen.',
        request,
        verificationChannel: 'senior_voice_ivr'
      });
    }
  } catch (error) {
    console.error('Complete Request Error:', error);
    res.status(500).json({ success: false, message: 'Server error completing request' });
  }
};

// @desc    Step 10-11: Caregiver verifies final receipt & releases volunteer service charge
// @route   PUT /api/requests/:id/verify-completion-family
// @access  Private (Family)
exports.verifyCompletionByFamily = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    const { approved, rejectionReason, paymentDetails } = req.body;

    request.verifiedBy = req.user.id;
    request.verifierRole = 'family';
    request.verifiedAt = Date.now();

    if (approved) {
      request.status = 'completed';
      request.completionVerified = 'verified';
      request.serviceChargeReleased = true;
      request.serviceChargeReleasedAt = Date.now();

      if (paymentDetails) {
        request.paymentDetails = {
          amountPaid: Number(paymentDetails.amountPaid || 0),
          itemsCost: Number(paymentDetails.itemsCost || request.actualPurchaseCost || 0),
          volunteerFee: Number(paymentDetails.volunteerFee || request.serviceFee || 0),
          platformFee: Number(paymentDetails.platformFee || 0),
          transactionId: String(paymentDetails.transactionId || ''),
          paymentMethod: String(paymentDetails.paymentMethod || 'UPI'),
          paidAt: Date.now()
        };
      }
    } else {
      // Unmark completed: return task to active status ('purchase_funded') for volunteer to re-upload receipt
      request.status = 'purchase_funded';
      request.completionVerified = 'rejected';
      request.verificationRejectionReason = rejectionReason || 'Rejected by family caregiver';
    }

    await request.save();

    const populatedRequest = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: approved ? 'Final receipt verified & volunteer service charge released!' : 'Receipt verification rejected. Returned to volunteer to re-upload valid receipt.',
      request: populatedRequest
    });
  } catch (error) {
    console.error('Verify Completion Error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying completion' });
  }
};

// @desc    Senior citizen responds to automated IVR voice confirmation call ("Press 1 / Say Yes" or "Press 2 / Say No")
// @route   PUT /api/requests/:id/verify-completion-voice
// @access  Private (Senior or Admin)
exports.verifyCompletionBySeniorVoice = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    const { selection } = req.body; // 1 = Received (Yes), 2 = Not Received (No)
    const isApproved = (selection == 1 || selection === '1' || selection === true || selection === 'yes');

    request.completionVerified = isApproved ? 'verified' : 'rejected';
    request.verifiedBy = req.user.id;
    request.verifierRole = 'senior_voice_ivr';
    request.verifiedAt = Date.now();
    request.seniorVoiceCallConfirmed = true;
    request.requiresSeniorVoiceCall = false;

    if (!isApproved) {
      request.verificationRejectionReason = 'Senior reported items not received during IVR voice call confirmation.';
    }

    await request.save();

    res.status(200).json({
      success: true,
      message: isApproved ? 'Voice confirmation recorded! Delivery verified.' : 'Voice response recorded: Senior reported items not received.',
      request,
      isApproved
    });
  } catch (error) {
    console.error('Senior Voice Verification Error:', error);
    res.status(500).json({ success: false, message: 'Server error recording voice verification' });
  }
};

// @desc    Submit volunteer feedback for completed request after payment
// @route   PUT /api/requests/:id/feedback
// @access  Private (family, senior, admin)
exports.submitFeedback = async (req, res) => {
  try {
    const { costUtilization, speedTimeliness, taskCompletion, communication, chooseAgain, additionalFeedback } = req.body;
    const request = await HelpRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    request.feedback = {
      costUtilization: Number(costUtilization) || 5,
      speedTimeliness: Number(speedTimeliness) || 5,
      taskCompletion: taskCompletion || 'Completely',
      communication: Number(communication) || 5,
      chooseAgain: chooseAgain || 'Yes',
      additionalFeedback: additionalFeedback ? String(additionalFeedback).trim() : '',
      submittedAt: Date.now()
    };

    await request.save();

    res.status(200).json({
      success: true,
      message: 'Volunteer feedback recorded successfully!',
      request
    });
  } catch (error) {
    console.error('Submit Feedback Error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting feedback' });
  }
};
