// AgeWell Payment & Proof Verification Authorization Script

let currentRequestId = '';
let itemsCost = 0;
let volunteerFee = 0;
let platformFee = 0;
let tipAmount = 0;
let totalAmount = 0;
let volunteerName = 'Assigned Volunteer';
let seniorName = 'Senior Citizen';
let requestTitle = 'Help Request';
let transactionId = 'TXN92837462';
let paymentType = 'completion';

document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  currentRequestId = params.get('requestId');
  paymentType = params.get('type') || 'completion';

  const qItems = params.get('itemsCost');
  const qFee = params.get('serviceFee');
  const qTip = params.get('tipAmount');

  if (qItems !== null && qItems !== undefined && !isNaN(Number(qItems))) {
    itemsCost = Number(qItems);
  }
  if (qFee !== null && qFee !== undefined && !isNaN(Number(qFee))) {
    volunteerFee = Number(qFee);
  }
  if (qTip !== null && qTip !== undefined && !isNaN(Number(qTip))) {
    tipAmount = Number(qTip);
  }
  if (paymentType === 'tip') {
    itemsCost = 0;
    volunteerFee = 0;
  }
  totalAmount = itemsCost + volunteerFee + platformFee + tipAmount;
  updateSummaryUI();

  // Load User & Check Auth
  const user = checkAuth();
  if (!user || user.role !== 'family') {
    window.location.href = 'index.html';
    return;
  }

  // Initialize interactive star rating listeners
  initStarRatings();

  // Load Request Details
  if (currentRequestId) {
    await loadRequestDetails(currentRequestId);
  } else {
    updateSummaryUI();
  }
});

// Fetch details for request and assigned volunteer
async function loadRequestDetails(reqId) {
  try {
    let request = null;
    let allRequests = [];

    // Try direct endpoint first
    const directRes = await apiCall(`/requests/${reqId}`, 'GET');
    if (directRes.ok && directRes.data.success && directRes.data.request) {
      request = directRes.data.request;
    }

    // Also fetch all requests for fallback volunteer lookup
    const res = await apiCall('/requests', 'GET');
    if (res.ok && res.data.success) {
      allRequests = res.data.requests || [];
      if (!request) {
        request = allRequests.find(r => String(r._id) === String(reqId));
      }
    }

    if (request) {
      requestTitle = request.title || 'Help Request';
      if (request.senior && request.senior.name) {
        seniorName = request.senior.name;
      }

      // 1. Extract Items Cost (Actual Purchase Cost submitted by volunteer)
      if (request.actualPurchaseCost !== undefined && request.actualPurchaseCost !== null && Number(request.actualPurchaseCost) > 0) {
        itemsCost = Number(request.actualPurchaseCost);
      } else if (request.purchasePaymentDetails && request.purchasePaymentDetails.amountPaid > 0) {
        itemsCost = Number(request.purchasePaymentDetails.amountPaid);
      }

      // 2. Extract Quoted Service Fee from request or volunteerQuotes array
      if (request.serviceFee !== undefined && request.serviceFee !== null && Number(request.serviceFee) > 0) {
        volunteerFee = Number(request.serviceFee);
      } else if (request.volunteerQuotes && request.volunteerQuotes.length > 0) {
        const targetVolId = request.volunteer ? String(request.volunteer._id || request.volunteer.id || request.volunteer) : null;
        let matchQuote = null;
        if (targetVolId) {
          matchQuote = request.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === targetVolId);
        }
        if (!matchQuote) {
          matchQuote = request.volunteerQuotes[0];
        }
        if (matchQuote && matchQuote.serviceFee !== undefined && matchQuote.serviceFee !== null && Number(matchQuote.serviceFee) > 0) {
          volunteerFee = Number(matchQuote.serviceFee);
        }
      }

      // 3. Fallback to URL query params if DB fields were 0 or unpopulated
      const urlParams = new URLSearchParams(window.location.search);
      const qItems = urlParams.get('itemsCost');
      const qFee = urlParams.get('serviceFee');
      if (itemsCost === 0 && qItems !== null && qItems !== undefined && !isNaN(Number(qItems)) && Number(qItems) > 0) {
        itemsCost = Number(qItems);
      }
      if (volunteerFee === 0 && qFee !== null && qFee !== undefined && !isNaN(Number(qFee)) && Number(qFee) > 0) {
        volunteerFee = Number(qFee);
      }

      // Check if this is a Purchase Cost approval payment
      if (paymentType === 'purchase' || request.status === 'purchase_cost_submitted') {
        paymentType = 'purchase';
      }

      // Show metadata banner
      const metaBanner = document.getElementById('requestMetaBanner');
      const metaTitle = document.getElementById('metaTitle');
      const metaSenior = document.getElementById('metaSenior');
      if (metaBanner && metaTitle && metaSenior) {
        metaBanner.style.display = 'block';
        metaTitle.textContent = `📋 ${requestTitle}`;
        metaSenior.textContent = `Senior Citizen: ${seniorName}`;
      }

      // Display Bill Photo Proof container if available
      const proofBox = document.getElementById('purchaseProofBox');
      const proofImg = document.getElementById('purchaseProofImg');
      const proofNotes = document.getElementById('purchaseProofNotes');
      if (proofBox && (request.purchaseProofDoc || request.completionProof)) {
        proofBox.style.display = 'block';
        if (proofImg) proofImg.src = request.purchaseProofDoc || request.completionProof;
        if (proofNotes) proofNotes.textContent = request.purchaseNotes ? `Volunteer Notes: "${request.purchaseNotes}"` : 'Cart screenshot / price proof attached.';
      }

      // --- Multi-stage Fail-Safe Volunteer Name Resolution ---
      let foundVolName = '';

      if (request.volunteer) {
        if (typeof request.volunteer === 'object' && request.volunteer.name) {
          foundVolName = request.volunteer.name;
        }
      }

      if (!foundVolName && request.volunteerQuotes && request.volunteerQuotes.length > 0) {
        const targetVolId = request.volunteer ? String(request.volunteer._id || request.volunteer.id || request.volunteer) : null;
        let matchQuote = null;
        if (targetVolId) {
          matchQuote = request.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === targetVolId);
        }
        if (!matchQuote) {
          matchQuote = request.volunteerQuotes.find(q => q.volunteer && typeof q.volunteer === 'object' && q.volunteer.name);
        }
        if (matchQuote && matchQuote.volunteer) {
          foundVolName = typeof matchQuote.volunteer === 'object' ? matchQuote.volunteer.name : foundVolName;
          if (matchQuote.serviceFee !== undefined && matchQuote.serviceFee !== null && Number(matchQuote.serviceFee) >= 0) {
            volunteerFee = Number(matchQuote.serviceFee);
          }
        }
      }

      if (!foundVolName && request.volunteer) {
        const targetVolId = String(request.volunteer._id || request.volunteer.id || request.volunteer);
        for (const r of allRequests) {
          if (r.volunteer && typeof r.volunteer === 'object' && r.volunteer.name && String(r.volunteer._id || r.volunteer.id) === targetVolId) {
            foundVolName = r.volunteer.name;
            break;
          }
          if (r.volunteerQuotes) {
            const qMatch = r.volunteerQuotes.find(q => q.volunteer && typeof q.volunteer === 'object' && q.volunteer.name && String(q.volunteer._id || q.volunteer.id) === targetVolId);
            if (qMatch) {
              foundVolName = qMatch.volunteer.name;
              break;
            }
          }
        }
      }

      if (foundVolName) {
        volunteerName = foundVolName;
      }
    }
  } catch (err) {
    console.error('Error loading request details for payment:', err);
  }
  // Final URL & dynamic check before UI render
  const urlParams = new URLSearchParams(window.location.search);
  const qItems = urlParams.get('itemsCost');
  const qFee = urlParams.get('serviceFee');

  if (paymentType === 'tip') {
    itemsCost = 0;
    volunteerFee = 0;
  } else {
    if ((itemsCost === 0 || isNaN(itemsCost)) && qItems !== null && qItems !== undefined && !isNaN(Number(qItems))) {
      itemsCost = Number(qItems);
    }
    if ((volunteerFee === 0 || isNaN(volunteerFee)) && qFee !== null && qFee !== undefined && !isNaN(Number(qFee))) {
      volunteerFee = Number(qFee);
    }
  }

  totalAmount = itemsCost + volunteerFee + platformFee + tipAmount;
  updateSummaryUI();
}

function updateSummaryUI() {
  const elItemsCost    = document.getElementById('summaryItemsCost');
  const elVolunteerFee = document.getElementById('summaryVolunteerFee');
  const elPlatformFee  = document.getElementById('summaryPlatformFee');
  const elTipRow       = document.getElementById('summaryTipRow');
  const elTipAmount    = document.getElementById('summaryTipAmount');
  const elTotal        = document.getElementById('summaryTotal');
  const btnPay         = document.getElementById('btnPay');
  const successPaidTo  = document.getElementById('successPaidTo');
  const receiptVol     = document.getElementById('receiptVolunteer');

  if (elItemsCost)    elItemsCost.textContent    = `₹${itemsCost}`;
  if (elVolunteerFee) elVolunteerFee.textContent = `₹${volunteerFee}`;
  if (elPlatformFee)  elPlatformFee.textContent  = `₹${platformFee}`;

  if (tipAmount > 0) {
    if (elTipRow) elTipRow.style.display = 'flex';
    if (elTipAmount) elTipAmount.textContent = `₹${tipAmount}`;
  } else {
    if (elTipRow) elTipRow.style.display = 'none';
  }

  totalAmount = itemsCost + volunteerFee + platformFee + tipAmount;

  if (elTotal)   elTotal.textContent   = `₹${totalAmount}`;
  if (btnPay)    btnPay.textContent    = `🔐 Pay ₹${totalAmount} via Razorpay`;
  if (successPaidTo && volunteerName) successPaidTo.textContent = volunteerName;
  if (receiptVol    && volunteerName) receiptVol.textContent    = volunteerName;
}

// ─── Razorpay Payment Flow ───────────────────────────────────────────────────
//
// Step 1: POST /api/payments/create-order  → get orderId + key from server
// Step 2: Open Razorpay checkout with orderId
// Step 3: On success, POST /api/payments/verify with payment IDs + signature
// Step 4: Show success card on verified response
//
// Graceful fallback: if server returns simulated:true (no Razorpay keys)
// the checkout is skipped and payment is logged directly.
// ─────────────────────────────────────────────────────────────────────────────

// Generate fallback Transaction ID for receipt display (e.g. TXN92837462)
function generateTxnId() {
  const randDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `TXN${randDigits}`;
}

async function processPayment() {
  const btnPay = document.getElementById('btnPay');
  if (btnPay) {
    btnPay.disabled = true;
    btnPay.textContent = 'Initialising Payment...';
  }

  // ── Step 1: Create Razorpay Order (server-side) ────────────────────────────
  let orderData;
  try {
    const orderRes = await apiCall('/payments/create-order', 'POST', {
      requestId: currentRequestId,
      paymentType,
      tipAmount
    });

    if (!orderRes.ok || !orderRes.data.success) {
      const msg = orderRes.data?.message || 'Could not create payment order. Please try again.';
      alert(msg);
      if (btnPay) {
        btnPay.disabled = false;
        btnPay.textContent = `🔐 Pay ₹${totalAmount} via Razorpay`;
      }
      return;
    }
    orderData = orderRes.data;
  } catch (err) {
    console.error('create-order error:', err);
    alert('Network error creating order. Please check your connection.');
    if (btnPay) { btnPay.disabled = false; btnPay.textContent = `🔐 Pay ₹${totalAmount} via Razorpay`; }
    return;
  }

  // ── Simulated fallback (Razorpay keys not set) ─────────────────────────────
  if (orderData.simulated) {
    // Hide test-mode badge in simulated mode since we're not even using Razorpay
    const badge = document.getElementById('rzpTestModeBadge');
    if (badge) badge.textContent = '🧪 Simulated Mode — No gateway (keys not configured)';

    // Post to verify endpoint with simulated flag
    const verifyRes = await apiCall('/payments/verify', 'POST', {
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: `sim_pay_${Date.now()}`,
      razorpay_signature: '',
      simulated: true,
      requestId: currentRequestId,
      paymentType,
      tipAmount
    });

    transactionId = verifyRes.data?.transactionId || generateTxnId();
    if (verifyRes.data?.success && orderData.volunteerName) volunteerName = orderData.volunteerName;
    showSuccessCard();
    return;
  }

  // ── Step 2: Open Razorpay Standard Checkout ────────────────────────────────
  if (typeof Razorpay === 'undefined') {
    console.warn('Razorpay SDK not loaded. Falling back to simulated payment.');
    transactionId = generateTxnId();
    showSuccessCard();
    return;
  }

  const rzpOptions = {
    key: orderData.key,
    amount: orderData.amount * 100,   // paise
    currency: 'INR',
    name: 'AgeWell',
    description: paymentType === 'purchase'
      ? 'Shopping Fund Release'
      : paymentType === 'tip'
      ? 'Volunteer Tip'
      : 'Service Charge Release',
    order_id: orderData.orderId,
    image: '',   // optional logo
    theme: { color: '#2e7d32' },
    prefill: {
      name: '',
      email: '',
      contact: ''
    },
    notes: {
      requestId: currentRequestId,
      paymentType
    },
    // ── Step 3: Payment Success Handler ─────────────────────────────────────
    handler: async function (response) {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = response;

      try {
        const verifyRes = await apiCall('/payments/verify', 'POST', {
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature,
          requestId: currentRequestId,
          paymentType,
          tipAmount
        });

        if (verifyRes.data?.success) {
          transactionId = razorpay_payment_id;
          if (orderData.volunteerName) volunteerName = orderData.volunteerName;
          showSuccessCard();
        } else {
          alert('Payment verification failed: ' + (verifyRes.data?.message || 'Unknown error'));
          if (btnPay) { btnPay.disabled = false; btnPay.textContent = `🔐 Pay ₹${totalAmount} via Razorpay`; }
        }
      } catch (verifyErr) {
        console.error('Verify error:', verifyErr);
        alert('Payment recorded but verification call failed. Please contact support.');
      }
    },
    // ── Payment Cancelled / Dismissed ────────────────────────────────────────
    modal: {
      ondismiss: function () {
        console.log('Razorpay checkout dismissed by user.');
        if (btnPay) {
          btnPay.disabled = false;
          btnPay.textContent = `🔐 Pay ₹${totalAmount} via Razorpay`;
        }
      }
    }
  };

  const rzp = new Razorpay(rzpOptions);
  rzp.on('payment.failed', function (response) {
    console.error('Razorpay payment failed:', response.error);
    alert(`Payment failed: ${response.error.description || 'Please try again.'}`);
    if (btnPay) {
      btnPay.disabled = false;
      btnPay.textContent = `🔐 Pay ₹${totalAmount} via Razorpay`;
    }
  });

  rzp.open();
}

// Show the payment success card (shared by real and simulated paths)
function showSuccessCard() {
  const formCard = document.getElementById('paymentFormCard');
  const successCard = document.getElementById('paymentSuccessCard');
  const successAmount = document.getElementById('successAmount');
  const successTxnId = document.getElementById('successTxnId');
  const successPaidTo = document.getElementById('successPaidTo');

  if (formCard) formCard.style.display = 'none';
  if (successCard) successCard.style.display = 'block';

  if (successAmount) successAmount.textContent = `₹${totalAmount}`;
  if (successTxnId)  successTxnId.textContent  = transactionId;
  if (successPaidTo) successPaidTo.textContent = volunteerName;

  // Only show feedback modal after final payment (not purchase funding)
  if (paymentType !== 'purchase') {
    setTimeout(() => { openFeedbackModal(); }, 600);
  }
}

function openReceiptModal() {
  const modal = document.getElementById('receiptModal');
  const rTxn = document.getElementById('receiptTxnId');
  const rDate = document.getElementById('receiptDate');
  const rSenior = document.getElementById('receiptSenior');
  const rVol = document.getElementById('receiptVolunteer');
  const rItems = document.getElementById('receiptItemsCost');
  const rFee = document.getElementById('receiptVolunteerFee');
  const rTotal = document.getElementById('receiptTotal');

  if (rTxn) rTxn.textContent = transactionId;
  if (rDate) rDate.textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (rSenior) rSenior.textContent = seniorName;
  if (rVol) rVol.textContent = volunteerName;
  if (rItems) rItems.textContent = `₹${itemsCost}`;
  if (rFee) rFee.textContent = `₹${volunteerFee}`;
  if (rTotal) rTotal.textContent = `₹${totalAmount}`;

  if (modal) modal.style.display = 'flex';
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.style.display = 'none';
}

// --- Volunteer Feedback Modal Handlers ---

function setStarRating(metric, count) {
  const hiddenInput = document.getElementById(`${metric}Val`);
  if (hiddenInput) {
    hiddenInput.value = count;
  }
  const ratingEl = document.querySelector(`.star-rating[data-metric="${metric}"]`);
  if (ratingEl) {
    const stars = ratingEl.querySelectorAll('.star');
    updateStars(stars, count);
  }
  const scoreBadge = document.getElementById(`${metric}Text`);
  if (scoreBadge) {
    scoreBadge.textContent = `${count} / 5 ⭐`;
    scoreBadge.classList.remove('unrated');
  }
}

function hoverStarRating(metric, count) {
  const ratingEl = document.querySelector(`.star-rating[data-metric="${metric}"]`);
  if (ratingEl) {
    const stars = ratingEl.querySelectorAll('.star');
    updateStars(stars, count);
  }
  const scoreBadge = document.getElementById(`${metric}Text`);
  if (scoreBadge) {
    scoreBadge.textContent = `${count} / 5 ⭐`;
    scoreBadge.classList.remove('unrated');
  }
}

function resetStarRating(metric) {
  const hiddenInput = document.getElementById(`${metric}Val`);
  const currentVal = hiddenInput ? parseInt(hiddenInput.value, 10) : 0;
  const ratingEl = document.querySelector(`.star-rating[data-metric="${metric}"]`);
  if (ratingEl) {
    const stars = ratingEl.querySelectorAll('.star');
    updateStars(stars, currentVal);
  }
  const scoreBadge = document.getElementById(`${metric}Text`);
  if (scoreBadge) {
    if (currentVal > 0) {
      scoreBadge.textContent = `${currentVal} / 5 ⭐`;
      scoreBadge.classList.remove('unrated');
    } else {
      scoreBadge.textContent = 'Select Rating';
      scoreBadge.classList.add('unrated');
    }
  }
}

function initStarRatings() {
  ['costUtilization', 'speedTimeliness', 'communication'].forEach(metric => {
    resetStarRating(metric);
  });
}

function updateStars(stars, activeVal) {
  stars.forEach(s => {
    const val = parseInt(s.getAttribute('data-val'), 10);
    if (activeVal > 0 && val <= activeVal) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });
}

function selectPill(labelEl, groupName, value) {
  const container = labelEl.parentElement;
  if (!container) return;
  container.querySelectorAll('.pill-option').forEach(p => p.classList.remove('active'));
  labelEl.classList.add('active');
  const radio = labelEl.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
}

function openFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  const nameEl = document.getElementById('feedbackVolunteerName');
  if (nameEl && volunteerName) {
    nameEl.textContent = volunteerName;
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

function goHome() {
  window.location.href = 'family-dashboard.html';
}

function skipFeedbackAndGoHome() {
  window.location.href = 'family-dashboard.html';
}

async function handleFeedbackSubmit(event) {
  event.preventDefault();
  const btnSubmit = document.getElementById('btnSubmitFeedback');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting Feedback...';
  }

  const rawCost = parseInt(document.getElementById('costUtilizationVal')?.value, 10);
  const rawSpeed = parseInt(document.getElementById('speedTimelinessVal')?.value, 10);
  const rawComm = parseInt(document.getElementById('communicationVal')?.value, 10);

  const costUtilization = rawCost > 0 ? rawCost : 5;
  const speedTimeliness = rawSpeed > 0 ? rawSpeed : 5;
  const communication = rawComm > 0 ? rawComm : 5;

  const taskCompletionRadio = document.querySelector('input[name="taskCompletion"]:checked');
  const taskCompletion = taskCompletionRadio ? taskCompletionRadio.value : 'Completely';
  const chooseAgainRadio = document.querySelector('input[name="chooseAgain"]:checked');
  const chooseAgain = chooseAgainRadio ? chooseAgainRadio.value : 'Yes';
  const additionalFeedback = document.getElementById('additionalFeedback')?.value || '';

  let reqIdToUse = currentRequestId;
  if (!reqIdToUse) {
    try {
      const res = await apiCall('/requests', 'GET');
      if (res.ok && res.data && res.data.requests) {
        const completed = res.data.requests.filter(r => r.status === 'completed');
        if (completed.length > 0) {
          completed.sort((a, b) => new Date(b.completedAt || b.updatedAt || 0) - new Date(a.completedAt || a.updatedAt || 0));
          reqIdToUse = completed[0]._id;
        }
      }
    } catch (e) {
      console.warn('Error finding fallback request for feedback:', e);
    }
  }

  if (reqIdToUse) {
    try {
      await apiCall(`/requests/${reqIdToUse}/feedback`, 'PUT', {
        costUtilization: Number(costUtilization),
        speedTimeliness: Number(speedTimeliness),
        taskCompletion,
        communication: Number(communication),
        chooseAgain,
        additionalFeedback
      });
    } catch (err) {
      console.error('Error submitting volunteer feedback:', err);
    }
  }

  // Redirect home to family dashboard
  window.location.href = 'family-dashboard.html';
}
