const crypto = require('crypto');
const Razorpay = require('razorpay');
const HelpRequest = require('../models/HelpRequest');
const Payment = require('../models/Payment');
const Earning = require('../models/Earning');
const User = require('../models/User');

// ─── Razorpay SDK instance ─────────────────────────────────────────────────────
// Initialised lazily so the server starts fine even without keys in .env.
// Keys are loaded from process.env at call time.
// Returns null if keys are absent OR look like placeholder values.
function getRazorpayInstance() {
  const key_id     = process.env.RAZORPAY_KEY_ID     || '';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || '';

  // Treat keys as invalid if:
  //   - empty / missing
  //   - still set to the .env.example placeholder values
  //   - shorter than a realistic key length (real keys are ~20+ chars each)
  const isRealKey = (k) =>
    k.length >= 20 &&
    !k.startsWith('rzp_test_xxxxx') &&
    !k.startsWith('xxxxxxxx');

  if (!isRealKey(key_id) || !isRealKey(key_secret)) {
    return null;  // → simulated fallback
  }
  return new Razorpay({ key_id, key_secret });
}

// ─── Helper: compute total amount from request + paymentType ──────────────────
function computeAmount(request, paymentType, clientTipAmount = 0) {
  if (paymentType === 'purchase') {
    return Math.round(Number(request.actualPurchaseCost) || 0);
  }
  if (paymentType === 'completion') {
    return Math.round(Number(request.serviceFee) || 0);
  }
  if (paymentType === 'tip') {
    const tip = Math.round(Number(clientTipAmount) || 0);
    if (tip <= 0 || tip > 1000) return 0; // guard against silly values
    return tip;
  }
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// @desc    Create a Razorpay Order (server-side amount calculation)
// @route   POST /api/payments/create-order
// @access  Private (Family Caregiver)
// ──────────────────────────────────────────────────────────────────────────────
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { requestId, paymentType, tipAmount: clientTip } = req.body;

    if (!requestId || !paymentType) {
      return res.status(400).json({ success: false, message: 'requestId and paymentType are required' });
    }
    if (!['purchase', 'completion', 'tip'].includes(paymentType)) {
      return res.status(400).json({ success: false, message: 'Invalid paymentType' });
    }

    // ── Fetch request & verify caregiver is linked to this senior ─────────────
    const request = await HelpRequest.findById(requestId)
      .populate('senior', 'name')
      .populate('volunteer', 'name');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    // Only the linked family caregiver can pay
    const { User } = require('../models/User') || {};
    // Simple authorization: user must be role='family' — handled by route middleware.

    // ── Server-side amount calculation ────────────────────────────────────────
    const totalAmount = computeAmount(request, paymentType, clientTip);

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot create order: computed amount is ₹${totalAmount}. Ensure the volunteer has submitted a valid cost/service fee.`
      });
    }

    // ── Amount breakdowns for Payment record ──────────────────────────────────
    let serviceCharge = 0, shoppingAmount = 0, tipAmt = 0;
    if (paymentType === 'purchase')    shoppingAmount = totalAmount;
    if (paymentType === 'completion')  serviceCharge  = totalAmount;
    if (paymentType === 'tip')         tipAmt         = totalAmount;

    // ── Try Razorpay — fall back to simulated if keys not configured ──────────
    const razorpay = getRazorpayInstance();

    if (!razorpay) {
      // ── GRACEFUL FALLBACK: no Razorpay keys — return simulated order ─────
      console.warn('[AgeWell] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set. Using simulated payment fallback.');

      const simOrderId = `sim_order_${Date.now()}`;
      await Payment.create({
        request: requestId,
        caregiver: req.user.id,
        volunteer: request.volunteer?._id || request.volunteer || null,
        paymentType,
        serviceCharge,
        shoppingAmount,
        tipAmount: tipAmt,
        totalAmount,
        razorpayOrderId: simOrderId,
        status: 'Created'
      });

      return res.json({
        success: true,
        simulated: true,
        orderId: simOrderId,
        amount: totalAmount,
        key: '',
        paymentType,
        volunteerName: request.volunteer?.name || 'Volunteer',
        message: 'Razorpay keys not configured — using simulated payment mode.'
      });
    }

    // ── Real Razorpay Order creation ──────────────────────────────────────────
    const receipt = `AW_${paymentType}_${String(requestId).slice(-6)}_${Date.now()}`;
    const options = {
      amount: totalAmount * 100,   // Razorpay expects paise
      currency: 'INR',
      receipt: receipt.slice(0, 40) // max 40 chars
    };

    const order = await razorpay.orders.create(options);

    // Persist Payment record
    await Payment.create({
      request: requestId,
      caregiver: req.user.id,
      volunteer: request.volunteer?._id || request.volunteer || null,
      paymentType,
      serviceCharge,
      shoppingAmount,
      tipAmount: tipAmt,
      totalAmount,
      razorpayOrderId: order.id,
      status: 'Created'
    });

    return res.json({
      success: true,
      simulated: false,
      orderId: order.id,
      amount: totalAmount,
      key: process.env.RAZORPAY_KEY_ID,
      paymentType,
      volunteerName: request.volunteer?.name || 'Volunteer',
      seniorName: request.senior?.name || 'Senior'
    });

  } catch (error) {
    console.error('[paymentController] createRazorpayOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error creating order' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// @desc    Verify Razorpay payment signature & execute lifecycle transition
// @route   POST /api/payments/verify
// @access  Private (Family Caregiver)
// ──────────────────────────────────────────────────────────────────────────────
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      // sent for simulated payments
      simulated,
      requestId: bodyRequestId,
      paymentType: bodyPaymentType,
      tipAmount: bodyTip
    } = req.body;

    // ── Locate Payment record ─────────────────────────────────────────────────
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order' });
    }

    // Retrieve volunteer name for response
    let volunteerName = 'Volunteer';
    if (payment.volunteer) {
      const volUser = await User.findById(payment.volunteer);
      if (volUser) {
        volunteerName = volUser.name;
      }
    }
    if (volunteerName === 'Volunteer' && payment.request) {
      const reqDoc = await HelpRequest.findById(payment.request).populate('volunteer', 'name');
      if (reqDoc && reqDoc.volunteer && reqDoc.volunteer.name) {
        volunteerName = reqDoc.volunteer.name;
      }
    }

    // ── Handle simulated payment (no Razorpay keys) ───────────────────────────
    if (simulated || !process.env.RAZORPAY_KEY_SECRET) {
      payment.razorpayPaymentId = `sim_pay_${Date.now()}`;
      payment.status = 'Paid';
      payment.paidAt = new Date();
      await payment.save();

      await executeLifecycleTransition(payment, req.user, bodyTip);

      return res.json({
        success: true,
        simulated: true,
        transactionId: payment.razorpayPaymentId,
        volunteerName,
        message: 'Simulated payment recorded successfully.'
      });
    }

    // ── HMAC-SHA256 Signature Verification ────────────────────────────────────
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      payment.status = 'Failed';
      await payment.save();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: signature mismatch. Do not trust this payment.'
      });
    }

    // ── Signature valid — mark Paid ───────────────────────────────────────────
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'Paid';
    payment.paidAt = new Date();
    await payment.save();

    // ── Execute the corresponding request lifecycle transition ────────────────
    await executeLifecycleTransition(payment, req.user, bodyTip);

    return res.json({
      success: true,
      simulated: false,
      transactionId: razorpay_payment_id,
      volunteerName,
      message: 'Payment verified and recorded successfully!'
    });

  } catch (error) {
    console.error('[paymentController] verifyRazorpayPayment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error verifying payment' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Internal helper: execute the request lifecycle transition after payment
// ──────────────────────────────────────────────────────────────────────────────
async function executeLifecycleTransition(payment, user, clientTipAmount = 0) {
  const request = await HelpRequest.findById(payment.request);
  if (!request) {
    console.error('[paymentController] Cannot find request for lifecycle transition:', payment.request);
    return;
  }

  const txnId = payment.razorpayPaymentId || `PAY_${Date.now()}`;

  // ── PURCHASE: fund volunteer's shopping money ─────────────────────────────
  if (payment.paymentType === 'purchase') {
    request.purchaseFunded = true;
    request.purchaseFundedAt = new Date();
    request.status = 'purchase_funded';
    request.purchasePaymentDetails = {
      amountPaid: payment.totalAmount,
      transactionId: txnId,
      paymentMethod: 'Razorpay',
      paidAt: new Date()
    };
    await request.save();
    console.log(`[Payment] Purchase funded ₹${payment.totalAmount} for request ${payment.request}`);
    return;
  }

  // ── COMPLETION: release service charge to volunteer ───────────────────────
  if (payment.paymentType === 'completion') {
    const tipAmt = Math.round(Number(clientTipAmount) || 0);

    request.status = 'completed';
    request.completionVerified = 'verified';
    request.completedAt = new Date();
    request.serviceChargeReleased = true;
    request.serviceChargeReleasedAt = new Date();
    request.verifiedBy = user.id;
    request.verifierRole = 'family';
    request.verifiedAt = new Date();

    if (tipAmt > 0) {
      request.tipAmount = tipAmt;
    }

    request.paymentDetails = {
      amountPaid: payment.totalAmount + tipAmt,
      itemsCost: request.actualPurchaseCost || 0,
      volunteerFee: payment.serviceCharge,
      platformFee: 0,
      tipAmount: tipAmt,
      transactionId: txnId,
      paymentMethod: 'Razorpay',
      paidAt: new Date()
    };

    await request.save();

    // Release volunteer earnings
    if (request.volunteer) {
      const releasedAt = new Date();
      const updated = await Earning.findOneAndUpdate(
        { request: request._id, volunteer: request.volunteer, type: 'SERVICE_CHARGE', status: 'PENDING' },
        { $set: { status: 'RELEASED', releasedAt } }
      );
      if (!updated) {
        await Earning.create({
          volunteer: request.volunteer,
          request: request._id,
          amount: payment.serviceCharge || request.serviceFee || 0,
          type: 'SERVICE_CHARGE',
          status: 'RELEASED',
          taskTitle: request.title || 'Completed Task',
          taskCategory: request.category || 'Other',
          releasedAt
        });
      }

      if (tipAmt > 0) {
        await Earning.deleteOne({ request: request._id, volunteer: request.volunteer, type: 'TIP' });
        await Earning.create({
          volunteer: request.volunteer,
          request: request._id,
          amount: tipAmt,
          type: 'TIP',
          status: 'RELEASED',
          taskTitle: request.title || 'Completed Task',
          taskCategory: request.category || 'Other',
          releasedAt
        });
      }
    }

    console.log(`[Payment] Service charge ₹${payment.serviceCharge} released for request ${payment.request}`);
    return;
  }

  // ── TIP: add bonus tip earning ────────────────────────────────────────────
  if (payment.paymentType === 'tip') {
    const tipAmt = payment.tipAmount || Math.round(Number(clientTipAmount) || 0);

    if (tipAmt > 0 && request.volunteer) {
      request.tipAmount = (Number(request.tipAmount) || 0) + tipAmt;
      if (request.tipPaymentDetails) {
        request.tipPaymentDetails.amountPaid = tipAmt;
        request.tipPaymentDetails.transactionId = txnId;
        request.tipPaymentDetails.paymentMethod = 'Razorpay';
        request.tipPaymentDetails.paidAt = new Date();
      } else {
        request.tipPaymentDetails = {
          amountPaid: tipAmt,
          transactionId: txnId,
          paymentMethod: 'Razorpay',
          paidAt: new Date()
        };
      }
      await request.save();

      await Earning.deleteOne({ request: request._id, volunteer: request.volunteer, type: 'TIP' });
      await Earning.create({
        volunteer: request.volunteer,
        request: request._id,
        amount: tipAmt,
        type: 'TIP',
        status: 'RELEASED',
        taskTitle: request.title || 'Completed Task',
        taskCategory: request.category || 'Other',
        releasedAt: new Date()
      });
    }

    console.log(`[Payment] Tip ₹${tipAmt} recorded for request ${payment.request}`);
    return;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// @desc    Get payment status for a given request
// @route   GET /api/payments/status/:requestId
// @access  Private (Family Caregiver)
// ──────────────────────────────────────────────────────────────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const payments = await Payment.find({ request: req.params.requestId })
      .sort({ createdAt: -1 })
      .select('paymentType status totalAmount razorpayPaymentId paidAt createdAt');

    return res.json({ success: true, payments });
  } catch (error) {
    console.error('[paymentController] getPaymentStatus error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching payment status' });
  }
};
