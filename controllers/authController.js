const User = require('../models/User');
const HelpRequest = require('../models/HelpRequest');
const jwt = require('jsonwebtoken');

// Helper: create JWT, set cookie, and return user payload
const sendTokenResponse = async (user, statusCode, res) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'agewell_secret_key_2026_xyz',
    { expiresIn: '24h' }
  );

  const cookieOptions = {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'lax'
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  let ratingStats = null;
  if (user.role === 'volunteer') {
    ratingStats = await getVolunteerRatingStats(user._id);
  }

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        emergencyContact: user.emergencyContact,
        skills: user.skills,
        linkedSenior: user.linkedSenior,
        relationship: user.relationship,
        aadhaarNumber: user.aadhaarNumber,
        govtIdCard: user.govtIdCard,
        selfiePhoto: user.selfiePhoto,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
        isIdVerified: user.isIdVerified,
        isPoliceVerified: user.isPoliceVerified,
        verificationStatus: user.verificationStatus,
        verificationRejectionReason: user.verificationRejectionReason,
        language: user.language || 'en',
        ratingStats
      }
    });
};


// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      address,
      dob,
      age,
      gender,
      idDocType,
      emergencyContact,
      skills,
      linkedSeniorEmail,
      relationship,
      aadhaarNumber,
      isPhoneVerified,
      isEmailVerified,
      language
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Build user object shared across all roles
    const userData = { name, email, password, role, phone, address, language: language || 'en' };

    if (role === 'senior') {
      let seniorAge = Number(age);
      if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        seniorAge = calculatedAge;
        userData.dob = dob;
      }
      if (!seniorAge || isNaN(seniorAge) || seniorAge < 60) {
        return res.status(400).json({
          success: false,
          message: 'Senior Citizen registration requires age 60 or above.'
        });
      }
      if (!emergencyContact) {
        return res.status(400).json({ success: false, message: 'Emergency contact is required for Senior Citizens' });
      }
      userData.age = seniorAge;
      userData.emergencyContact = emergencyContact;
      userData.idDocType = idDocType || 'Aadhaar Card';
      userData.isSeniorVerified = true;

      if (req.files && req.files.seniorIdCard && req.files.seniorIdCard[0]) {
        userData.seniorIdCard = `/uploads/kyc/${req.files.seniorIdCard[0].filename}`;
      } else if (req.files && req.files.govtIdCard && req.files.govtIdCard[0]) {
        userData.seniorIdCard = `/uploads/kyc/${req.files.govtIdCard[0].filename}`;
      }

      if (gender) {
        userData.gender = gender;
      }
    } else if (role === 'volunteer') {
      userData.skills = Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []);
      userData.aadhaarNumber = aadhaarNumber || '';
      userData.isPhoneVerified = isPhoneVerified === 'true' || isPhoneVerified === true;
      userData.isEmailVerified = isEmailVerified === 'true' || isEmailVerified === true;

      if (req.files) {
        if (req.files.govtIdCard && req.files.govtIdCard[0]) {
          userData.govtIdCard = `/uploads/kyc/${req.files.govtIdCard[0].filename}`;
        }
        if (req.files.selfiePhoto && req.files.selfiePhoto[0]) {
          userData.selfiePhoto = `/uploads/kyc/${req.files.selfiePhoto[0].filename}`;
        }
      }

      // If documents or aadhaar submitted, set status to pending review
      if (userData.govtIdCard || userData.selfiePhoto || userData.aadhaarNumber) {
        userData.verificationStatus = 'pending';
      } else {
        userData.verificationStatus = 'unverified';
      }
    } else if (role === 'family') {
      // Family members must link to an existing Senior Citizen by email
      const seniorEmail = (linkedSeniorEmail || '').trim().toLowerCase();
      if (!seniorEmail) {
        return res.status(400).json({ success: false, message: 'Please provide the Senior Citizen\'s registered email address to link your account.' });
      }
      const linkedSenior = await User.findOne({ email: seniorEmail, role: 'senior' });
      if (!linkedSenior) {
        return res.status(404).json({
          success: false,
          message: `No registered Senior Citizen found with email: "${seniorEmail}". Please ask your senior to register their AgeWell account first.`
        });
      }
      userData.linkedSenior = linkedSenior._id;
      userData.relationship = relationship || 'Family Member';
    }

    // Create user
    const user = await User.create(userData);

    // Send JWT and User Info
    await sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during registration' });
  }
};

// @desc    Submit / update KYC verification documents for logged in volunteer
// @route   POST /api/auth/kyc
// @access  Private (Volunteer)
exports.submitKYC = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can submit KYC documents' });
    }

    const { aadhaarNumber } = req.body;
    if (aadhaarNumber) user.aadhaarNumber = aadhaarNumber;

    if (req.files) {
      if (req.files.govtIdCard && req.files.govtIdCard[0]) {
        user.govtIdCard = `/uploads/kyc/${req.files.govtIdCard[0].filename}`;
      }
      if (req.files.selfiePhoto && req.files.selfiePhoto[0]) {
        user.selfiePhoto = `/uploads/kyc/${req.files.selfiePhoto[0].filename}`;
      }
    }

    user.isPhoneVerified = true;
    user.isEmailVerified = true;
    user.verificationStatus = 'pending';
    user.verificationRejectionReason = '';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'KYC documents submitted successfully! Admin & Police verification is now pending review.',
      user
    });
  } catch (error) {
    console.error('Submit KYC Error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting KYC documents' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Send JWT and User Info
    await sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Private (or Public)
exports.logoutUser = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // expire in 10s
    httpOnly: true
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

const { getVolunteerRatingStats } = require('../utils/ratingStats');

// @desc    Get currently logged in user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let ratingStats = null;
    if (user.role === 'volunteer') {
      ratingStats = await getVolunteerRatingStats(user._id);
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        emergencyContact: user.emergencyContact,
        skills: user.skills,
        linkedSenior: user.linkedSenior,
        relationship: user.relationship,
        aadhaarNumber: user.aadhaarNumber,
        govtIdCard: user.govtIdCard,
        selfiePhoto: user.selfiePhoto,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
        isIdVerified: user.isIdVerified,
        isPoliceVerified: user.isPoliceVerified,
        verificationStatus: user.verificationStatus,
        verificationRejectionReason: user.verificationRejectionReason,
        language: user.language || 'en',
        ratingStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
};

// @desc    Get rating statistics for a volunteer by ID
// @route   GET /api/auth/volunteer-stats/:id
// @access  Private
exports.getVolunteerStats = async (req, res) => {
  try {
    const stats = await getVolunteerRatingStats(req.params.id);
    const volunteerUser = await User.findById(req.params.id).select('name email phone skills verificationStatus isIdVerified isPoliceVerified createdAt');

    // Also fetch recent completed requests with reviews/feedback
    const reviewedRequests = await HelpRequest.find({
      volunteer: req.params.id,
      status: 'completed'
    })
      .select('title category feedback createdAt senior')
      .populate('senior', 'name')
      .sort({ 'feedback.submittedAt': -1, createdAt: -1 })
      .limit(20);

    const reviews = reviewedRequests.map(r => {
      const fb = r.feedback || {};
      const cost = fb.costUtilization || 5;
      const speed = fb.speedTimeliness || 5;
      const comm = fb.communication || 5;
      const avg = Number(((cost + speed + comm) / 3).toFixed(1));
      return {
        id: r._id,
        title: r.title,
        category: r.category,
        seniorName: r.senior?.name || 'Senior Citizen',
        costUtilization: cost,
        speedTimeliness: speed,
        communication: comm,
        overallRating: avg,
        chooseAgain: fb.chooseAgain || 'Yes',
        comment: fb.additionalFeedback || fb.notes || '',
        submittedAt: fb.submittedAt || r.createdAt
      };
    });

    res.status(200).json({
      success: true,
      stats,
      volunteer: volunteerUser,
      reviews
    });
  } catch (error) {
    console.error('Get Volunteer Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error getting volunteer stats' });
  }
};
// @desc    Update language preference
// @route   PATCH /api/auth/language
// @access  Private
exports.updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    if (!['en', 'hi', 'mr'].includes(language)) {
      return res.status(400).json({ success: false, message: 'Invalid language. Use en, hi, or mr.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { language },
      { new: true }
    );
    res.status(200).json({ success: true, language: user.language });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating language' });
  }
};

// @desc    Check if a Senior Citizen exists with given email (live lookup for family registration)
// @route   GET /api/auth/check-senior?email=...
// @access  Public
exports.checkSeniorCitizen = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email to check' });
    }

    const senior = await User.findOne({ email: email.trim().toLowerCase(), role: 'senior' }).select('name email age address');
    if (!senior) {
      return res.status(404).json({
        success: false,
        found: false,
        message: `No registered Senior Citizen found with email "${email}". Please ensure your senior has created an account first.`
      });
    }

    res.status(200).json({
      success: true,
      found: true,
      senior: {
        id: senior._id,
        name: senior.name,
        email: senior.email,
        age: senior.age
      },
      message: `Verified Senior: ${senior.name}${senior.age ? ` (${senior.age}y)` : ''}`
    });
  } catch (error) {
    console.error('Check Senior Error:', error);
    res.status(500).json({ success: false, message: 'Server error checking senior citizen account' });
  }
};
