// AgeWell Payment & Proof Verification Authorization Script

let currentRequestId = '';
let itemsCost = 338;
let volunteerFee = 50;
let platformFee = 0;
let totalAmount = 388;
let volunteerName = 'Assigned Volunteer';
let seniorName = 'Senior Citizen';
let requestTitle = 'Help Request';
let transactionId = 'TXN92837462';

document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL Parameters
  const params = new URLSearchParams(window.location.search);
  currentRequestId = params.get('requestId');

  // Load User & Check Auth
  const user = checkAuth();
  if (!user || user.role !== 'family') {
    window.location.href = 'index.html';
    return;
  }

  // Load Request Details
  if (currentRequestId) {
    await loadRequestDetails(currentRequestId);
  } else {
    // Default fallback values as requested
    updateSummaryUI();
  }
});

// Fetch details for request and assigned volunteer
async function loadRequestDetails(reqId) {
  try {
    const res = await apiCall('/requests', 'GET');
    if (res.ok && res.data.success) {
      const allRequests = res.data.requests;
      const request = allRequests.find(r => String(r._id) === String(reqId));
      if (request) {
        requestTitle = request.title || 'Help Request';
        if (request.senior && request.senior.name) {
          seniorName = request.senior.name;
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

        // Extract service fee if present
        if (request.serviceFee !== undefined && request.serviceFee !== null && request.serviceFee > 0) {
          volunteerFee = Number(request.serviceFee);
        }

        // --- Multi-stage Fail-Safe Volunteer Name Resolution ---
        let foundVolName = '';

        // Stage 1: Check request.volunteer object
        if (request.volunteer) {
          if (typeof request.volunteer === 'object' && request.volunteer.name) {
            foundVolName = request.volunteer.name;
          }
        }

        // Stage 2: Check request.volunteerQuotes array
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
            if (matchQuote.serviceFee !== undefined && matchQuote.serviceFee !== null && matchQuote.serviceFee > 0) {
              volunteerFee = Number(matchQuote.serviceFee);
            }
          }
        }

        // Stage 3: Cross-reference across all loaded requests to match volunteer ID string
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
    }
  } catch (err) {
    console.error('Error loading request details for payment:', err);
  }

  totalAmount = itemsCost + volunteerFee + platformFee;
  updateSummaryUI();
}

function updateSummaryUI() {
  const elItemsCost    = document.getElementById('summaryItemsCost');
  const elVolunteerFee = document.getElementById('summaryVolunteerFee');
  const elPlatformFee  = document.getElementById('summaryPlatformFee');
  const elTotal        = document.getElementById('summaryTotal');
  const btnPay         = document.getElementById('btnPay');
  const successPaidTo  = document.getElementById('successPaidTo');
  const receiptVol     = document.getElementById('receiptVolunteer');

  if (elItemsCost)    elItemsCost.textContent    = `₹${itemsCost}`;
  if (elVolunteerFee) elVolunteerFee.textContent = `₹${volunteerFee}`;
  if (elPlatformFee)  elPlatformFee.textContent  = `₹${platformFee}`;
  if (elTotal)        elTotal.textContent        = `₹${totalAmount}`;
  if (btnPay)         btnPay.textContent         = `Pay ₹${totalAmount}`;
  if (successPaidTo && volunteerName) successPaidTo.textContent = volunteerName;
  if (receiptVol && volunteerName)    receiptVol.textContent    = volunteerName;
}

function selectPaymentMethod(methodKey) {
  const radioUpi = document.getElementById('methodUpi');
  const radioDebit = document.getElementById('methodDebit');
  const radioCredit = document.getElementById('methodCredit');
  const radioNetbanking = document.getElementById('methodNetbanking');
  const upiGroup = document.getElementById('upiGroup');

  if (radioUpi) radioUpi.checked = (methodKey === 'upi');
  if (radioDebit) radioDebit.checked = (methodKey === 'debit');
  if (radioCredit) radioCredit.checked = (methodKey === 'credit');
  if (radioNetbanking) radioNetbanking.checked = (methodKey === 'netbanking');

  if (upiGroup) {
    upiGroup.style.display = (methodKey === 'upi') ? 'block' : 'none';
  }
}

// Generate random Transaction ID matching TXN format (e.g. TXN92837462)
function generateTxnId() {
  const randDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `TXN${randDigits}`;
}

async function processPayment() {
  const btnPay = document.getElementById('btnPay');
  if (btnPay) {
    btnPay.disabled = true;
    btnPay.textContent = 'Processing Payment...';
  }

  // Generate Transaction ID
  transactionId = generateTxnId();

  // Get selected payment method
  const selectedRadio = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = selectedRadio ? selectedRadio.value : 'UPI';

  // If requestId is available, commit proof verification & payment to backend
  if (currentRequestId) {
    const payload = {
      approved: true,
      paymentDetails: {
        amountPaid: totalAmount,
        itemsCost: itemsCost,
        volunteerFee: volunteerFee,
        platformFee: platformFee,
        transactionId: transactionId,
        paymentMethod: paymentMethod
      }
    };

    const res = await apiCall(`/requests/${currentRequestId}/verify-completion-family`, 'PUT', payload);
    if (res.ok && res.data.success) {
      if (res.data.request && res.data.request.volunteer && typeof res.data.request.volunteer === 'object' && res.data.request.volunteer.name) {
        volunteerName = res.data.request.volunteer.name;
      }
    } else {
      console.warn('Backend verification payment notice:', res.data?.message);
    }
  }

  // Simulate payment processing delay & show Step 4 Success Screen
  setTimeout(() => {
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
  }, 1200);
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
