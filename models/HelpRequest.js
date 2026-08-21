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
      searchQuery: String,
      bestFor: String,
      suitability: String
    }
  ],

  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'low'
  },

  // ─── Proof Hierarchy: Task Type Classification ────────────────────────────────
  // Determines which verification path the task follows:
  //   'service_only' → Companionship, Tech Support, Housekeeping
  //                    No purchase; volunteer just marks done; senior/family confirms.
  //   'financial'    → Grocery Shopping
  //                    Purchase always involved; full 11-step escrow bill flow.
  //   'mixed'        → Medical Escort, Other
  //                    Volunteer declares at completion time whether a purchase was made.
  taskProofType: {
    type: String,
    enum: ['service_only', 'financial', 'mixed'],
    default: 'mixed'
  },
  // For 'mixed' tasks: did the volunteer declare making a purchase?
  // Set when volunteer submits completion (true = trigger escrow; false = direct verification)
  volunteerDeclaredPurchase: {
    type: Boolean,
    default: false
  },

  // ─── Caregiver Preferences & Budget Estimate ─────────────────────────────
  shoppingPreference: {
    type: String,
    trim: true,
    default: 'No Preference'
  },
  allowedBudget: {
    type: Number,
    min: 0,
    default: null
  },
  fundingMode: {
    type: String,
    enum: ['pre_fund', 'caregiver_direct'],
    default: 'caregiver_direct'
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
      'rejected',
      'cancelled'
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
  // ─── Direct Merchant / Shop Payment Details (Caregiver Pays Directly mode) ──
  merchantDetails: {
    shopName: {
      type: String,
      trim: true,
      default: ''
    },
    paymentType: {
      type: String,
      enum: ['offline_qr', 'online_link', 'upi_id', 'other'],
      default: 'offline_qr'
    },
    upiId: {
      type: String,
      trim: true,
      default: ''
    },
    upiQrImage: {
      type: String,
      default: ''
    },
    paymentLink: {
      type: String,
      trim: true,
      default: ''
    },
    orderNumber: {
      type: String,
      trim: true,
      default: ''
    },
    merchantPhone: {
      type: String,
      trim: true,
      default: ''
    }
  },
  merchantPurchases: [{
    merchant: { type: String, trim: true },
    merchantType: { type: String, default: 'Pharmacy' },
    merchantLocation: { type: String, default: '' },
    merchantPhone: { type: String, default: '' },
    paymentDestinationType: { type: String, enum: ['upi_qr', 'upi_id', 'payment_link', 'online_order', 'other'], default: 'upi_id' },
    upiId: { type: String, default: '' },
    upiQrImage: { type: String, default: '' },
    paymentLink: { type: String, default: '' },
    orderLink: { type: String, default: '' },
    itemName: { type: String, default: '' },
    quantity: { type: String, default: '1' },
    amount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    hasReceipt: { type: Boolean, default: true },
    noReceiptReason: { type: String, default: '' },
    receiptDoc: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
    paymentProvider: { type: String, default: 'MOCK_GATEWAY' },
    status: { type: String, default: 'SUCCESS' }
  }],
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

  // ─── Upfront Service Fee Payment (service_only tasks) ────────────────────────
  // For Companionship / Tech / Housekeeping tasks, the caregiver pre-pays the
  // service charge when allotting the volunteer. Released on task verification.
  serviceFeePrePaid: {
    type: Boolean,
    default: false
  },
  serviceFeePrePaidAt: {
    type: Date
  },
  serviceFeePrePaymentDetails: {
    amountPaid: Number,
    transactionId: String,
    paymentMethod: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paidAt: Date
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
  pendingVolunteer: {
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
    enum: ['none', 'family', 'senior', 'senior_voice_ivr', 'admin'],
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
