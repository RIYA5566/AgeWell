const HelpRequest = require('../models/HelpRequest');
const Earning = require('../models/Earning');

// ─── Helper: generate a simulated withdrawal transaction ID ──────────────────
function generateWithdrawalId() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `AW-WD-${digits}`;
}

// ─── Helper: category icon map ────────────────────────────────────────────────
function categoryIcon(cat) {
  const icons = {
    'Grocery Shopping': '🛒',
    'Medical Escort': '🏥',
    'Tech Support': '💻',
    'Housekeeping': '🏠',
    'Companionship': '💬',
    'Other': '⭐'
  };
  return icons[cat] || '⭐';
}

// @desc    Get volunteer wallet summary + transaction history
// @route   GET /api/volunteer/earnings
// @access  Private (Volunteer)
exports.getEarnings = async (req, res) => {
  try {
    const volunteerId = req.user.id;

    // ── 1. Fetch all Earning records for this volunteer ───────────────────────
    const dbEarnings = await Earning.find({ volunteer: volunteerId })
      .sort({ createdAt: -1 })
      .lean();

    // ── 2. Fallback: derive earnings from completed HelpRequests for tasks ────
    //    that existed before the Earning model was introduced (backward compat).
    //    We only include requests that don't already have an Earning record.
    const coveredRequestIds = new Set(dbEarnings.map(e => e.request.toString()));

    const legacyRequests = await HelpRequest.find({
      volunteer: volunteerId,
      status: 'completed',
      serviceChargeReleased: true
    })
      .select('_id title category serviceFee tipAmount serviceChargeReleasedAt completedAt createdAt')
      .lean();

    // Build synthetic earning records from legacy completed requests
    const legacyEarnings = [];
    for (const r of legacyRequests) {
      if (!coveredRequestIds.has(r._id.toString())) {
        // Service charge earning (RELEASED because task is completed)
        legacyEarnings.push({
          _id: `legacy-sc-${r._id}`,
          volunteer: volunteerId,
          request: r._id,
          amount: r.serviceFee || 0,
          type: 'SERVICE_CHARGE',
          status: 'RELEASED',
          taskTitle: r.title || 'Completed Task',
          taskCategory: r.category || 'Other',
          createdAt: r.serviceChargeReleasedAt || r.completedAt || r.createdAt,
          releasedAt: r.serviceChargeReleasedAt || r.completedAt
        });
        // Tip earning (if any)
        if (r.tipAmount && r.tipAmount > 0) {
          legacyEarnings.push({
            _id: `legacy-tip-${r._id}`,
            volunteer: volunteerId,
            request: r._id,
            amount: r.tipAmount,
            type: 'TIP',
            status: 'RELEASED',
            taskTitle: r.title || 'Completed Task',
            taskCategory: r.category || 'Other',
            createdAt: r.serviceChargeReleasedAt || r.completedAt || r.createdAt,
            releasedAt: r.serviceChargeReleasedAt || r.completedAt
          });
        }
      }
    }

    // Also: include PENDING earnings for tasks in-flight (accepted → awaiting_verification)
    // These are tasks accepted by this volunteer but not yet completed.
    // Only if not already covered by an Earning record.
    const pendingRequests = await HelpRequest.find({
      volunteer: volunteerId,
      status: { $in: ['accepted', 'purchase_cost_submitted', 'purchase_funded', 'awaiting_verification'] },
      serviceChargeReleased: false
    })
      .select('_id title category serviceFee createdAt acceptedAt')
      .lean();

    const legacyPendingEarnings = [];
    for (const r of pendingRequests) {
      if (!coveredRequestIds.has(r._id.toString())) {
        legacyPendingEarnings.push({
          _id: `pending-${r._id}`,
          volunteer: volunteerId,
          request: r._id,
          amount: r.serviceFee || 0,
          type: 'SERVICE_CHARGE',
          status: 'PENDING',
          taskTitle: r.title || 'Active Task',
          taskCategory: r.category || 'Other',
          createdAt: r.acceptedAt || r.createdAt
        });
      }
    }

    // ── 3. Merge all earnings (DB + legacy released + legacy pending) ─────────
    const allEarnings = [...dbEarnings, ...legacyEarnings, ...legacyPendingEarnings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ── 4. Calculate wallet summary ───────────────────────────────────────────
    let totalEarned = 0;   // sum of all RELEASED + WITHDRAWN
    let available = 0;     // sum of RELEASED (can be withdrawn)
    let pending = 0;       // sum of PENDING (waiting for verification)
    let totalWithdrawn = 0; // sum of WITHDRAWN

    for (const e of allEarnings) {
      if (e.status === 'RELEASED') {
        totalEarned += e.amount;
        available += e.amount;
      } else if (e.status === 'WITHDRAWN') {
        totalEarned += e.amount;
        totalWithdrawn += e.amount;
        // Withdrawn amounts don't add to available
      } else if (e.status === 'PENDING') {
        pending += e.amount;
      }
    }

    // ── 5. Monthly stats (current calendar month) ─────────────────────────────
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyEarnings = allEarnings.filter(e =>
      new Date(e.createdAt) >= startOfMonth &&
      (e.status === 'RELEASED' || e.status === 'WITHDRAWN')
    );

    const monthlyTotal = monthlyEarnings.reduce((sum, e) => sum + e.amount, 0);
    // Count distinct requests this month (completed tasks, not tips as separate tasks)
    const monthlyTaskIds = new Set(
      monthlyEarnings
        .filter(e => e.type === 'SERVICE_CHARGE')
        .map(e => e.request.toString())
    );
    const monthlyTasksCompleted = monthlyTaskIds.size;
    const monthlyAvgPerTask = monthlyTasksCompleted > 0
      ? Math.round(monthlyTotal / monthlyTasksCompleted)
      : 0;

    // ── 6. Format transaction list for the frontend ───────────────────────────
    const transactions = allEarnings.map(e => ({
      id: e._id,
      taskTitle: e.taskTitle,
      taskCategory: e.taskCategory,
      categoryIcon: categoryIcon(e.taskCategory),
      amount: e.amount,
      type: e.type,
      status: e.status,
      date: e.createdAt,
      releasedAt: e.releasedAt || null,
      withdrawnAt: e.withdrawnAt || null,
      withdrawalTransactionId: e.withdrawalTransactionId || ''
    }));

    res.status(200).json({
      success: true,
      wallet: {
        totalEarned: Math.round(totalEarned),
        available: Math.round(available),
        pending: Math.round(pending),
        totalWithdrawn: Math.round(totalWithdrawn)
      },
      monthly: {
        tasksCompleted: monthlyTasksCompleted,
        totalEarned: Math.round(monthlyTotal),
        avgPerTask: monthlyAvgPerTask,
        month: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      },
      transactions
    });
  } catch (error) {
    console.error('Get Earnings Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching earnings' });
  }
};

// @desc    Simulate a wallet withdrawal (marks RELEASED earnings as WITHDRAWN)
// @route   POST /api/volunteer/withdraw
// @access  Private (Volunteer)
exports.withdrawEarnings = async (req, res) => {
  try {
    const volunteerId = req.user.id;

    // Find all RELEASED earnings (from DB — legacy earnings handled separately)
    const releasedEarnings = await Earning.find({
      volunteer: volunteerId,
      status: 'RELEASED'
    });

    // Also check legacy (from HelpRequest directly) — if no DB earnings exist at all
    // We need to calculate available balance across both sources
    const dbAvailable = releasedEarnings.reduce((sum, e) => sum + e.amount, 0);

    // Calculate total available balance (DB + legacy)
    const allEarningsRes = await exports.getEarningsData(volunteerId);
    const totalAvailable = allEarningsRes.wallet.available;

    if (totalAvailable <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No available balance to withdraw'
      });
    }

    const transactionId = generateWithdrawalId();
    const withdrawnAt = new Date();

    // Mark all DB RELEASED earnings as WITHDRAWN
    if (releasedEarnings.length > 0) {
      await Earning.updateMany(
        { volunteer: volunteerId, status: 'RELEASED' },
        {
          $set: {
            status: 'WITHDRAWN',
            withdrawnAt,
            withdrawalTransactionId: transactionId
          }
        }
      );
    }

    res.status(200).json({
      success: true,
      message: `Withdrawal of ₹${totalAvailable} initiated successfully!`,
      withdrawal: {
        amount: totalAvailable,
        transactionId,
        withdrawnAt,
        bankAccount: 'XXXX XXXX 4821',
        estimatedArrival: '2-3 business days'
      }
    });
  } catch (error) {
    console.error('Withdraw Earnings Error:', error);
    res.status(500).json({ success: false, message: 'Server error processing withdrawal' });
  }
};

// ─── Internal helper used by withdrawEarnings ─────────────────────────────────
exports.getEarningsData = async (volunteerId) => {
  const dbEarnings = await Earning.find({ volunteer: volunteerId }).lean();
  const coveredRequestIds = new Set(dbEarnings.map(e => e.request.toString()));

  const legacyRequests = await HelpRequest.find({
    volunteer: volunteerId,
    status: 'completed',
    serviceChargeReleased: true
  }).select('_id serviceFee tipAmount serviceChargeReleasedAt completedAt').lean();

  let available = dbEarnings
    .filter(e => e.status === 'RELEASED')
    .reduce((s, e) => s + e.amount, 0);

  for (const r of legacyRequests) {
    if (!coveredRequestIds.has(r._id.toString())) {
      available += r.serviceFee || 0;
      available += r.tipAmount || 0;
    }
  }

  return { wallet: { available: Math.round(available) } };
};
