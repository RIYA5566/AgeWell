const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper: create JWT, set cookie, and return user payload
const sendTokenResponse = (user, statusCode, res) => {
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

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
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
        verificationRejectionReason: user.verificationRejectionReason
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
      emergencyContact,
      skills,
      linkedSeniorEmail,
      relationship,
      aadhaarNumber,
      isPhoneVerified,
      isEmailVerified
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Build user object shared across all roles
    const userData = { name, email, password, role, phone, address };

    if (role === 'senior') {
      if (!emergencyContact) {
        return res.status(400).json({ success: false, message: 'Emergency contact is required for Senior Citizens' });
      }
      userData.emergencyContact = emergencyContact;
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
      if (!linkedSeniorEmail) {
        return res.status(400).json({ success: false, message: 'Please provide the Senior Citizen\'s email to link your account' });
      }
      const linkedSenior = await User.findOne({ email: linkedSeniorEmail.toLowerCase(), role: 'senior' });
      if (!linkedSenior) {
        return res.status(404).json({ success: false, message: `No Senior Citizen account found for email: ${linkedSeniorEmail}. Please ask your senior to register first.` });
      }
      userData.linkedSenior = linkedSenior._id;
      userData.relationship = relationship || 'Family Member';
    }

    // Create user
    const user = await User.create(userData);

    // Send JWT and User Info
    sendTokenResponse(user, 201, res);
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
    sendTokenResponse(user, 200, res);
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

// @desc    Get currently logged in user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
        verificationRejectionReason: user.verificationRejectionReason
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
};
