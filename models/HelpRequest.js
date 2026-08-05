const mongoose = require('mongoose');

const helpRequestSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    enum: ['Grocery Shopping', 'Medical Escort', 'Tech Support', 'Housekeeping', 'Companionship', 'Other'],
    default: 'Other'
  },

  // ─── Audio attachment & AI Speech Transcript ──────────────────────────────────
  audioFile: {
    type: String,
    default: ''
  },
  transcript: {
    type: String,
    trim: true,
    default: ''
  },
  aiConfidenceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 85
  },
  aiLowConfidence: {
    type: Boolean,
    default: false
  },

  // ─── AI Extracted Items & Platform Recommendations ───────────────────────
  extractedItems: {
    type: String,
    trim: true,
    default: ''
  },
  suggestedPlatforms: [
    {
      name: String,
      category: String,
      url: String,
      icon: String,
      color: String,
      searchQuery: String
    }
  ],

  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'low'
  },

  // ─── Workflow status ───────────────────────────────────────────────────────
  // pending             → request raised, open for volunteers
  // awaiting_approval   → request raised, waiting for family decision (fulfill self vs allot to volunteers)
  // accepted            → volunteer assigned and working
  // completed           → completed by volunteer
  // fulfilled_by_family → fulfilled directly by family caregiver
  status: {
    type: String,
    enum: ['pending', 'awaiting_approval', 'accepted', 'completed', 'fulfilled_by_family', 'rejected'],
    default: 'pending'
  },

  // ─── People involved & Volunteer Quote ─────────────────────────────────────
  senior: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  volunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  serviceFee: {
    type: Number,
    min: 0,
    default: 0
  },
  volunteerNotes: {
    type: String,
    trim: true,
    default: ''
  },
  volunteerQuotes: [{
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    serviceFee: {
      type: Number,
      min: 0,
      default: 0
    },
    volunteerNotes: {
      type: String,
      trim: true,
      default: ''
    },
    quotedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // ─── Family / Caregiver decision & fulfillment ────────────────────────────
  // 'none'                → no decision taken yet
  // 'approved'            → family allotted to volunteers
  // 'rejected'            → family rejected request / volunteer
  // 'fulfilled_by_family' → family fulfilled request themselves
  familyApprovalStatus: {
    type: String,
    enum: ['none', 'approved', 'rejected', 'fulfilled_by_family'],
    default: 'none'
  },
  fulfilledByFamily: {
    type: Boolean,
    default: false
  },
  familyReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  familyReviewedAt: {
    type: Date
  },
  familyRejectionReason: {
    type: String,
    trim: true,
    default: ''
  },

  // ─── Payment Details (Authorized by Caregiver upon Proof Verification) ──
  paymentDetails: {
    amountPaid: Number,
    itemsCost: Number,
    volunteerFee: Number,
    platformFee: Number,
    transactionId: String,
    paymentMethod: String,
    paidAt: Date
  },

  // ─── Task Completion Verification & Proof ───────────────────────────
  completionProof: {
    type: String,
    default: ''
  },
  completionVerified: {
    type: String,
    enum: ['none', 'pending_verification', 'verified', 'rejected'],
    default: 'none'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifierRole: {
    type: String,
    enum: ['none', 'family', 'senior_voice_ivr'],
    default: 'none'
  },
  verifiedAt: {
    type: Date
  },
  verificationRejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  requiresSeniorVoiceCall: {
    type: Boolean,
    default: false
  },
  seniorVoiceCallConfirmed: {
    type: Boolean,
    default: false
  },

  // ─── Timestamps ────────────────────────────────────────────────────────────
  resolutionNotes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
});

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
