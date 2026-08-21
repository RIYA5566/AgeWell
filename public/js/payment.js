// AgeWell Payment & Proof Verification Authorization Script

let currentRequestId = '';
let currentVolunteerId = '';
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
  currentVolunteerId = params.get('volunteerId') || '';
  paymentType = params.get('type') || 'completion';

  const qItems = params.get('itemsCost');
  const qFee = params.get('serviceFee');
  const qTip = params.get('tipAmount');
  const qVolName = params.get('volunteerName');

  if (qVolName) {
    volunteerName = qVolName;
  }

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
  if (paymentType === 'service_fee_upfront') {
    // Upfront service fee: only the volunteer's quoted service charge, no items cost
    itemsCost = 0;
    tipAmount = 0;
  }
  totalAmount = itemsCost + volunteerFee + platformFee + tipAmount;
  updateSummaryUI();

  // Load User & Check Auth
  const auth = checkAuthAndRedirect('family');
  if (!auth) {
    return;
  }
  const user = auth.user;

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
        const targetVolId = currentVolunteerId || (request.volunteer ? String(request.volunteer._id || request.volunteer.id || request.volunteer) : null);
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
      // Upfront service fee: zero out items cost
      if (paymentType === 'service_fee_upfront') {
        itemsCost = 0;
        tipAmount = 0;

        const pageTitle = document.querySelector('h1');
        const pageSubtitle = document.querySelector('h1 + p');
        const feeLabel = document.querySelector('#summaryVolunteerFee')?.previousElementSibling;

        if (pageTitle) pageTitle.textContent = 'Pay Volunteer Service Fee (Escrow)';
        if (pageSubtitle) pageSubtitle.textContent = 'Pay the volunteer service fee into secure escrow. For store purchases, the volunteer will share the store QR/payment link when shopping, and you will pay the merchant directly.';
        if (feeLabel) feeLabel.textContent = 'Volunteer Service Fee (Escrow)';
      }
      // Pre-Fund payment: combines estimated items budget + service fee in escrow
      if (paymentType === 'pre_fund') {
        if (itemsCost === 0 && request.allowedBudget > 0) {
          itemsCost = Number(request.allowedBudget);
        }
        tipAmount = 0;

        const pageTitle = document.querySelector('h1');
        const pageSubtitle = document.querySelector('h1 + p');
        const itemsCostLabel = document.querySelector('#summaryItemsCost')?.previousElementSibling;
        const feeLabel = document.querySelector('#summaryVolunteerFee')?.previousElementSibling;

        if (pageTitle) pageTitle.textContent = 'Pre-Fund Task & Escrow Deposit';
        if (pageSubtitle) pageSubtitle.textContent = 'Deposit estimated purchase budget & service fee into secure escrow. Volunteer will purchase directly within this budget and submit the bill for your final verification & release.';
        if (itemsCostLabel) itemsCostLabel.textContent = 'Estimated Purchase Budget (Escrow)';
        if (feeLabel) feeLabel.textContent = 'Volunteer Service Charge (Escrow)';
      }

      // Show metadata banner
      const metaBanner = document.getElementById('requestMetaBanner');
      const metaTitle = document.getElementById('metaTitle');
      const metaSenior = document.getElementById('metaSenior');
      if (metaBanner && metaTitle && metaSenior) {
        metaBanner.style.display = 'block';
        metaTitle.textContent = requestTitle;
        metaSenior.textContent = `Senior Citizen: ${seniorName}`;
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
  if (btnPay) {
    btnPay.innerHTML = `
      <svg class="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <span>Pay ₹${totalAmount} via Razorpay</span>`;
  }
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
      tipAmount,
      volunteerId: currentVolunteerId,
      fallbackAmount: totalAmount
    });

    if (!orderRes.ok || !orderRes.data.success) {
      const msg = orderRes.data?.message || 'Could not create payment order. Please try again.';
      alert(msg);
      if (btnPay) {
        btnPay.disabled = false;
        btnPay.innerHTML = `
          <svg class="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span>Pay ₹${totalAmount} via Razorpay</span>`;
      }
      return;
    }
    orderData = orderRes.data;
  } catch (err) {
    console.error('create-order error:', err);
    alert('Network error creating order. Please check your connection.');
    if (btnPay) { 
      btnPay.disabled = false; 
      btnPay.innerHTML = `
        <svg class="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span>Pay ₹${totalAmount} via Razorpay</span>`;
    }
    return;
  }

  // ── Simulated fallback (Razorpay keys not set) ─────────────────────────────
  if (orderData.simulated) {
    // Hide test-mode badge in simulated mode since we're not even using Razorpay
    const badge = document.getElementById('rzpTestModeBadge');
    if (badge) badge.textContent = 'Simulated Mode — Test Gateway';

    openRzpMockModal(orderData);
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
      : paymentType === 'service_fee_upfront'
      ? 'Service Fee (Upfront Escrow)'
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
      paymentType,
      volunteerId: currentVolunteerId
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
          volunteerId: currentVolunteerId,
          tipAmount
        });

        if (verifyRes.data?.success) {
          transactionId = razorpay_payment_id;
          if (verifyRes.data?.volunteerName && verifyRes.data.volunteerName !== 'Volunteer' && verifyRes.data.volunteerName !== 'Assigned Volunteer') {
            volunteerName = verifyRes.data.volunteerName;
          } else if (orderData.volunteerName && orderData.volunteerName !== 'Volunteer' && orderData.volunteerName !== 'Assigned Volunteer') {
            volunteerName = orderData.volunteerName;
          }

          // For service_fee_upfront: record the pre-payment on the request
          if (paymentType === 'service_fee_upfront') {
            try {
              await apiCall(`/requests/${currentRequestId}/prepay-service-fee`, 'PUT', {
                amountPaid: volunteerFee,
                volunteerId: currentVolunteerId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                paymentMethod: 'Razorpay'
              });
            } catch (prepayErr) {
              console.warn('prepay-service-fee call failed (non-fatal):', prepayErr);
            }
          }

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

  // Only show feedback modal after final completion payment (not purchase funding or upfront fee)
  if (paymentType !== 'purchase' && paymentType !== 'service_fee_upfront') {
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
  const rTipRow = document.getElementById('receiptTipRow');
  const rTip = document.getElementById('receiptTipAmount');
  const rTotal = document.getElementById('receiptTotal');

  if (rTxn) rTxn.textContent = transactionId;
  if (rDate) rDate.textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (rSenior) rSenior.textContent = seniorName;
  if (rVol) rVol.textContent = volunteerName;
  if (rItems) rItems.textContent = `₹${itemsCost}`;
  if (rFee) rFee.textContent = `₹${volunteerFee}`;
  if (tipAmount > 0) {
    if (rTipRow) rTipRow.style.display = 'flex';
    if (rTip) rTip.textContent = `₹${tipAmount}`;
  } else {
    if (rTipRow) rTipRow.style.display = 'none';
  }
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

function selectPill(btnOrLabel, groupName, value) {
  const container = document.getElementById(groupName === 'taskCompletion' ? 'taskCompletionGroup' : 'chooseAgainGroup') || btnOrLabel.parentElement;
  if (!container) return;

  container.querySelectorAll('button, label, .pill-option').forEach(p => {
    p.classList.remove('active', 'border-emerald-600', 'bg-emerald-600', 'text-white');
    p.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
    p.style.backgroundColor = '';
    p.style.color = '';
    p.style.borderColor = '';
    const r = p.querySelector('input[type="radio"]');
    if (r) r.checked = false;
  });

  btnOrLabel.classList.add('active', 'border-emerald-600', 'bg-emerald-600', 'text-white');
  btnOrLabel.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');
  btnOrLabel.style.backgroundColor = '#059669';
  btnOrLabel.style.color = '#ffffff';
  btnOrLabel.style.borderColor = '#059669';

  const radio = btnOrLabel.querySelector('input[type="radio"]');
  if (radio) {
    radio.checked = true;
  }
  const hiddenInput = document.getElementById(`${groupName}Val`);
  if (hiddenInput) {
    hiddenInput.value = value;
  }
}

function openFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  const headingEl = document.getElementById('feedbackModalHeading');
  const nameEl = document.getElementById('feedbackVolunteerName');
  const cleanName = (volunteerName && typeof volunteerName === 'string' && volunteerName.trim() && volunteerName !== '{name}') 
    ? volunteerName.trim() 
    : 'Assigned Volunteer';

  if (headingEl) {
    headingEl.innerHTML = `Feedback for <span id="feedbackVolunteerName" class="text-brand-600">${escapeHTML(cleanName)}</span>`;
  } else if (nameEl) {
    nameEl.textContent = cleanName;
  }
  if (typeof initStarRatings === 'function') {
    initStarRatings();
  }

  // Ensure all pills start unselected
  document.querySelectorAll('#taskCompletionGroup .pill-option, #chooseAgainGroup .pill-option').forEach(p => {
    p.classList.remove('active', 'border-emerald-600', 'bg-emerald-600', 'text-white');
    p.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
    p.style.backgroundColor = '';
    p.style.color = '';
    p.style.borderColor = '';
  });
  const tcVal = document.getElementById('taskCompletionVal');
  if (tcVal) tcVal.value = '';
  const caVal = document.getElementById('chooseAgainVal');
  if (caVal) caVal.value = '';

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

// ─── Razorpay Mock Modal Flow ────────────────────────────────────────────────
let mockOrderDataGlobal = null;

function openRzpMockModal(orderData) {
  mockOrderDataGlobal = orderData;
  const modal = document.getElementById('rzpMockModal');
  if (!modal) return;

  // Set amounts safely
  const elHeaderAmt = document.getElementById('rzpMockHeaderAmount');
  const elUpiAmt = document.getElementById('rzpMockBtnAmountUpi');
  const elCardAmt = document.getElementById('rzpMockBtnAmountCard');
  const elNetAmt = document.getElementById('rzpMockBtnAmountNet');
  const elWalletAmt = document.getElementById('rzpMockBtnAmountWallet');

  if (elHeaderAmt) elHeaderAmt.textContent = `₹${totalAmount}`;
  if (elUpiAmt) elUpiAmt.textContent = `₹${totalAmount}`;
  if (elCardAmt) elCardAmt.textContent = `₹${totalAmount}`;
  if (elNetAmt) elNetAmt.textContent = `₹${totalAmount}`;
  if (elWalletAmt) elWalletAmt.textContent = `₹${totalAmount}`;

  // Hide loader if open
  const loader = document.getElementById('rzpMockLoader');
  if (loader) loader.style.display = 'none';

  // Reset inputs safely
  const upiInp = document.getElementById('rzpUpiId');
  if (upiInp) upiInp.value = 'agewell@pay';
  const cardNoInp = document.getElementById('rzpCardNumber');
  if (cardNoInp) cardNoInp.value = '4111 1111 1111 1111';
  const expInp = document.getElementById('rzpCardExpiry');
  if (expInp) expInp.value = '12/29';
  const cvvInp = document.getElementById('rzpCardCvv');
  if (cvvInp) cvvInp.value = '123';

  // Switch to default tab (upi)
  switchRzpMockTab('upi');

  // Display modal
  modal.style.display = 'flex';
}

function closeRzpMockModal() {
  const modal = document.getElementById('rzpMockModal');
  if (modal) modal.style.display = 'none';

  // Re-enable payment button on the page
  const btnPay = document.getElementById('btnPay');
  if (btnPay) {
    btnPay.disabled = false;
    btnPay.innerHTML = `
      <svg class="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <span>Pay ₹${totalAmount} via Razorpay</span>`;
  }
}

function switchRzpMockTab(tabName) {
  const panels = ['upi', 'card', 'net', 'wallet'];
  panels.forEach(p => {
    const panelEl = document.getElementById(`rzpPanel${p.charAt(0).toUpperCase() + p.slice(1)}`);
    const tabEl = document.getElementById(`rzpTabLink${p.charAt(0).toUpperCase() + p.slice(1)}`);
    
    if (p === tabName) {
      if (panelEl) panelEl.style.display = 'flex';
      if (tabEl) {
        tabEl.classList.add('bg-white', 'text-brand-700', 'border-brand-600');
        tabEl.classList.remove('hover:bg-slate-100', 'border-transparent');
      }
    } else {
      if (panelEl) panelEl.style.display = 'none';
      if (tabEl) {
        tabEl.classList.remove('bg-white', 'text-brand-700', 'border-brand-600');
        tabEl.classList.add('hover:bg-slate-100', 'border-transparent');
      }
    }
  });
}

let isUpiQrVisible = false;
function toggleUpiQrView() {
  isUpiQrVisible = !isUpiQrVisible;
  const qrContainer = document.getElementById('upiQrContainer');
  const appsContainer = document.getElementById('upiAppsContainer');
  const toggleText = document.getElementById('upiToggleText');

  if (qrContainer && appsContainer) {
    if (isUpiQrVisible) {
      qrContainer.style.display = 'block';
      appsContainer.style.display = 'none';
      if (toggleText) toggleText.textContent = 'Enter UPI ID Instead';
    } else {
      qrContainer.style.display = 'none';
      appsContainer.style.display = 'block';
      if (toggleText) toggleText.textContent = 'Scan QR Instead';
    }
  }
}

function selectRzpMockUpiApp(element, app) {
  document.querySelectorAll('#rzpUpiAppGrid .rzp-upi-btn').forEach(btn => {
    btn.classList.remove('border-brand-600', 'bg-brand-50', 'text-brand-900');
    btn.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
  });

  element.classList.add('border-brand-600', 'bg-brand-50', 'text-brand-900');
  element.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');

  const upiInput = document.getElementById('rzpUpiId');
  if (!upiInput) return;
  
  if (app === 'gpay') upiInput.value = 'agewell@okaxis';
  else if (app === 'phonepe') upiInput.value = 'agewell@ybl';
  else if (app === 'paytm') upiInput.value = 'agewell@paytm';
  else if (app === 'ybl') upiInput.value = 'agewell@upi';
}

function prefillRzpMockUpi(app) {
  const btn = document.querySelector(`.rzp-upi-btn[onclick*="${app}"]`);
  if (btn) {
    selectRzpMockUpiApp(btn, app);
  } else {
    const upiInput = document.getElementById('rzpUpiId');
    if (upiInput) {
      if (app === 'gpay') upiInput.value = 'agewell@okaxis';
      else if (app === 'phonepe') upiInput.value = 'agewell@ybl';
      else if (app === 'paytm') upiInput.value = 'agewell@paytm';
      else if (app === 'ybl') upiInput.value = 'agewell@upi';
    }
  }
}

function formatCardNumber(input) {
  let value = input.value.replace(/\D/g, '');
  let formatted = '';
  for (let i = 0; i < value.length; i++) {
    if (i > 0 && i % 4 === 0) {
      formatted += ' ';
    }
    formatted += value[i];
  }
  input.value = formatted;
}

function formatCardExpiry(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 2) {
    input.value = value.substring(0, 2) + '/' + value.substring(2, 4);
  } else {
    input.value = value;
  }
}

let selectedBank = 'SBI';
function selectRzpMockBank(element, bankName) {
  document.querySelectorAll('#rzpNetbankingGrid .rzp-bank-btn').forEach(btn => {
    btn.classList.remove('border-brand-600', 'bg-brand-50', 'text-brand-900');
    btn.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
  });

  element.classList.add('border-brand-600', 'bg-brand-50', 'text-brand-900');
  element.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');

  const selectElem = document.getElementById('rzpNetbankingSelect');
  if (selectElem) selectElem.value = '';
  selectedBank = bankName;
}

function selectRzpMockBankDropdown(selectElem) {
  if (selectElem && selectElem.value) {
    document.querySelectorAll('#rzpNetbankingGrid .rzp-bank-btn').forEach(btn => {
      btn.classList.remove('border-brand-600', 'bg-brand-50', 'text-brand-900');
      btn.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
    });
    selectedBank = selectElem.value;
  }
}

let selectedWallet = 'Paytm';
function selectRzpMockWallet(element, walletName) {
  document.querySelectorAll('#rzpWalletGrid .rzp-wallet-btn').forEach(btn => {
    btn.classList.remove('border-brand-600', 'bg-brand-50', 'text-brand-900');
    btn.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
  });

  element.classList.add('border-brand-600', 'bg-brand-50', 'text-brand-900');
  element.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');
  selectedWallet = walletName;
}

async function submitRzpMockPayment(method) {
  // Method specific validation
  if (method === 'upi' && !isUpiQrVisible) {
    const upiId = document.getElementById('rzpUpiId')?.value?.trim();
    if (!upiId || !upiId.includes('@')) {
      alert('Please enter a valid UPI ID (e.g. username@bank)');
      return;
    }
  } else if (method === 'card') {
    const cardNo = document.getElementById('rzpCardNumber')?.value?.replace(/\s/g, '') || '';
    const cardExp = document.getElementById('rzpCardExpiry')?.value?.trim() || '';
    const cardCvv = document.getElementById('rzpCardCvv')?.value?.trim() || '';

    if (cardNo.length < 16) {
      alert('Please enter a valid 16-digit card number');
      return;
    }
    if (!cardExp.includes('/') || cardExp.length < 5) {
      alert('Please enter a valid expiry date (MM/YY)');
      return;
    }
    if (cardCvv.length < 3) {
      alert('Please enter a valid 3-digit CVV');
      return;
    }
  } else if (method === 'wallet') {
    const walletMobile = document.getElementById('rzpWalletMobile')?.value?.trim();
    if (!walletMobile || walletMobile.length < 10) {
      alert('Please enter a valid 10-digit mobile number linked to ' + selectedWallet);
      return;
    }
  }

  // Show loader overlay in the modal
  const loader = document.getElementById('rzpMockLoader');
  const loaderStatus = document.getElementById('rzpLoaderStatus');
  if (loader) {
    loader.style.display = 'flex';
  }
  
  if (loaderStatus) {
    loaderStatus.textContent = method === 'upi' 
      ? 'Connecting to UPI gateway...' 
      : method === 'card' 
      ? 'Authorizing card credentials...' 
      : method === 'net' 
      ? `Connecting to ${selectedBank} NetBanking...` 
      : `Connecting to ${selectedWallet}...`;
  }

  // Wait 1 sec, then change status, then wait 0.8 sec and call verify
  setTimeout(() => {
    if (loaderStatus) {
      loaderStatus.textContent = typeof t === 'function' ? t('rzp_mock_loader_verifying') : 'Verifying payment with AgeWell server...';
    }
    
    setTimeout(async () => {
      try {
        const verifyRes = await apiCall('/payments/verify', 'POST', {
          razorpay_order_id: mockOrderDataGlobal.orderId,
          razorpay_payment_id: `sim_pay_${Date.now()}`,
          razorpay_signature: '',
          simulated: true,
          requestId: currentRequestId,
          paymentType,
          volunteerId: currentVolunteerId,
          tipAmount
        });

        if (verifyRes.data?.success) {
          transactionId = verifyRes.data?.transactionId || generateTxnId();
          if (verifyRes.data?.volunteerName && verifyRes.data.volunteerName !== 'Volunteer' && verifyRes.data.volunteerName !== 'Assigned Volunteer') {
            volunteerName = verifyRes.data.volunteerName;
          } else if (mockOrderDataGlobal.volunteerName && mockOrderDataGlobal.volunteerName !== 'Volunteer' && mockOrderDataGlobal.volunteerName !== 'Assigned Volunteer') {
            volunteerName = mockOrderDataGlobal.volunteerName;
          }

          // Close modal and show success card
          const modal = document.getElementById('rzpMockModal');
          if (modal) modal.style.display = 'none';

          // For upfront service fee: record the pre-payment on the request
          if (paymentType === 'service_fee_upfront') {
            try {
              await apiCall(`/requests/${currentRequestId}/prepay-service-fee`, 'PUT', {
                amountPaid: volunteerFee,
                volunteerId: currentVolunteerId,
                transactionId: transactionId,
                paymentMethod: 'Simulated'
              });
            } catch (prepayErr) {
              console.warn('prepay-service-fee (simulated) call failed:', prepayErr);
            }
          }

          showSuccessCard();
        } else {
          alert('Payment verification failed: ' + (verifyRes.data?.message || 'Unknown error'));
          if (loader) loader.style.display = 'none';
        }
      } catch (err) {
        console.error('Verify error:', err);
        alert('Payment recorded but verification call failed. Please contact support.');
        if (loader) loader.style.display = 'none';
      }
    }, 800);
  }, 1000);
}

// ──────────────────────────────────────────────────────────
// CANCEL & RETURN TO DASHBOARD WITHOUT PROCESSING PAYMENT
// ──────────────────────────────────────────────────────────
window.handleCancelAndReturnToDashboard = function(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  // Immediately redirect back to the caregiver approvals section without triggering any payment
  window.location.href = '/family-dashboard.html?tab=approvals';
};

