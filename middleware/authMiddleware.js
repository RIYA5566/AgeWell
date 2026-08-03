const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify user is authenticated
const protect = async (req, res, next) => {
  let token;

  // 1. Check for token in cookies
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization Header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, please log in.' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'agewell_secret_key_2026_xyz');

    // Get user from database (exclude password field)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found. Session expired.' });
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    return res.status(401).json({ success: false, message: 'Session invalid or expired. Please login again.' });
  }
};

// Role authorization check
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role (${req.user ? req.user.role : 'guest'}) is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
