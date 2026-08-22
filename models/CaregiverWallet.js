const mongoose = require('mongoose');

// ─── CaregiverWallet Model ───────────────────────────────────────────────────
//
// Manages simulated caregiver funds with strict separation between:
//   - availableBalance : Money available to allocate to tasks
//   - reservedBalance  : Money locked into active pre-funded tasks
//   - totalBalance     : availableBalance + reservedBalance
//
// Task funds NEVER become unrestricted volunteer wallet money.
// ──────────────────────────────────────────────────────────────────────────────

const caregiverWalletSchema = new mongoose.Schema({
  caregiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  availableBalance: {
    type: Number,
    required: true,
    default: 5000, // Initial welcome demo balance for seamless testing
    min: 0
  },
  reservedBalance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Total Balance virtual calculation
caregiverWalletSchema.virtual('totalBalance').get(function() {
  return (this.availableBalance || 0) + (this.reservedBalance || 0);
});

module.exports = mongoose.model('CaregiverWallet', caregiverWalletSchema);
