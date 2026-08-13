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

  // ─── Caregiver Preferences ───────────────────────────────────────────────
  shoppingPreference: {
    type: String,
    trim: true,
    default: 'No Preference'
  },

  // ─── Workflow status (11-Step Escrow Lifecycle) ────────────────────────────
  // pending                 → Step 1: Senior raises request
  // quoted                  → Step 2: Volunteer quotes service charge
  // accepted                → Step 3: Caregiver selects volunteer
  // purchase_cost_submitted → Step 4-5: Volunteer submits actual purchase cost + cart proof
  // purchase_funded         → Step 6-7: Caregiver approves payment; money released for purchase
  // awaiting_verification   → Step 8-9: Volunteer completes task & uploads final store receipt
  // completed               → Step 10-11: Caregiver verifies receipt & releases volunteer service charge
  // fulfilled_by_family     → Caregiver fulfilled request directly
  // rejected                → Rejected / dismissed
  status: {
    type: String,
    enum: [
      'pending',
      'awaiting_approval',
      'quoted',
      'accepted',
      'purchase_cost_submitted',
      'purchase_funded',
      'awaiting_verification',
      'completed',
      'fulfilled_by_family',
      'rejected'
    ],
    default: 'pending'
  },

  // ─── Escrow & Purchase Cost Workflow Fields ─────────────────────────────────
  actualPurchaseCost: {
    type: Number,
    min: 0,
    default: 0
  },
  purchaseProofDoc: {
    type: String,
    default: ''
  },
  purchaseProofDocs: [{
    type: String
  }],
  purchaseNotes: {
    type: String,
    trim: true,
    default: ''
  },
  purchaseCostSubmittedAt: {
    type: Date
  },
  purchaseRejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  purchaseRejectedAt: {
    type: Date
  },
  purchaseFunded: {
    type: Boolean,
    default: false
  },
  purchaseFundedAt: {
    type: Date
  },
  purchasePaymentDetails: {
    amountPaid: Number,
    transactionId: String,
    paymentMethod: String,
    paidAt: Date
  },
  finalReceiptDoc: {
    type: String,
    default: ''
  },
  finalReceiptDocs: [{
    type: String
  }],
  receiptUploadedAt: {
    type: Date
  },
  serviceChargeReleased: {
    type: Boolean,
    default: false
  },
  serviceChargeReleasedAt: {
    type: Date
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
  tipAmount: {
    type: Number,
    default: 0
  },
  tipPaymentDetails: {
    amountPaid: Number,
    transactionId: String,
    paymentMethod: String,
    paidAt: Date
  },

  // ─── Volunteer Feedback (Submitted by Caregiver / Senior after payment) ────
  feedback: {
    costUtilization: { type: Number, min: 1, max: 5, default: 5 },
    speedTimeliness: { type: Number, min: 1, max: 5, default: 5 },
    taskCompletion: { type: String, enum: ['Completely', 'Partially', 'No'], default: 'Completely' },
    communication: { type: Number, min: 1, max: 5, default: 5 },
    chooseAgain: { type: String, enum: ['Yes', 'Maybe', 'No'], default: 'Yes' },
    additionalFeedback: { type: String, trim: true, default: '' },
    submittedAt: { type: Date }
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
