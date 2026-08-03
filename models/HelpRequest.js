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

  // ─── Audio attachment ───────────────────────────────────────────────────────
  audioFile: {
    type: String,
    default: ''
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'low'
  },

  // ─── Workflow status ───────────────────────────────────────────────────────
  // pending           → request raised, waiting for a volunteer
  // awaiting_approval → volunteer stepped up; waiting for family/caregiver OK
  // accepted          → family approved the volunteer (or no family linked)
  // completed         → volunteer finished the task
  status: {
    type: String,
    enum: ['pending', 'awaiting_approval', 'accepted', 'completed'],
    default: 'pending'
  },

  // ─── People involved ──────────────────────────────────────────────────────
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

  // ─── Family / Caregiver approval ──────────────────────────────────────────
  // 'none'     → no approval action yet
  // 'approved' → family gave the green light
  // 'rejected' → family rejected this volunteer
  familyApprovalStatus: {
    type: String,
    enum: ['none', 'approved', 'rejected'],
    default: 'none'
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
