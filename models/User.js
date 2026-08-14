const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    // Added 'family' role for family members / caregivers
    enum: ['senior', 'volunteer', 'admin', 'family'],
    default: 'senior',
    required: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Please provide an address'],
    trim: true
  },

  // ─── Senior Citizen fields ────────────────────────────────────────────────
  emergencyContact: {
    type: String,
    required: function () { return this.role === 'senior'; }
  },

  // ─── Volunteer Verification & Trust fields ─────────────────────────────────
  skills: {
    type: [String],
    default: []
  },
  aadhaarNumber: {
    type: String,
    trim: true,
    default: ''
  },
  govtIdCard: {
    type: String,
    default: ''
  },
  selfiePhoto: {
    type: String,
    default: ''
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: true
  },
  isIdVerified: {
    type: Boolean,
    default: false
  },
  isPoliceVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified'
  },
  verificationRejectionReason: {
    type: String,
    default: ''
  },

  // ─── Family / Caregiver fields ───────────────────────────────────────────
  // Reference to the Senior Citizen this family member is caring for
  linkedSenior: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Human-readable relationship label (e.g. "Son", "Daughter", "Spouse")
  relationship: {
    type: String,
    trim: true,
    default: ''
  },

  // ─── Language Preference ──────────────────────────────────────────────────
  language: {
    type: String,
    enum: ['en', 'hi', 'mr'],
    default: 'en'
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});


// ─── Hash password before saving ──────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ─── Instance method: compare plain password to hash ──────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
