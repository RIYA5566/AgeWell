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

    // 1. Delete stale Earning records for requests that no longer exist, are cancelled, or are no longer assigned to this volunteer
    const earnings = await Earning.find({ volunteer: volunteerId }).select('request').lean();
    for (const e of earnings) {
      if (e.request) {
        const reqDoc = await HelpRequest.findById(e.request).select('status volunteer');
        if (!reqDoc || reqDoc.status === 'cancelled' || !reqDoc.volunteer || reqDoc.volunteer.toString() !== volunteerId.toString()) {
          await Earning.deleteOne({ _id: e._id });
        }
      }
    }

    // 2. Fetch all HelpRequests for this volunteer (excluding cancelled ones)
    const requests = await HelpRequest.find({ volunteer: volunteerId, status: { $ne: 'cancelled' } }).lean();

    // 2. Synchronize Earning records for each HelpRequest dynamically
    for (const r of requests) {
      const isReleased = r.status === 'completed' && r.serviceChargeReleased === true;

      // Find or create SERVICE_CHARGE earning
      let scEarning = await Earning.findOne({ volunteer: volunteerId, request: r._id, type: 'SERVICE_CHARGE' });
      if (!scEarning) {
        scEarning = await Earning.create({
          volunteer: volunteerId,
          request: r._id,
          amount: r.serviceFee || 0,
          type: 'SERVICE_CHARGE',
          status: isReleased ? 'RELEASED' : 'PENDING',
          taskTitle: r.title || 'Help Request',
          taskCategory: r.category || 'Other',
          createdAt: r.createdAt
        });
      } else {
        // Sync status if it is not already WITHDRAWN
        if (scEarning.status !== 'WITHDRAWN') {
          const targetStatus = isReleased ? 'RELEASED' : 'PENDING';
          if (scEarning.status !== targetStatus) {
            scEarning.status = targetStatus;
            scEarning.releasedAt = isReleased ? (r.serviceChargeReleasedAt || new Date()) : null;
            await scEarning.save();
          }
        }
      }

      // Find, create or sync TIP earning
      if (r.tipAmount && r.tipAmount > 0) {
        let tipEarning = await Earning.findOne({ volunteer: volunteerId, request: r._id, type: 'TIP' });
        if (!tipEarning) {
          tipEarning = await Earning.create({
            volunteer: volunteerId,
            request: r._id,
            amount: r.tipAmount,
            type: 'TIP',
            status: isReleased ? 'RELEASED' : 'PENDING',
            taskTitle: r.title || 'Help Request',
            taskCategory: r.category || 'Other',
            createdAt: r.createdAt
          });
        } else {
          if (tipEarning.status !== 'WITHDRAWN') {
            const targetStatus = isReleased ? 'RELEASED' : 'PENDING';
            if (tipEarning.status !== targetStatus) {
              tipEarning.status = targetStatus;
              tipEarning.releasedAt = isReleased ? (r.serviceChargeReleasedAt || new Date()) : null;
              await tipEarning.save();
            }
          }
        }
      } else {
        // Delete any obsolete tip earning if tipAmount is 0
        await Earning.deleteMany({ volunteer: volunteerId, request: r._id, type: 'TIP' });
      }
    }

    // 3. Fetch all synchronized Earning records from database
    const allEarnings = await Earning.find({ volunteer: volunteerId })
      .sort({ createdAt: -1 })
      .lean();

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
