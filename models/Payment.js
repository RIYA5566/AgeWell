const mongoose = require('mongoose');

// ─── Payment Model ─────────────────────────────────────────────────────────────
//
// Records every real Razorpay payment made by a Caregiver.
// Three payment types map to three lifecycle moments:
//   purchase   → Caregiver funds volunteer's actual shopping cart (Step 6-7)
//   completion → Caregiver releases volunteer service charge after task (Step 10-11)
//   tip        → Caregiver gives optional bonus tip to volunteer
//
// Statuses:
//   Created → Razorpay Order created; checkout not yet done
//   Paid    → HMAC-SHA256 signature verified; backend updated
//   Failed  → Signature mismatch or payment rejected
//   Refunded → (future) Razorpay refund issued
// ──────────────────────────────────────────────────────────────────────────────

const paymentSchema = new mongoose.Schema({
  // Linked help request
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpRequest',
    required: true,
    index: true
  },

  // Who is paying (always the family caregiver)
  caregiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Who is being paid (volunteer, for audit/logging)
  volunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Payment type: which lifecycle step this covers
  paymentType: {
    type: String,
    enum: ['purchase', 'completion', 'tip'],
    required: true
  },

  // Amount breakdown (₹, stored as integers — always server-calculated)
  serviceCharge: {
    type: Number,
    default: 0
  },
  shoppingAmount: {
    type: Number,
    default: 0
  },
  tipAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 1
  },

  // Razorpay identifiers
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  razorpaySignature: {
    type: String,
    default: ''
  },

  // Payment lifecycle status
  status: {
    type: String,
    enum: ['Created', 'Paid', 'Failed', 'Refunded'],
    default: 'Created'
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
