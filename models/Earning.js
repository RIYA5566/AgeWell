const mongoose = require('mongoose');

// ─── Earning / Transaction Model ─────────────────────────────────────────────
//
// Every financial event for a volunteer is recorded here as a separate document.
// This keeps volunteer earnings cleanly separated from:
//   - Shopping deposits (caregiver money for purchasing items)
//   - The User document (no single totalEarned field that can drift)
//
// Earning Types:
//   SERVICE_CHARGE  — the quoted service fee earned for completing a task
//   TIP             — a bonus tip awarded by the caregiver after task completion
//
// Earning Statuses:
//   PENDING   — service charge accepted/quoted; waiting for caregiver verification
//   RELEASED  — caregiver verified task completion; money available to withdraw
//   WITHDRAWN — volunteer initiated a (simulated) withdrawal
// ──────────────────────────────────────────────────────────────────────────────

const earningSchema = new mongoose.Schema({
  volunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpRequest',
    required: true
  },

  // Amount in ₹ (service charge or tip — never includes shopping deposit)
  amount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  // Type of earning
  type: {
    type: String,
    enum: ['SERVICE_CHARGE', 'TIP'],
    default: 'SERVICE_CHARGE'
  },

  // Lifecycle status
  status: {
    type: String,
    enum: ['PENDING', 'RELEASED', 'WITHDRAWN'],
    default: 'PENDING'
  },

  // Snapshot of the task title for display in transaction history
  taskTitle: {
    type: String,
    trim: true,
    default: ''
  },

  // Snapshot of the task category for display
  taskCategory: {
    type: String,
    trim: true,
    default: ''
  },

  // When the earning was created (service charge assigned) or tip awarded
  createdAt: {
    type: Date,
    default: Date.now
  },

  // When the earning was released (caregiver verified completion)
  releasedAt: {
    type: Date
  },

  // When the volunteer withdrew (simulated)
  withdrawnAt: {
    type: Date
  },

  // Simulated withdrawal transaction ID
  withdrawalTransactionId: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Earning', earningSchema);
