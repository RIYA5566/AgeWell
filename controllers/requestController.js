const HelpRequest = require('../models/HelpRequest');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Payment = require('../models/Payment');
const { recommendPlatforms } = require('../utils/platformRecommender');

// ─── Helper: check if a senior has any linked family members ──────────────
const seniorHasFamily = async (seniorId) => {
  const count = await User.countDocuments({ role: 'family', linkedSenior: seniorId });
  return count > 0;
};

// ─── Helper: derive taskProofType from category ────────────────────────────
const PROOF_TYPE_MAP = {
  'Grocery Shopping':  'financial',     // always involves purchasing goods
  'Medical Escort':    'mixed',         // may or may not involve buying medicine/tests
  'Tech Support':      'service_only',  // pure service, no goods
  'Housekeeping':      'service_only',  // pure service, no goods
  'Companionship':     'service_only',  // pure service, no goods
  'Other':             'mixed'          // unknown; volunteer decides at completion
};
const getProofType = (category) => PROOF_TYPE_MAP[category] || 'mixed';

// @desc    Create a new help request
// @route   POST /api/requests
// @access  Private (Senior Citizens only)
exports.createRequest = async (req, res) => {
  try {
    const { title, description, category, urgency, transcript, aiConfidenceScore, aiLowConfidence, shoppingPreference, allowedBudget, fundingMode } = req.body;
    const audioFile = req.file?.cloudinaryUrl || '';

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
      allowedBudget: (allowedBudget !== undefined && allowedBudget !== null && allowedBudget !== '' && !isNaN(Number(allowedBudget)) && Number(allowedBudget) >= 0) ? Number(allowedBudget) : null,
      fundingMode: (fundingMode && ['pre_fund', 'caregiver_direct'].includes(fundingMode)) ? fundingMode : 'caregiver_direct',
      taskProofType: getProofType(category || 'Other'),
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
        .populate('volunteerQuotes.volunteer', 'name phone email skills')
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
    const nonCancellable = ['purchase_cost_submitted', 'purchase_funded', 'awaiting_verification', 'delivery_completed', 'completed', 'fulfilled_by_family'];
    if (req.user.role !== 'admin' && nonCancellable.includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a request after payment or purchase cost has been processed' });
    }

    if (req.user.role === 'admin') {
      // Admin: always hard-delete the request and clean up all associated earnings
      await Earning.deleteMany({ request: request._id });
      await HelpRequest.findByIdAndDelete(req.params.id);
    } else if (request.volunteer) {
      // Non-admin: soft-cancel if a volunteer is already assigned
      request.status = 'cancelled';
      await request.save();
      // Delete any pending earning record for this request
      await Earning.deleteOne({ request: request._id, volunteer: request.volunteer, status: 'PENDING' });
    } else {
      await HelpRequest.findByIdAndDelete(req.params.id);
    }
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
    const allowedStatuses = ['pending', 'awaiting_approval', 'accepted', 'purchase_cost_submitted', 'purchase_funded', 'in_progress'];
    if (!allowedStatuses.includes(request.status)) {
      return res.status(400).json({ success: false, message: 'This request is not eligible for caregiver preference updates' });
    }

    // Verify this family member is linked to the request's senior
    if (req.user.linkedSenior?.toString() !== request.senior._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the caregiver for this senior' });
    }

    const { volunteerId, shoppingPreference, allowedBudget, fundingMode, taskProofType } = req.body || {};
    let selectedVolId = volunteerId || request.volunteer;

    if (taskProofType && ['service_only', 'financial', 'mixed'].includes(taskProofType)) {
      request.taskProofType = taskProofType;
    }

    if (request.taskProofType === 'service_only') {
      request.allowedBudget = null;
      request.shoppingPreference = '';
    } else {
      if (shoppingPreference && typeof shoppingPreference === 'string') {
        request.shoppingPreference = shoppingPreference.trim();
      }

      if (fundingMode && ['pre_fund', 'caregiver_direct'].includes(fundingMode)) {
        request.fundingMode = fundingMode;
      }

      if (allowedBudget !== undefined) {
        if (allowedBudget === null || allowedBudget === '') {
          request.allowedBudget = null;
        } else {
          const parsedBudget = Number(allowedBudget);
          request.allowedBudget = (!isNaN(parsedBudget) && parsedBudget >= 0) ? parsedBudget : null;
        }
      }
    }

    // Pre-Fund payment: Caregiver selected pre_fund mode with estimated budget + service fee
    const isPreFundMode = (fundingMode === 'pre_fund' || request.fundingMode === 'pre_fund');
    const totalPreFundDeposit = (Number(request.allowedBudget || 0)) + (Number(request.serviceFee || 0));
    const requiresPreFundPayment = !!(selectedVolId && isPreFundMode && totalPreFundDeposit > 0 && !request.purchaseFunded);

    if (selectedVolId) {
      // Set final service fee & notes from the selected volunteer's quote
      if (request.volunteerQuotes && request.volunteerQuotes.length > 0) {
        const match = request.volunteerQuotes.find(q => q.volunteer && (q.volunteer._id || q.volunteer).toString() === selectedVolId.toString());
        if (match) {
          request.serviceFee = match.serviceFee;
          request.volunteerNotes = match.volunteerNotes;
        }
      }

      if (requiresPreFundPayment) {
        // Do NOT mark as accepted until pre-fund escrow deposit is paid on payment gateway!
        request.pendingVolunteer = selectedVolId;
        request.fundingMode = 'pre_fund';
      } else {
        request.volunteer = selectedVolId;
        request.pendingVolunteer = null;
        if (request.status === 'pending' || request.status === 'awaiting_approval' || request.status === 'quoted') {
          request.status = 'accepted';
          request.acceptedAt = Date.now();
        }
      }
    } else if (request.status === 'pending' || request.status === 'awaiting_approval') {
      // Caregiver allotting request to community volunteers
      request.status = 'pending';
      request.aiLowConfidence = false;
    }
    request.familyApprovalStatus = 'approved';
    request.familyReviewedBy = req.user.id;
    request.familyReviewedAt = Date.now();
    await request.save();

    // ── Create PENDING Earning record when a volunteer is approved ────────────
    // Only create if a specific volunteer was selected (not a community allotment)
    // and the service fee is > 0 (voluntary/free tasks still get a ₹0 record for history)
    if (selectedVolId && !requiresPreFundPayment) {
      try {
        // Avoid duplicate: remove any pre-existing PENDING earning for same request+volunteer
        await Earning.deleteOne({ request: request._id, volunteer: selectedVolId, status: 'PENDING', type: 'SERVICE_CHARGE' });
        await Earning.create({
          volunteer: selectedVolId,
          request: request._id,
          amount: request.serviceFee || 0,
          type: 'SERVICE_CHARGE',
          status: 'PENDING',
          taskTitle: request.title || 'Help Request',
          taskCategory: request.category || 'Other'
        });
      } catch (earnErr) {
        console.error('Earning creation error (familyApproveRequest):', earnErr);
        // Non-fatal — don't fail the whole request
      }
    }

    request = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills')
      .populate('pendingVolunteer', 'name phone email skills')
      .populate('volunteerQuotes.volunteer', 'name phone email skills');

    const approveMsg = request.volunteer
      ? `Volunteer approved! They can now proceed to assist ${request.senior.name}.`
      : `Request allotted to community volunteers! Volunteers can now assist ${request.senior.name}.`;

    // ── Tell frontend if caregiver must pre-pay service fee or pre-fund deposit ──
    const proofType = request.taskProofType || getProofType(request.category);
    const requiresServiceFeePayment = !!(selectedVolId && proofType === 'service_only' && Number(request.serviceFee || 0) > 0 && !request.serviceFeePrePaid);

    res.status(200).json({
      success: true,
      message: approveMsg,
      request,
      requiresServiceFeePayment,
      requiresPreFundPayment,
      serviceFee: request.serviceFee || 0,
      allowedBudget: request.allowedBudget || 0,
      totalPreFundDeposit
    });
  } catch (error) {
    console.error('Family Approve Error:', error);
    res.status(500).json({ success: false, message: 'Server error approving request' });
  }
};

// @desc    Caregiver records upfront service fee pre-payment for service_only tasks
//          Called by payment.js after Razorpay success for type=service_fee_upfront
// @route   PUT /api/requests/:id/prepay-service-fee
// @access  Private (Family only)
exports.prepayServiceFee = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    if (req.user.linkedSenior?.toString() !== request.senior.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this request' });
    }

    const { paymentMethod, transactionId, razorpayOrderId, razorpayPaymentId, amountPaid, volunteerId } = req.body || {};

    const volToAssign = volunteerId || request.pendingVolunteer || (request.volunteerQuotes && request.volunteerQuotes[0]?.volunteer);
    if (volToAssign) {
      request.volunteer = volToAssign;
      request.pendingVolunteer = null;
      request.acceptedAt = request.acceptedAt || Date.now();
    }

    request.serviceFeePrePaid = true;
    request.serviceFeePrePaidAt = Date.now();
    request.fundingMode = 'caregiver_direct';
    request.serviceFeePrePaymentDetails = {
      amountPaid: Number(amountPaid || request.serviceFee || 0),
      transactionId: transactionId || razorpayPaymentId || `TXN_${Date.now()}`,
      paymentMethod: paymentMethod || 'Razorpay',
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      paidAt: Date.now()
    };

    // Ensure status is accepted (payment confirms allotment)
    if (request.status !== 'accepted') request.status = 'accepted';

    await request.save();

    // Create PENDING Earning record for volunteer
    if (request.volunteer && Number(request.serviceFee || amountPaid || 0) > 0) {
      try {
        await Earning.deleteOne({ request: request._id, volunteer: request.volunteer, status: 'PENDING', type: 'SERVICE_CHARGE' });
        await Earning.create({
          volunteer: request.volunteer,
          request: request._id,
          amount: Number(request.serviceFee || amountPaid || 0),
          type: 'SERVICE_CHARGE',
          status: 'PENDING',
          taskTitle: request.title || 'Help Request',
          taskCategory: request.category || 'Other'
        });
      } catch (earnErr) {
        console.error('Earning creation error (prepayServiceFee):', earnErr);
      }
    }

    const updated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address')
      .populate('volunteer', 'name phone email');

    res.status(200).json({
      success: true,
      message: `Service fee of ₹${request.serviceFee} pre-paid & escrowed! Volunteer can now begin the task.`,
      request: updated
    });
  } catch (error) {
    console.error('Prepay Service Fee Error:', error);
    res.status(500).json({ success: false, message: 'Server error recording service fee pre-payment' });
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

    // Guard: service_only tasks never have purchase costs
    const proofType = request.taskProofType || getProofType(request.category);
    if (proofType === 'service_only') {
      return res.status(400).json({
        success: false,
        message: `"${request.category}" tasks do not involve purchases. Please use "Mark Task Done" instead.`
      });
    }

    const { 
      actualPurchaseCost, 
      purchaseNotes,
      shopName,
      paymentType,
      upiId,
      paymentLink,
      orderNumber,
      merchantPhone
    } = req.body;

    const costNum = Number(actualPurchaseCost);
    if (isNaN(costNum) || costNum < 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid purchase cost amount' });
    }

    request.actualPurchaseCost = costNum;
    request.purchaseNotes = purchaseNotes ? purchaseNotes.trim() : '';

    // Handle Merchant Details for Direct Merchant Payment
    let qrImagePath = '';
    const proofDocPaths = [];

    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        if (f.fieldname === 'merchantQrFile') {
          qrImagePath = `/uploads/proofs/${f.filename}`;
        } else {
          proofDocPaths.push(`/uploads/proofs/${f.filename}`);
        }
      }
    } else if (req.file) {
      if (req.file.fieldname === 'merchantQrFile') {
        qrImagePath = `/uploads/proofs/${req.file.filename}`;
      } else {
        proofDocPaths.push(`/uploads/proofs/${req.file.filename}`);
      }
    }

    if (proofDocPaths.length > 0) {
      request.purchaseProofDoc = proofDocPaths[0];
      request.purchaseProofDocs = proofDocPaths;
    }

    request.merchantDetails = {
      shopName: shopName ? shopName.trim() : (request.merchantDetails?.shopName || ''),
      paymentType: paymentType && ['offline_qr', 'online_link', 'upi_id', 'other'].includes(paymentType) ? paymentType : (request.merchantDetails?.paymentType || 'offline_qr'),
      upiId: upiId ? upiId.trim() : (request.merchantDetails?.upiId || ''),
      upiQrImage: qrImagePath || (request.merchantDetails?.upiQrImage || ''),
      paymentLink: paymentLink ? paymentLink.trim() : (request.merchantDetails?.paymentLink || ''),
      orderNumber: orderNumber ? orderNumber.trim() : (request.merchantDetails?.orderNumber || ''),
      merchantPhone: merchantPhone ? merchantPhone.trim() : (request.merchantDetails?.merchantPhone || '')
    };

    request.purchaseCostSubmittedAt = Date.now();
    request.status = 'purchase_cost_submitted';

    await request.save();

    const updated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: 'Purchase cost & merchant payment details submitted! Waiting for caregiver direct payment to merchant.',
      request: updated
    });
  } catch (error) {
    console.error('Submit Purchase Cost Error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting purchase cost' });
  }
};

// @desc    Step 6-7: Caregiver approves direct payment to merchant -> moves status to purchase_funded
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
      paymentMethod: paymentMethod || 'Direct Merchant Payment',
      paidAt: Date.now()
    };

    await request.save();

    const updated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    const shopLabel = request.merchantDetails?.shopName ? ` to ${request.merchantDetails.shopName}` : '';
    res.status(200).json({
      success: true,
      message: `Direct payment of ₹${request.actualPurchaseCost}${shopLabel} confirmed! Volunteer can now collect the items and deliver to senior.`,
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

// @desc    Step 8-9 (financial) OR direct completion (service_only / mixed-no-purchase):
//          Volunteer marks task done and uploads proof (receipt for financial; optional photo for service_only)
// @route   PUT /api/requests/:id/complete
// @access  Private (Volunteer or Admin)
exports.completeRequest = async (req, res) => {
  try {
    let request = await HelpRequest.findById(req.params.id).populate('senior');

    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });
    if (req.user.role !== 'admin' && (!request.volunteer || request.volunteer.toString() !== req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this request' });
    }

    const { resolutionNotes, volunteerDeclaredPurchase } = req.body;

    // ── Determine proof path ──────────────────────────────────────────────────
    const proofType = request.taskProofType || getProofType(request.category);
    // volunteerDeclaredPurchase is relevant only for 'mixed' tasks
    const declaredPurchase = (volunteerDeclaredPurchase === true || volunteerDeclaredPurchase === 'true');
    const requiresEscrow = (proofType === 'financial') || (proofType === 'mixed' && declaredPurchase);

    if (proofType === 'mixed') {
      request.volunteerDeclaredPurchase = declaredPurchase;
    }

    // ── Validate required proof for financial tasks ───────────────────────────
    const hasPriorProof = (request.merchantPurchases && request.merchantPurchases.length > 0) ||
      (request.purchaseProofDocs && request.purchaseProofDocs.length > 0) ||
      !!request.purchaseProofDoc ||
      !!request.purchaseFunded ||
      (request.fundingMode === 'pre_fund');

    const hasUploadedProof = (req.files && req.files.length > 0) || !!req.file;
    if (proofType === 'financial' && !hasUploadedProof && !hasPriorProof) {
      return res.status(400).json({
        success: false,
        message: 'A store receipt / bill photo is required to complete a Grocery Shopping task.'
      });
    }

    request.completedAt = Date.now();
    request.receiptUploadedAt = Date.now();
    request.resolutionNotes = (resolutionNotes && resolutionNotes.trim()) ? resolutionNotes.trim() : '';

    // ── Save uploaded proof photo if provided ─────────────────────────────────
    if (req.files && req.files.length > 0) {
      const uniqueFiles = [];
      const seenFileKeys = new Set();
      for (const f of req.files) {
        const key = `${f.originalname}_${f.size}`;
        if (!seenFileKeys.has(key)) {
          seenFileKeys.add(key);
          uniqueFiles.push(f);
        }
      }
      request.finalReceiptDoc = `/uploads/proofs/${uniqueFiles[0].filename}`;
      request.completionProof = `/uploads/proofs/${uniqueFiles[0].filename}`;
      request.finalReceiptDocs = uniqueFiles.map(f => `/uploads/proofs/${f.filename}`);
    } else if (req.file) {
      request.finalReceiptDoc = `/uploads/proofs/${req.file.filename}`;
      request.completionProof = `/uploads/proofs/${req.file.filename}`;
      request.finalReceiptDocs = [`/uploads/proofs/${req.file.filename}`];
    } else if (!request.finalReceiptDoc && hasPriorProof) {
      if (request.purchaseProofDocs && request.purchaseProofDocs.length > 0) {
        request.finalReceiptDoc = request.purchaseProofDocs[0];
        request.completionProof = request.purchaseProofDocs[0];
        request.finalReceiptDocs = request.purchaseProofDocs;
      } else if (request.merchantPurchases && request.merchantPurchases.length > 0) {
        const withDoc = request.merchantPurchases.find(p => p.receiptDoc);
        if (withDoc) {
          request.finalReceiptDoc = withDoc.receiptDoc;
          request.completionProof = withDoc.receiptDoc;
          request.finalReceiptDocs = request.merchantPurchases.filter(p => p.receiptDoc).map(p => p.receiptDoc);
        }
      }
    }

    const seniorId = request.senior._id || request.senior;
    const hasFamily = await seniorHasFamily(seniorId);

    // ── Route based on proof type ─────────────────────────────────────────────
    if (requiresEscrow) {
      // Financial path: requires caregiver purchase-cost funding first (existing escrow steps)
      // Volunteer must have already gone through submit-purchase-cost and purchase_funded.
      // This completion marks receipt upload for caregiver final verification.
      request.status = 'awaiting_verification';
      request.completionVerified = 'pending_verification';
      request.verificationRejectionReason = '';

      if (hasFamily) {
        request.requiresSeniorVoiceCall = false;
        await request.save();
        return res.status(200).json({
          success: true,
          message: 'Task completed & final receipt uploaded! Submitted to family caregiver for verification and service charge release.',
          request,
          verificationChannel: 'family',
          proofType,
          requiresEscrow: true
        });
      } else {
        request.requiresSeniorVoiceCall = true;
        await request.save();
        return res.status(200).json({
          success: true,
          message: 'Task completed & final receipt uploaded! Automated IVR voice confirmation call dispatched to senior citizen.',
          request,
          verificationChannel: 'senior_voice_ivr',
          proofType,
          requiresEscrow: true
        });
      }
    } else {
      // Service-only path (or mixed with no purchase): skip escrow entirely.
      // Transition directly to awaiting_verification for task completion sign-off.
      request.status = 'awaiting_verification';
      request.completionVerified = 'pending_verification';
      request.verificationRejectionReason = '';
      request.requiresSeniorVoiceCall = !hasFamily;

      await request.save();
      return res.status(200).json({
        success: true,
        message: hasFamily
          ? 'Task marked as done! Awaiting family caregiver confirmation to release your service charge.'
          : 'Task marked as done! An IVR confirmation call has been dispatched to the senior citizen.',
        request,
        verificationChannel: hasFamily ? 'family' : 'senior_voice_ivr',
        proofType,
        requiresEscrow: false
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

    // ── Guard: service_only tasks require pre-payment before releasing service charge ──
    if (approved) {
      const proofType = request.taskProofType || getProofType(request.category);
      const serviceFeeAmt = Number(request.serviceFee || 0);
      if (proofType === 'service_only' && serviceFeeAmt > 0 && !request.serviceFeePrePaid) {
        return res.status(402).json({
          success: false,
          message: `Service fee of ₹${serviceFeeAmt} must be paid before the service charge can be released. Please complete the payment first.`,
          requiresPayment: true,
          serviceFee: serviceFeeAmt
        });
      }
    }

    request.verifiedBy = req.user.id;
    request.verifierRole = 'family';
    request.verifiedAt = Date.now();

    if (approved) {
      request.status = 'completed';
      request.completionVerified = 'verified';
      request.completedAt = new Date();
      request.serviceChargeReleased = true;
      request.serviceChargeReleasedAt = Date.now();

      const extractedTip = Number(req.body.tipAmount || (paymentDetails ? paymentDetails.tipAmount : 0) || request.tipAmount || 0);
      if (extractedTip > 0) {
        request.tipAmount = extractedTip;
      }

      if (paymentDetails) {
        request.paymentDetails = {
          amountPaid: Number(paymentDetails.amountPaid || 0),
          itemsCost: Number(paymentDetails.itemsCost || request.actualPurchaseCost || 0),
          volunteerFee: Number(paymentDetails.volunteerFee || request.serviceFee || 0),
          platformFee: Number(paymentDetails.platformFee || 0),
          tipAmount: Number(paymentDetails.tipAmount || request.tipAmount || extractedTip || 0),
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

    // ── Update Earning records on completion approval ─────────────────────────
    if (approved && request.volunteer) {
      try {
        const releasedAt = new Date();

        // 1. Flip the PENDING service-charge earning to RELEASED
        const updated = await Earning.findOneAndUpdate(
          { request: request._id, volunteer: request.volunteer, type: 'SERVICE_CHARGE', status: 'PENDING' },
          { $set: { status: 'RELEASED', releasedAt } }
        );

        // If no Earning record existed (legacy task), create one now
        if (!updated) {
          await Earning.create({
            volunteer: request.volunteer,
            request: request._id,
            amount: request.serviceFee || 0,
            type: 'SERVICE_CHARGE',
            status: 'RELEASED',
            taskTitle: request.title || 'Completed Task',
            taskCategory: request.category || 'Other',
            releasedAt
          });
        }

        // 2. If a tip was given, create a separate TIP earning (RELEASED immediately)
        const tipAmt = Number(request.tipAmount || 0);
        if (tipAmt > 0) {
          // Remove any existing tip earning for this request to avoid duplication
          await Earning.deleteOne({ request: request._id, volunteer: request.volunteer, type: 'TIP' });
          await Earning.create({
            volunteer: request.volunteer,
            request: request._id,
            amount: tipAmt,
            type: 'TIP',
            status: 'RELEASED',
            taskTitle: request.title || 'Completed Task',
            taskCategory: request.category || 'Other',
            releasedAt
          });
        }
      } catch (earnErr) {
        console.error('Earning update error (verifyCompletionByFamily):', earnErr);
        // Non-fatal — task completion should still succeed
      }
    }

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

// @desc    Senior citizen directly confirms task was performed & releases service charge
//          Works in parallel with caregiver verification — whoever acts first completes the task
// @route   PUT /api/requests/:id/verify-completion-senior
// @access  Private (Senior only)
exports.verifyCompletionBySenior = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    // Only the senior who owns the request can verify it
    if (request.senior.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the senior who raised this request can verify it' });
    }

    // Already completed — idempotent
    if (request.status === 'completed') {
      return res.status(200).json({ success: true, message: 'This task has already been completed.', request });
    }

    const { approved, rejectionReason } = req.body;

    // ── Guard: service_only tasks require pre-payment by caregiver before releasing service charge ──
    if (approved) {
      const proofType = request.taskProofType || getProofType(request.category);
      const serviceFeeAmt = Number(request.serviceFee || 0);
      if (proofType === 'service_only' && serviceFeeAmt > 0 && !request.serviceFeePrePaid) {
        return res.status(402).json({
          success: false,
          message: `Your caregiver has not yet completed the service fee payment (₹${serviceFeeAmt}). Once the payment is made, the service charge can be released.`,
          requiresPayment: true,
          serviceFee: serviceFeeAmt
        });
      }
    }

    request.verifiedBy = req.user.id;
    request.verifierRole = 'senior';
    request.verifiedAt = Date.now();

    if (approved) {
      request.status = 'completed';
      request.completionVerified = 'verified';
      request.completedAt = new Date();
      request.serviceChargeReleased = true;
      request.serviceChargeReleasedAt = Date.now();

      await request.save();

      // Release the PENDING service-charge earning
      if (request.volunteer) {
        try {
          const releasedAt = new Date();
          const updated = await Earning.findOneAndUpdate(
            { request: request._id, volunteer: request.volunteer, type: 'SERVICE_CHARGE', status: 'PENDING' },
            { $set: { status: 'RELEASED', releasedAt } }
          );
          if (!updated) {
            await Earning.create({
              volunteer: request.volunteer,
              request: request._id,
              amount: request.serviceFee || 0,
              type: 'SERVICE_CHARGE',
              status: 'RELEASED',
              taskTitle: request.title || 'Completed Task',
              taskCategory: request.category || 'Other',
              releasedAt
            });
          }
        } catch (earnErr) {
          console.error('Earning update error (verifyCompletionBySenior):', earnErr);
        }
      }

      const populatedRequest = await HelpRequest.findById(request._id)
        .populate('senior', 'name phone address emergencyContact')
        .populate('volunteer', 'name phone email skills');

      return res.status(200).json({
        success: true,
        message: 'Thank you for confirming! The volunteer\'s service charge has been released.',
        request: populatedRequest
      });
    } else {
      // Senior says task was NOT done — return to volunteer for correction
      const proofType = request.taskProofType || getProofType(request.category);
      request.status = proofType === 'service_only' ? 'accepted' : 'purchase_funded';
      request.completionVerified = 'rejected';
      request.verificationRejectionReason = rejectionReason || 'Senior reported the task was not completed.';

      await request.save();

      return res.status(200).json({
        success: true,
        message: 'Noted. The volunteer has been notified that the task needs attention.',
        request
      });
    }
  } catch (error) {
    console.error('Senior Verify Completion Error:', error);
    res.status(500).json({ success: false, message: 'Server error recording senior verification' });
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

// @desc    Step 11: Caregiver pays volunteer tip
// @route   PUT /api/requests/:id/pay-tip
// @access  Private (Family)
exports.payVolunteerTip = async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Help request not found' });

    const { tipAmount, paymentMethod, transactionId } = req.body;

    request.tipAmount = Number(tipAmount || 0);
    request.tipPaymentDetails = {
      amountPaid: Number(tipAmount || 0),
      transactionId: String(transactionId || ''),
      paymentMethod: String(paymentMethod || 'UPI'),
      paidAt: Date.now()
    };

    if (request.paymentDetails) {
      request.paymentDetails.tipAmount = Number(tipAmount || 0);
    }

    await request.save();

    const populatedRequest = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    res.status(200).json({
      success: true,
      message: 'Tip payment successful!',
      request: populatedRequest
    });
  } catch (error) {
    console.error('Pay Tip Error:', error);
    res.status(500).json({ success: false, message: 'Server error processing tip payment' });
  }
};

// @desc    Volunteer pays a merchant using the pre-funded escrow budget (Mock Gateway)
// @route   POST /api/requests/:id/volunteer-pay-purchase
// @access  Private (Volunteer only)
exports.volunteerPayPurchase = async (req, res) => {
  try {
    const {
      merchant,
      merchantType,
      merchantLocation,
      merchantPhone,
      paymentDestinationType,
      upiId,
      paymentLink,
      orderLink,
      itemName,
      quantity,
      amount,
      description,
      hasReceipt,
      noReceiptReason
    } = req.body;

    const request = await HelpRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    // Check 1: Volunteer assigned to this task?
    const assignedVolId = request.volunteer ? String(request.volunteer._id || request.volunteer.id || request.volunteer) : null;
    if (assignedVolId !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You are not the assigned volunteer for this task.' });
    }

    // Check 2: Task active?
    if (request.status !== 'accepted' && request.status !== 'purchase_funded' && request.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: `Cannot make merchant payment for task in status: ${request.status}` });
    }

    const amountNum = Math.round(Number(amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid purchase amount in ₹.' });
    }

    const merchantName = (merchant && merchant.trim()) || 'Merchant / Shop';
    const authorizedBudget = Number(request.allowedBudget || 0);

    // Calculate current spent from recorded purchases
    let currentSpent = 0;
    if (request.merchantPurchases && request.merchantPurchases.length > 0) {
      currentSpent = request.merchantPurchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    } else if (request.fundingMode !== 'pre_fund' && request.actualPurchaseCost && Number(request.actualPurchaseCost) > 0) {
      currentSpent = Number(request.actualPurchaseCost);
    }

    const remainingBudget = authorizedBudget > 0 ? (authorizedBudget - currentSpent) : Infinity;

    // Check 3: Amount <= Remaining Authorized Budget?
    if (authorizedBudget > 0 && amountNum > remainingBudget) {
      return res.status(400).json({
        success: false,
        message: `Amount ₹${amountNum} exceeds the remaining allocated budget of ₹${remainingBudget} (Allocated: ₹${authorizedBudget}, Spent: ₹${currentSpent}).`
      });
    }

    // Handle files uploaded (Receipt / QR photo)
    let receiptDocUrl = '';
    let upiQrImageUrl = '';
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const url = f.filename ? `/uploads/proofs/${f.filename}` : (f.secure_url || f.path);
        if (paymentDestinationType === 'upi_qr' && !upiQrImageUrl) {
          upiQrImageUrl = url;
        } else if (!receiptDocUrl) {
          receiptDocUrl = url;
        }
      }
    }

    const destType = paymentDestinationType || 'upi_id';
    let destDetail = '';
    if (destType === 'upi_id') destDetail = upiId ? ` (UPI ID: ${upiId})` : '';
    else if (destType === 'payment_link') destDetail = paymentLink ? ` (Link: ${paymentLink})` : '';
    else if (destType === 'online_order') destDetail = orderLink ? ` (Order: ${orderLink})` : '';
    else if (destType === 'upi_qr') destDetail = ' (via UPI QR)';

    const txnId = `TXN_AGEWELL_${Date.now()}`;
    const newPurchase = {
      merchant: merchantName,
      merchantType: merchantType || 'Pharmacy',
      merchantLocation: (merchantLocation && merchantLocation.trim()) || '',
      merchantPhone: (merchantPhone && merchantPhone.trim()) || '',
      paymentDestinationType: destType,
      upiId: (upiId && upiId.trim()) || '',
      upiQrImage: upiQrImageUrl,
      paymentLink: (paymentLink && paymentLink.trim()) || '',
      orderLink: (orderLink && orderLink.trim()) || '',
      itemName: (itemName && itemName.trim()) || (request.title || 'Purchase Item'),
      quantity: (quantity && String(quantity).trim()) || '1',
      amount: amountNum,
      description: (description && description.trim()) || '',
      hasReceipt: hasReceipt !== 'false' && hasReceipt !== false,
      noReceiptReason: (noReceiptReason && noReceiptReason.trim()) || '',
      receiptDoc: receiptDocUrl,
      transactionId: txnId,
      paidAt: new Date(),
      paymentProvider: 'MOCK_GATEWAY',
      status: 'SUCCESS'
    };

    if (!request.merchantPurchases) request.merchantPurchases = [];
    request.merchantPurchases.push(newPurchase);

    // Update total actualPurchaseCost
    const newTotalSpent = currentSpent + amountNum;
    request.actualPurchaseCost = newTotalSpent;
    request.purchaseFunded = true;
    request.purchaseFundedAt = new Date();
    request.status = 'purchase_funded';
    if (!request.merchantDetails) request.merchantDetails = {};
    request.merchantDetails.shopName = merchantName;
    if (upiId) request.merchantDetails.upiId = upiId;
    if (paymentLink) request.merchantDetails.paymentLink = paymentLink;

    if (receiptDocUrl) {
      if (!request.purchaseProofDocs) request.purchaseProofDocs = [];
      request.purchaseProofDocs.push(receiptDocUrl);
      request.purchaseProofDoc = receiptDocUrl;
    }

    await request.save();

    // Create Payment record log
    try {
      await Payment.create({
        request: request._id,
        caregiver: request.familyReviewedBy || request.senior,
        volunteer: req.user.id,
        paymentType: 'purchase',
        serviceCharge: 0,
        shoppingAmount: amountNum,
        totalAmount: amountNum,
        razorpayOrderId: txnId,
        razorpayPaymentId: `PAY_${txnId}`,
        status: 'Paid',
        paidAt: new Date()
      });
    } catch (payErr) {
      console.warn('Payment record log error:', payErr);
    }

    const updatedPopulated = await HelpRequest.findById(request._id)
      .populate('senior', 'name phone address emergencyContact')
      .populate('volunteer', 'name phone email skills');

    return res.status(200).json({
      success: true,
      message: `Payment Successful! ₹${amountNum} paid to ${merchantName}`,
      payment: {
        taskId: request._id,
        volunteerId: req.user.id,
        merchant: merchantName,
        amount: amountNum,
        type: 'PURCHASE',
        status: 'SUCCESS',
        paymentProvider: 'MOCK_GATEWAY'
      },
      budgetSummary: {
        authorized: authorizedBudget,
        spent: newTotalSpent,
        remaining: Math.max(0, authorizedBudget - newTotalSpent)
      },
      request: updatedPopulated
    });
  } catch (error) {
    console.error('Volunteer Pay Purchase Error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing merchant payment.' });
  }
};
