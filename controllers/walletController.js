const CaregiverWallet = require('../models/CaregiverWallet');
const WalletTransaction = require('../models/WalletTransaction');
const HelpRequest = require('../models/HelpRequest');
const User = require('../models/User');

// Helper to ensure a caregiver has a wallet record
async function getOrCreateWallet(caregiverId) {
  let wallet = await CaregiverWallet.findOne({ caregiver: caregiverId });
  if (!wallet) {
    wallet = await CaregiverWallet.create({
      caregiver: caregiverId,
      availableBalance: 5000, // Initial welcome demo funds for smooth testing
      reservedBalance: 0
    });
  }
  return wallet;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET CAREGIVER WALLET
// GET /api/wallet/caregiver
// ─────────────────────────────────────────────────────────────────────────────
exports.getCaregiverWallet = async (req, res) => {
  try {
    const caregiverId = req.user._id || req.user.id;
    const wallet = await getOrCreateWallet(caregiverId);
    const seniorIds = await getCaregiverSeniorIds(caregiverId);

    // Sync historical transactions
    await syncHistoricalWalletTransactions(caregiverId);

    // Fetch active funded/budgeted tasks to sync reserved balance accurately
    const activeFundedTasks = await HelpRequest.find({
      $or: [
        { senior: { $in: seniorIds } },
        { createdBy: caregiverId },
        { familyReviewedBy: caregiverId }
      ],
      status: { $nin: ['completed', 'rejected', 'cancelled', 'fulfilled_by_family'] },
      $or: [
        { fundingMode: 'pre_fund' },
        { authorizedAmount: { $gt: 0 } },
        { allowedBudget: { $gt: 0 } },
        { status: { $in: ['purchase_funded', 'purchase_cost_submitted', 'awaiting_verification'] } }
      ]
    });

    // Compute expected reserved funds from active tasks
    let liveReserved = 0;
    for (const task of activeFundedTasks) {
      let auth = Number(task.authorizedAmount || 0);
      if (auth <= 0 && task.allowedBudget) {
        auth = Number(task.allowedBudget);
        task.authorizedAmount = auth;
        task.remainingAmount = auth;
        task.fundingStatus = 'funded';
        await task.save();
      }
      liveReserved += auth;
    }

    // Sync reservedBalance
    wallet.reservedBalance = liveReserved;
    await wallet.save();

    const recentTxns = await WalletTransaction.find({ caregiver: caregiverId })
      .populate('request', 'title category status allowedBudget authorizedAmount')
      .populate('volunteer', 'name phone')
      .sort({ createdAt: -1 })
      .limit(10);

    const totalAvailable = Number(wallet.availableBalance || 0);
    const totalReserved = Number(wallet.reservedBalance || 0);
    const totalBalance = totalAvailable + totalReserved;

    res.status(200).json({
      success: true,
      wallet: {
        availableBalance: totalAvailable,
        reservedBalance: totalReserved,
        totalBalance: totalBalance,
        currency: wallet.currency || 'INR',
        activeFundedTaskCount: activeFundedTasks.length,
        updatedAt: wallet.updatedAt
      },
      recentTransactions: recentTxns
    });
  } catch (error) {
    console.error('Get Caregiver Wallet Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet information.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOP-UP CAREGIVER WALLET (Simulated Mock Gateway)
// POST /api/wallet/caregiver/topup
// ─────────────────────────────────────────────────────────────────────────────
exports.topUpCaregiverWallet = async (req, res) => {
  try {
    const caregiverId = req.user._id || req.user.id;
    const { amount, paymentMethod = 'UPI_MOCK' } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid top-up amount greater than ₹0.'
      });
    }

    const wallet = await getOrCreateWallet(caregiverId);

    // Atomically increment availableBalance
    wallet.availableBalance = (wallet.availableBalance || 0) + numAmount;
    await wallet.save();

    // Create transaction record
    const txn = await WalletTransaction.create({
      caregiver: caregiverId,
      type: 'WALLET_TOPUP',
      amount: numAmount,
      direction: 'CREDIT',
      status: 'SUCCESS',
      description: `Wallet Top-up via ${paymentMethod}`,
      metadata: {
        paymentMethod,
        simulated: true,
        gateway: 'AGEWELL_MOCK_GATEWAY'
      }
    });

    const totalBalance = (wallet.availableBalance || 0) + (wallet.reservedBalance || 0);

    res.status(200).json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} added to your wallet successfully.`,
      wallet: {
        availableBalance: wallet.availableBalance,
        reservedBalance: wallet.reservedBalance,
        totalBalance,
        currency: wallet.currency
      },
      transaction: txn
    });
  } catch (error) {
    console.error('Wallet Top-up Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process wallet top-up.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET WALLET TRANSACTIONS
// GET /api/wallet/caregiver/transactions
// ─────────────────────────────────────────────────────────────────────────────
exports.getWalletTransactions = async (req, res) => {
  try {
    const caregiverId = req.user._id || req.user.id;
    const { type, limit = 50, page = 1 } = req.query;

    // Automatically sync and back-populate transactions for all previous tasks
    await syncHistoricalWalletTransactions(caregiverId);

    const query = { caregiver: caregiverId };
    if (type && type !== 'ALL') {
      query.type = type;
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await WalletTransaction.countDocuments(query);
    const transactions = await WalletTransaction.find(query)
      .populate('request', 'title category status allowedBudget authorizedAmount')
      .populate('volunteer', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: transactions.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      transactions
    });
  } catch (error) {
    console.error('Get Wallet Transactions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction history.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL & RESERVED FUND TASKS (ACTIVE & COMPLETED)
// GET /api/wallet/caregiver/reserved-tasks
// ─────────────────────────────────────────────────────────────────────────────
exports.getReservedFundTasks = async (req, res) => {
  try {
    const caregiverId = req.user._id || req.user.id;
    const seniorIds = await getCaregiverSeniorIds(caregiverId);
    const { statusFilter = 'ALL' } = req.query;

    // Automatically sync transactions for historical consistency
    await syncHistoricalWalletTransactions(caregiverId);

    let filter = {
      $or: [
        { senior: { $in: seniorIds } },
        { createdBy: caregiverId },
        { familyReviewedBy: caregiverId }
      ]
    };

    if (statusFilter === 'ACTIVE') {
      filter.status = { $nin: ['completed', 'rejected', 'cancelled', 'fulfilled_by_family'] };
    } else if (statusFilter === 'COMPLETED') {
      filter.status = 'completed';
    }

    const allTasks = await HelpRequest.find(filter)
      .populate('senior', 'name phone address')
      .populate('volunteer', 'name phone email skills')
      .sort({ createdAt: -1 });

    const taskCards = allTasks.map(task => {
      const authorized = Number(task.authorizedAmount || task.allowedBudget || task.actualPurchaseCost || 0);
      let spent = 0;
      if (task.merchantPurchases && task.merchantPurchases.length > 0) {
        spent = task.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      } else if (task.actualPurchaseCost) {
        spent = Number(task.actualPurchaseCost);
      }
      const isCompleted = task.status === 'completed';
      const remaining = isCompleted ? 0 : Math.max(0, authorized - spent);
      const unspentRefunded = Math.max(0, authorized - spent);

      return {
        _id: task._id,
        title: task.title,
        category: task.category,
        urgency: task.urgency,
        status: task.status,
        fundingMode: task.fundingMode,
        fundingStatus: task.fundingStatus || (authorized > 0 ? (isCompleted ? 'settled' : 'funded') : 'not_funded'),
        settlementStatus: isCompleted ? 'settled' : (task.settlementStatus || 'unsettled'),
        authorizedAmount: authorized,
        spentAmount: spent,
        remainingAmount: remaining,
        unspentRefundedAmount: unspentRefunded,
        expectedRefundAmount: remaining,
        serviceFee: Number(task.serviceFee || 0),
        senior: task.senior,
        volunteer: task.volunteer,
        merchantPurchases: task.merchantPurchases || [],
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt
      };
    });

    res.status(200).json({
      success: true,
      count: taskCards.length,
      tasks: taskCards
    });
  } catch (error) {
    console.error('Get Reserved Fund Tasks Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tasks.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SYNC HISTORICAL WALLET TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────
async function syncHistoricalWalletTransactions(caregiverId) {
  try {
    const seniorIds = await getCaregiverSeniorIds(caregiverId);
    const tasks = await HelpRequest.find({
      $or: [
        { senior: { $in: seniorIds } },
        { createdBy: caregiverId },
        { familyReviewedBy: caregiverId }
      ]
    }).populate('volunteer', 'name phone');

    // 1. Ensure initial topup exists if no topups at all
    const topupCount = await WalletTransaction.countDocuments({ caregiver: caregiverId, type: 'WALLET_TOPUP' });
    if (topupCount === 0) {
      await WalletTransaction.create({
        caregiver: caregiverId,
        type: 'WALLET_TOPUP',
        amount: 5000,
        direction: 'CREDIT',
        status: 'SUCCESS',
        description: 'Welcome Account Top-up (Demo Testing Funds)',
        metadata: { gateway: 'AGEWELL_MOCK_GATEWAY' },
        createdAt: new Date(Date.now() - 86400000)
      });
    }

    for (const task of tasks) {
      const budget = Number(task.authorizedAmount || task.allowedBudget || 0);
      const isFunded = task.purchaseFunded || task.fundingMode === 'pre_fund' || budget > 0;
      const volId = task.volunteer?._id || task.volunteer;

      // 2. TASK_FUND transaction
      if (isFunded && budget > 0) {
        const hasFundTxn = await WalletTransaction.findOne({
          caregiver: caregiverId,
          request: task._id,
          type: 'TASK_FUND'
        });
        if (!hasFundTxn) {
          await WalletTransaction.create({
            caregiver: caregiverId,
            request: task._id,
            volunteer: volId,
            type: 'TASK_FUND',
            amount: budget,
            direction: 'DEBIT',
            status: 'SUCCESS',
            description: `Task Pre-Fund Allocated: "${task.title || 'Help Request'}"`,
            metadata: { taskId: task._id, authorizedBudget: budget },
            createdAt: task.purchaseFundedAt || task.acceptedAt || task.createdAt
          });
        }
      }

      // 3. PURCHASE transactions for each merchant purchase
      if (task.merchantPurchases && task.merchantPurchases.length > 0) {
        for (const p of task.merchantPurchases) {
          const amt = Number(p.amount || 0);
          if (amt > 0) {
            const hasPurchaseTxn = await WalletTransaction.findOne({
              caregiver: caregiverId,
              request: task._id,
              type: 'PURCHASE',
              amount: amt
            });
            if (!hasPurchaseTxn) {
              await WalletTransaction.create({
                caregiver: caregiverId,
                request: task._id,
                volunteer: volId,
                type: 'PURCHASE',
                amount: amt,
                direction: 'DEBIT',
                status: 'SUCCESS',
                description: `Merchant Purchase: ${p.merchant || 'Store'} (Item: ${p.itemName || 'Supplies'})`,
                metadata: {
                  taskId: task._id,
                  merchant: p.merchant,
                  merchantType: p.merchantType,
                  itemName: p.itemName,
                  receiptDoc: p.receiptDoc,
                  transactionId: p.transactionId
                },
                createdAt: p.paidAt || task.updatedAt
              });
            }
          }
        }
      }

      // 4. Completed tasks: REFUND of unspent balance & VOLUNTEER_EARNING
      if (task.status === 'completed') {
        let totalSpent = 0;
        if (task.merchantPurchases && task.merchantPurchases.length > 0) {
          totalSpent = task.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        } else if (task.actualPurchaseCost) {
          totalSpent = Number(task.actualPurchaseCost);
        }
        const unspent = Math.max(0, budget - totalSpent);

        if (budget > 0 && unspent > 0) {
          const hasRefund = await WalletTransaction.findOne({
            caregiver: caregiverId,
            request: task._id,
            type: 'REFUND'
          });
          if (!hasRefund) {
            await WalletTransaction.create({
              caregiver: caregiverId,
              request: task._id,
              volunteer: volId,
              type: 'REFUND',
              amount: unspent,
              direction: 'CREDIT',
              status: 'SUCCESS',
              description: `Unused Task Funds Returned: ₹${unspent} from Task "${task.title || 'Help Request'}"`,
              metadata: { taskId: task._id, authorizedBudget: budget, actualSpent: totalSpent, unspentReturned: unspent },
              createdAt: task.completedAt || task.updatedAt
            });
          }
        }

        const fee = Number(task.serviceFee || 0);
        if (fee > 0) {
          const hasFeeTxn = await WalletTransaction.findOne({
            caregiver: caregiverId,
            request: task._id,
            type: 'VOLUNTEER_EARNING'
          });
          if (!hasFeeTxn) {
            await WalletTransaction.create({
              caregiver: caregiverId,
              request: task._id,
              volunteer: volId,
              type: 'VOLUNTEER_EARNING',
              amount: fee,
              direction: 'DEBIT',
              status: 'SUCCESS',
              description: `Volunteer Service Charge Released for "${task.title || 'Help Request'}"`,
              metadata: { taskId: task._id, volunteerId: volId, serviceFee: fee },
              createdAt: task.completedAt || task.updatedAt
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('syncHistoricalWalletTransactions error:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL WALLET SERVICE HELPERS (Invoked by requestController)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moves funds from Caregiver Available Balance to Reserved Balance for a task.
 */
exports.fundTaskFromWallet = async (caregiverId, task, budgetAmount, volunteerId = null) => {
  const budgetNum = Number(budgetAmount);
  if (isNaN(budgetNum) || budgetNum <= 0) return { success: true };

  const wallet = await getOrCreateWallet(caregiverId);

  if (wallet.availableBalance < budgetNum) {
    const deficit = budgetNum - wallet.availableBalance;
    return {
      success: false,
      insufficientBalance: true,
      availableBalance: wallet.availableBalance,
      requiredAmount: budgetNum,
      deficit,
      message: `Insufficient wallet balance. You have ₹${wallet.availableBalance}, but ₹${budgetNum} is required. Please add ₹${deficit} to your wallet.`
    };
  }

  // Move from available to reserved
  wallet.availableBalance -= budgetNum;
  wallet.reservedBalance = (wallet.reservedBalance || 0) + budgetNum;
  await wallet.save();

  // Create TASK_FUND transaction record
  await WalletTransaction.create({
    caregiver: caregiverId,
    request: task._id,
    volunteer: volunteerId || task.volunteer,
    type: 'TASK_FUND',
    amount: budgetNum,
    direction: 'DEBIT',
    status: 'SUCCESS',
    description: `Task Pre-Fund Allocated: "${task.title || 'Help Task'}"`,
    metadata: {
      taskId: task._id,
      taskTitle: task.title,
      authorizedBudget: budgetNum,
      simulatedGateway: 'MOCK_GATEWAY'
    }
  });

  return {
    success: true,
    availableBalance: wallet.availableBalance,
    reservedBalance: wallet.reservedBalance
  };
};

/**
 * Records a merchant purchase paid directly from task reserved funds.
 */
exports.recordMerchantPurchaseTransaction = async (caregiverId, task, volunteerId, purchaseData) => {
  const amount = Number(purchaseData.amount || 0);
  if (amount <= 0) return;

  await WalletTransaction.create({
    caregiver: caregiverId,
    request: task._id,
    volunteer: volunteerId,
    type: 'PURCHASE',
    amount: amount,
    direction: 'DEBIT',
    status: 'SUCCESS',
    description: `Merchant Purchase: ${purchaseData.merchant || 'Store'} (Item: ${purchaseData.itemName || 'Supplies'})`,
    metadata: {
      taskId: task._id,
      taskTitle: task.title,
      merchant: purchaseData.merchant,
      merchantType: purchaseData.merchantType,
      itemName: purchaseData.itemName,
      hasReceipt: purchaseData.hasReceipt,
      receiptDoc: purchaseData.receiptDoc,
      transactionId: purchaseData.transactionId,
      paidAt: purchaseData.paidAt
    }
  });
};

/**
 * Finalizes task settlement when caregiver verifies task completion:
 *  - Deducts the full authorized reserve from reservedBalance.
 *  - Releases the unspent remaining balance back into availableBalance.
 *  - Creates a REFUND transaction for the returned unspent funds.
 */
exports.settleTaskWalletFunds = async (caregiverId, task, volunteerId, serviceCharge = 0) => {
  try {
    const wallet = await getOrCreateWallet(caregiverId);

    const authorized = Number(task.authorizedAmount || task.allowedBudget || 0);
    let spent = 0;
    if (task.merchantPurchases && task.merchantPurchases.length > 0) {
      spent = task.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    } else if (task.actualPurchaseCost) {
      spent = Number(task.actualPurchaseCost);
    }
    const unspentRefund = Math.max(0, authorized - spent);

    if (authorized > 0) {
      // Deduct authorized budget from reservedBalance
      wallet.reservedBalance = Math.max(0, (wallet.reservedBalance || 0) - authorized);

      // Return unused money to availableBalance
      if (unspentRefund > 0) {
        wallet.availableBalance = (wallet.availableBalance || 0) + unspentRefund;

        // Record REFUND transaction
        await WalletTransaction.create({
          caregiver: caregiverId,
          request: task._id,
          volunteer: volunteerId || task.volunteer,
          type: 'REFUND',
          amount: unspentRefund,
          direction: 'CREDIT',
          status: 'SUCCESS',
          description: `Unused Task Funds Returned: ₹${unspentRefund} from Task "${task.title || 'Help Task'}"`,
          metadata: {
            taskId: task._id,
            authorizedBudget: authorized,
            actualSpent: spent,
            unspentReturned: unspentRefund
          }
        });
      }

      await wallet.save();
    }

    // Record VOLUNTEER_EARNING transaction for transparency
    const serviceFeeNum = Number(serviceCharge || task.serviceFee || 0);
    if (serviceFeeNum > 0) {
      await WalletTransaction.create({
        caregiver: caregiverId,
        request: task._id,
        volunteer: volunteerId || task.volunteer,
        type: 'VOLUNTEER_EARNING',
        amount: serviceFeeNum,
        direction: 'DEBIT',
        status: 'SUCCESS',
        description: `Volunteer Service Charge Released for "${task.title || 'Help Task'}"`,
        metadata: {
          taskId: task._id,
          volunteerId: volunteerId || task.volunteer,
          serviceFee: serviceFeeNum
        }
      });
    }

    return {
      success: true,
      unspentRefund,
      availableBalance: wallet.availableBalance,
      reservedBalance: wallet.reservedBalance
    };
  } catch (error) {
    console.error('Settle Task Wallet Funds Error:', error);
    return { success: false, error: error.message };
  }
};

// Helper to get all senior IDs linked to a caregiver
async function getCaregiverSeniorIds(caregiverId) {
  const ids = [];
  try {
    const caregiver = await User.findById(caregiverId);
    if (caregiver && caregiver.linkedSenior) {
      ids.push(caregiver.linkedSenior);
    }
    const seniors = await User.find({
      role: 'senior',
      $or: [
        { familyMembers: caregiverId },
        { linkedSenior: caregiverId },
        { linkedFamily: caregiverId }
      ]
    }).select('_id');
    seniors.forEach(s => {
      if (!ids.some(id => String(id) === String(s._id))) {
        ids.push(s._id);
      }
    });
  } catch (err) {
    console.warn('getCaregiverSeniorIds error:', err);
  }
  return ids;
}
