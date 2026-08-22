const mongoose = require('mongoose');

// ─── WalletTransaction Model ──────────────────────────────────────────────────
//
// Records all financial ledger events for the Caregiver Wallet:
//   - WALLET_TOPUP       : Caregiver adds funds to Available Balance (+)
//   - TASK_FUND          : Funds moved from Available to Reserved (-) for a task
//   - PURCHASE           : Task Funds paid directly to Merchant for items (-)
//   - BUDGET_EXTENSION   : Additional budget added to task (-)
//   - REFUND             : Unspent Task Funds returned from Reserved to Available (+)
//   - VOLUNTEER_EARNING  : Separate volunteer service fee paid upon verification (-)
// ──────────────────────────────────────────────────────────────────────────────

const walletTransactionSchema = new mongoose.Schema({
  caregiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpRequest',
    default: null,
    index: true
  },
  volunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: [
      'WALLET_TOPUP',
      'TASK_FUND',
      'PURCHASE',
      'BUDGET_EXTENSION',
      'REFUND',
      'VOLUNTEER_EARNING'
    ],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  direction: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'PENDING', 'FAILED'],
    default: 'SUCCESS'
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Pre-save helper to ensure transactionId if missing
walletTransactionSchema.pre('validate', function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.transactionId = `TXN-AGW-${timestamp}-${randomHex}`;
  }
  next();
});

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
