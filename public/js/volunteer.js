let currentVolunteerUser = null;
let currentQuoteRequestId = null;
let activeRequestIdForCompletion = null;

function closeCompletionModal() {
  const modal = document.getElementById('completionModal');
  const form = document.getElementById('completionForm');
  if (modal) modal.style.display = 'none';
  if (form) form.reset();
  activeRequestIdForCompletion = null;
}

function openCompletionModal(id) {
  activeRequestIdForCompletion = id;
  const modal = document.getElementById('completionModal');
  if (modal) modal.style.display = 'flex';
}

function closeQuoteModal() {
  const quoteModal = document.getElementById('acceptQuoteModal');
  const quoteForm = document.getElementById('quoteForm');
  if (quoteModal) quoteModal.style.display = 'none';
  currentQuoteRequestId = null;
  if (quoteForm) quoteForm.reset();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Validate authentication
  const auth = checkAuthAndRedirect('volunteer');
  if (!auth) return;

  // Personalize welcome bar
  currentVolunteerUser = JSON.parse(localStorage.getItem('user'));
  const welcomeTitle = document.getElementById('welcomeTitle');
  if (welcomeTitle && currentVolunteerUser) {
    welcomeTitle.textContent = `Welcome, ${currentVolunteerUser.name}! 👋`;
  }

  // Render initial status from localStorage immediately
  if (currentVolunteerUser) {
    renderKycStatus(currentVolunteerUser);
  }

  // Refresh live user profile synchronously from backend on load
  try {
    const meRes = await apiCall('/auth/me', 'GET');
    if (meRes && meRes.data && meRes.data.user) {
      currentVolunteerUser = meRes.data.user;
      localStorage.setItem('user', JSON.stringify(resDataUser(meRes.data.user)));
      renderKycStatus(currentVolunteerUser);
    }
  } catch (err) {
    console.error('Error fetching profile:', err);
  }

  // Load requests
  loadVolunteerRequests();

  // Auto-refresh requests every 15 seconds so new requests pop up live
  setInterval(() => {
    loadVolunteerRequests(true);
  }, 15000);

  // --- KYC Modal Logic ---
  const kycModal = document.getElementById('kycModal');
  const btnOpenKycModal = document.getElementById('btnOpenKycModal');
  const kycModalClose = document.getElementById('kycModalClose');
  const btnCancelKyc = document.getElementById('btnCancelKyc');
  const kycForm = document.getElementById('kycForm');

  const closeKycModal = () => {
    if (kycModal) kycModal.style.display = 'none';
    if (kycForm) kycForm.reset();
  };

  if (btnOpenKycModal) {
    btnOpenKycModal.addEventListener('click', () => {
      const modalAadhaarNumber = document.getElementById('modalAadhaarNumber');
      if (modalAadhaarNumber && currentVolunteerUser && currentVolunteerUser.aadhaarNumber) {
        modalAadhaarNumber.value = currentVolunteerUser.aadhaarNumber;
      }
      if (kycModal) kycModal.style.display = 'flex';
    });
  }

  if (kycModalClose) kycModalClose.addEventListener('click', closeKycModal);
  if (btnCancelKyc) btnCancelKyc.addEventListener('click', closeKycModal);

  if (kycForm) {
    kycForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const aadhaarNumber = document.getElementById('modalAadhaarNumber').value.trim();
      const govtIdInput = document.getElementById('modalGovtIdCard');
      const selfieInput = document.getElementById('modalSelfiePhoto');

      const formData = new FormData();
      formData.append('aadhaarNumber', aadhaarNumber);
      if (govtIdInput && govtIdInput.files && govtIdInput.files[0]) {
        formData.append('govtIdCard', govtIdInput.files[0]);
      }
      if (selfieInput && selfieInput.files && selfieInput.files[0]) {
        formData.append('selfiePhoto', selfieInput.files[0]);
      }

      const res = await apiCall('/auth/kyc', 'POST', formData);
      if (res.ok && res.data && res.data.user) {
        showToast('📄 KYC Documents submitted! Admin & Police clearance is now pending review.', 'success');
        currentVolunteerUser = res.data.user;
        localStorage.setItem('user', JSON.stringify(resDataUser(res.data.user)));
        renderKycStatus(res.data.user);
        closeKycModal();
      } else {
        alert(res.data?.message || 'Failed to submit KYC documents');
      }
    });
  }

  // --- Completion Modal Logic ---
  const completionModal = document.getElementById('completionModal');
  const modalClose = document.getElementById('modalClose');
  const btnCancelComplete = document.getElementById('btnCancelComplete');
  const completionForm = document.getElementById('completionForm');

  if (modalClose) modalClose.addEventListener('click', closeCompletionModal);
  if (btnCancelComplete) btnCancelComplete.addEventListener('click', closeCompletionModal);

  if (completionForm) {
    completionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!activeRequestIdForCompletion) return;

      const resolutionNotes = document.getElementById('resolutionNotes').value.trim();
      const receiptPhotoInput = document.getElementById('receiptPhoto');

      const formData = new FormData();
      formData.append('resolutionNotes', resolutionNotes || 'Assistance successfully provided.');
      
      if (receiptPhotoInput && receiptPhotoInput.files && receiptPhotoInput.files[0]) {
        formData.append('receiptPhoto', receiptPhotoInput.files[0]);
      }

      const res = await apiCall(`/requests/${activeRequestIdForCompletion}/complete`, 'PUT', formData);

      if (res.ok && res.data.success) {
        closeCompletionModal();
        if (typeof showToast === 'function') {
          showToast(res.data.message || '✅ Request completed successfully!', 'success');
        } else {
          alert(res.data.message || 'Request completed successfully!');
        }
        loadVolunteerRequests();
      } else {
        if (typeof showToast === 'function') {
          showToast(res.data?.message || 'Error completing request', 'error');
        } else {
          alert(res.data?.message || 'Error completing request');
        }
      }
    });
  }

  // --- Quote Modal Bindings ---
  const quoteModal = document.getElementById('acceptQuoteModal');
  const quoteModalClose = document.getElementById('quoteModalClose');
  const btnCancelQuote = document.getElementById('btnCancelQuote');
  const quoteForm = document.getElementById('quoteForm');

  if (quoteModalClose) quoteModalClose.addEventListener('click', closeQuoteModal);
  if (btnCancelQuote) btnCancelQuote.addEventListener('click', closeQuoteModal);

  if (quoteForm) {
    quoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetId = currentQuoteRequestId;

      if (!targetId) {
        alert('Request ID missing. Please try clicking Volunteer to Help again.');
        return;
      }

      const feeEl = document.getElementById('quoteServiceFee');
      const notesEl = document.getElementById('quoteVolunteerNotes');

      const rawFee = feeEl ? feeEl.value : '0';
      const serviceFee = isNaN(parseFloat(rawFee)) ? 0 : Math.max(0, parseFloat(rawFee));
      const volunteerNotes = notesEl ? notesEl.value.trim() : '';

      const res = await apiCall(`/requests/${targetId}/accept`, 'PUT', {
        serviceFee,
        volunteerNotes
      });

      if (res.ok && res.data && res.data.success) {
        closeQuoteModal();
        if (typeof showToast === 'function') {
          showToast('🤝 Service fee quote submitted! Task is now sent to the family caregiver for approval.', 'success');
        } else {
          alert('Service fee quote submitted!');
        }
        loadVolunteerRequests();
      } else {
        alert(res.data?.message || 'Failed to accept request');
      }
    });
  }

  // --- Lightbox Modal Bindings ---
  const lightboxClose = document.getElementById('lightboxClose');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');
  const lightboxModal = document.getElementById('imageLightboxModal');

  if (lightboxClose) lightboxClose.addEventListener('click', closeImageLightbox);
  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeImageLightbox);

  // --- Unified Modal Outside Click Listener ---
  window.addEventListener('click', (e) => {
    if (e.target === kycModal) closeKycModal();
    if (e.target === quoteModal) closeQuoteModal();
    if (e.target === lightboxModal) closeImageLightbox();
    if (e.target === completionModal) closeCompletionModal();
  });

  // --- Trust & Verification Card Toggle Listener ---
  const btnViewTrustStatus = document.getElementById('btnViewTrustStatus');
  if (btnViewTrustStatus) {
    btnViewTrustStatus.addEventListener('click', () => {
      const kycStatusCard = document.getElementById('kycStatusCard');
      if (kycStatusCard) {
        if (kycStatusCard.style.display === 'none' || !kycStatusCard.style.display) {
          kycStatusCard.style.display = 'block';
          btnViewTrustStatus.textContent = '🛡️ Hide Verification Status';
        } else {
          kycStatusCard.style.display = 'none';
          btnViewTrustStatus.textContent = '🛡️ Verification Status: Verified ✅';
        }
      }
    });
  }
});

function resDataUser(u) {
  if (!u) return {};
  return {
    ...u,
    id: u.id || u._id,
    _id: u._id || u.id
  };
}

// Render KYC & Police Clearance Status Card
function renderKycStatus(user) {
  if (!user) return;
  const status = user.verificationStatus || 'unverified';
  const kycStatusCard = document.getElementById('kycStatusCard');
  const badgeGovtId = document.getElementById('badgeGovtId');
  const badgePhone = document.getElementById('badgePhone');
  const badgeEmail = document.getElementById('badgeEmail');
  const badgePolice = document.getElementById('badgePolice');
  const kycAlertBanner = document.getElementById('kycAlertBanner');
  const btnOpenKycModal = document.getElementById('btnOpenKycModal');
  const volunteerTaskGrid = document.getElementById('volunteerTaskGrid');
  const btnViewTrustStatus = document.getElementById('btnViewTrustStatus');

  const isIdVerified = user.isIdVerified === true || user.isIdVerified === 'true';
  const isPoliceVerified = user.isPoliceVerified === true || user.isPoliceVerified === 'true';
  const isFullyVerified = (status === 'verified') && isIdVerified && isPoliceVerified;

  const userId = user._id || user.id || '';
  const acknowledgedKey = userId ? `verified_acknowledged_${userId}` : 'verified_acknowledged';
  const hasAcknowledged = localStorage.getItem(acknowledgedKey) === 'true';

  if (badgePhone) {
    badgePhone.innerHTML = user.isPhoneVerified ? '📞 Phone: Verified' : '📞 Phone: Unverified';
    badgePhone.style.background = user.isPhoneVerified ? '#e8f5e9' : '#ffebee';
    badgePhone.style.color = user.isPhoneVerified ? '#2e7d32' : '#c62828';
  }
  if (badgeEmail) {
    badgeEmail.innerHTML = user.isEmailVerified ? '📧 Email: Verified' : '📧 Email: Unverified';
    badgeEmail.style.background = user.isEmailVerified ? '#e8f5e9' : '#ffebee';
    badgeEmail.style.color = user.isEmailVerified ? '#2e7d32' : '#c62828';
  }
  if (badgeGovtId) {
    badgeGovtId.innerHTML = isIdVerified ? '📄 Govt ID: Verified' : (user.govtIdCard ? '📄 Govt ID: Submitted (Pending)' : '📄 Govt ID: Not Uploaded');
    badgeGovtId.style.background = isIdVerified ? '#e8f5e9' : (user.govtIdCard ? '#e3f2fd' : '#ffebee');
    badgeGovtId.style.color = isIdVerified ? '#2e7d32' : (user.govtIdCard ? '#0d47a1' : '#c62828');
  }
  if (badgePolice) {
    badgePolice.innerHTML = isPoliceVerified ? '👮 Police Check: Verified' : '👮 Police Check: Pending Admin Clearance';
    badgePolice.style.background = isPoliceVerified ? '#e8f5e9' : '#fff3e0';
    badgePolice.style.color = isPoliceVerified ? '#2e7d32' : '#e65100';
  }

  if (isFullyVerified) {
    if (!hasAcknowledged) {
      // First time verified: Show Multi-Level Trust & Verification Status card ONCE with option to proceed to render service
      if (kycStatusCard) kycStatusCard.style.display = 'block';
      if (volunteerTaskGrid) volunteerTaskGrid.style.display = 'none';
      if (btnViewTrustStatus) btnViewTrustStatus.style.display = 'none';

      if (kycAlertBanner) {
        kycAlertBanner.style.borderLeftColor = '#2e7d32';
        kycAlertBanner.style.background = '#e8f5e9';
        kycAlertBanner.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <strong style="font-size: 1.1rem; color: #1b5e20;">🎉 Multi-Level Verification Complete!</strong><br>
              <span style="color: #2e7d32; font-size: 0.98rem;">Your Government ID, Phone, Email, and Police Clearance have all been verified by Admin. You are now officially authorized to render services to Senior Citizens.</span>
            </div>
            <div>
              <button id="btnProceedToService" class="btn btn-primary" style="background-color: #2e7d32; font-size: 1.05rem; padding: 12px 24px; cursor: pointer; border-radius: 8px; font-weight: bold; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-flex; align-items: center; gap: 8px;">
                🚀 Proceed to Render Service &rarr;
              </button>
            </div>
          </div>
        `;
        if (btnOpenKycModal) btnOpenKycModal.style.display = 'none';

        setTimeout(() => {
          const btnProceed = document.getElementById('btnProceedToService');
          if (btnProceed) {
            btnProceed.onclick = () => {
              localStorage.setItem(acknowledgedKey, 'true');
              if (kycStatusCard) kycStatusCard.style.display = 'none';
              if (volunteerTaskGrid) volunteerTaskGrid.style.display = 'grid';
              if (btnViewTrustStatus) btnViewTrustStatus.style.display = 'inline-block';
              if (typeof showToast === 'function') {
                showToast('🚀 Welcome! You can now browse available help requests.', 'success');
              }
            };
          }
        }, 50);
      }
    } else {
      // Later visits: User already clicked Proceed to Render Service. Hide Trust card, show other volunteer service tabs directly
      if (kycStatusCard) kycStatusCard.style.display = 'none';
      if (volunteerTaskGrid) volunteerTaskGrid.style.display = 'grid';
      if (btnViewTrustStatus) btnViewTrustStatus.style.display = 'inline-block';
    }
  } else {
    // Unverified / Pending / Rejected
    if (kycStatusCard) kycStatusCard.style.display = 'block';
    if (volunteerTaskGrid) volunteerTaskGrid.style.display = 'none';
    if (btnViewTrustStatus) btnViewTrustStatus.style.display = 'none';

    if (kycAlertBanner) {
      if (status === 'pending') {
        kycAlertBanner.style.borderLeftColor = '#0288d1';
        kycAlertBanner.style.background = '#e3f2fd';
        kycAlertBanner.innerHTML = `<strong>⏳ KYC &amp; Police Clearance Under Review.</strong> Your Govt ID and Selfie documents are submitted. Admin is conducting background &amp; police clearance. Your task portal will unlock once approved by Admin.`;
        if (btnOpenKycModal) {
          btnOpenKycModal.style.display = 'inline-block';
          btnOpenKycModal.textContent = '🔄 Update KYC Documents';
        }
      } else if (status === 'rejected') {
        kycAlertBanner.style.borderLeftColor = '#c62828';
        kycAlertBanner.style.background = '#ffebee';
        const reason = user.verificationRejectionReason ? `<br><em>Reason: ${escapeHTML(user.verificationRejectionReason)}</em>` : '';
        kycAlertBanner.innerHTML = `<strong>❌ Verification Rejected.</strong> Please re-upload your Government ID and Selfie photo to unlock your task portal.${reason}`;
        if (btnOpenKycModal) {
          btnOpenKycModal.style.display = 'inline-block';
          btnOpenKycModal.textContent = '📤 Re-submit KYC Documents';
        }
      } else {
        kycAlertBanner.style.borderLeftColor = '#f57f17';
        kycAlertBanner.style.background = '#fff8e1';
        kycAlertBanner.innerHTML = `<strong>⚠️ Verification Required!</strong> A simple login is not enough. You must upload your Govt ID and Selfie for Admin &amp; Police Clearance before accessing help requests.`;
        if (btnOpenKycModal) {
          btnOpenKycModal.style.display = 'inline-block';
          btnOpenKycModal.textContent = '📤 Submit KYC Documents Now';
        }
      }
    }
  }
}

// Volunteer opens quote modal to accept request and specify service charge
function acceptHelpRequest(id, title, pref = '') {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.verificationStatus !== 'verified') {
    showToast('🛡️ Verification Clearance Required: You must complete KYC document submission and receive Admin & Police clearance before accepting requests.', 'error');
    const kycModal = document.getElementById('kycModal');
    if (kycModal) kycModal.style.display = 'flex';
    return;
  }

  currentQuoteRequestId = id;
  const modal = document.getElementById('acceptQuoteModal');
  const titleEl = document.getElementById('quoteRequestTitle');
  const feeInput = document.getElementById('quoteServiceFee');
  const notesInput = document.getElementById('quoteVolunteerNotes');

  const prefContainer = document.getElementById('quoteModalPrefContainer');
  const prefText = document.getElementById('quoteModalPrefText');

  if (titleEl && title) titleEl.textContent = title;
  if (feeInput) feeInput.value = '';
  if (notesInput) notesInput.value = '';

  if (pref && pref.trim()) {
    if (prefText) prefText.textContent = pref.trim();
    if (prefContainer) prefContainer.style.display = 'block';
  } else {
    if (prefContainer) prefContainer.style.display = 'none';
  }

  if (modal) modal.style.display = 'flex';
}



// Fetch and Render requests for Volunteers
async function loadVolunteerRequests(silent = false) {
  // Always sync latest verification profile from backend
  const meRes = await apiCall('/auth/me', 'GET');
  if (meRes.ok && meRes.data && meRes.data.user) {
    currentVolunteerUser = meRes.data.user;
    localStorage.setItem('user', JSON.stringify(meRes.data.user));
    renderKycStatus(meRes.data.user);
  }

  const pendingList       = document.getElementById('pendingList');
  const awaitingList      = document.getElementById('awaitingList');
  const activeList        = document.getElementById('activeList');
  const historyList       = document.getElementById('historyList');
  const notificationsCard = document.getElementById('notificationsCard');
  const notificationsList = document.getElementById('notificationsList');

  if (!silent) {
    const spinnerHtml = `<div class="loading-wrapper"><div class="spinner"></div><span>Loading...</span></div>`;
    if (pendingList)  pendingList.innerHTML  = spinnerHtml;
    if (awaitingList) awaitingList.innerHTML = spinnerHtml;
    if (activeList)   activeList.innerHTML   = spinnerHtml;
    if (historyList)  historyList.innerHTML  = spinnerHtml;
  }

  const res = await apiCall('/requests', 'GET');

  if (res.ok && res.data.success) {
    const requests = res.data.requests;
    const userStr = localStorage.getItem('user');
    let currentUserId = '';
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        currentUserId = String(u._id || u.id || '');
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }

    const isMyApprovedTask = (r) => {
      if (!r || !r.volunteer || !currentUserId) return false;
      const volId = typeof r.volunteer === 'object' ? (r.volunteer._id || r.volunteer.id) : r.volunteer;
      return String(volId) === String(currentUserId);
    };

    const hasMyQuote = (r) => {
      if (!r || !currentUserId) return false;
      if (r.volunteerQuotes && r.volunteerQuotes.length > 0) {
        return r.volunteerQuotes.some(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === String(currentUserId));
      }
      return isMyApprovedTask(r);
    };

    // Split by status:
    // 0. Task Assignment Notifications: Requests where this volunteer submitted a quote, but caregiver selected another volunteer
    const notifiedRequests  = requests.filter(r => (r.status === 'accepted' || r.status === 'completed') && hasMyQuote(r) && !isMyApprovedTask(r));
    // 1. Available Help Requests: Open requests with status 'pending' or 'awaiting_approval'
    const pendingRequests   = requests.filter(r => r.status === 'pending' || r.status === 'awaiting_approval');
    // 2. Awaiting Family Approval: Requests where this volunteer submitted a quote and status is 'awaiting_approval'
    const awaitingRequests  = requests.filter(r => r.status === 'awaiting_approval' && hasMyQuote(r));
    // 3. Active Commitments: Requests where caregiver APPROVED this volunteer
    const activeRequests    = requests.filter(r => r.status === 'accepted' && isMyApprovedTask(r));
    // 4. Completed History: Tasks completed by this volunteer
    const completedRequests = requests.filter(r => r.status === 'completed' && isMyApprovedTask(r));

    // --- Render Task Notifications ---
    if (notificationsCard && notificationsList) {
      if (notifiedRequests.length > 0) {
        notificationsCard.style.display = 'block';
        notificationsList.innerHTML = notifiedRequests.map(req => {
          const seniorName = req.senior ? escapeHTML(req.senior.name) : 'Senior Citizen';

          return `
            <div class="request-card" style="border-left: 5px solid #2e7d32; background: #ffffff; margin-bottom: 1rem;">
              <div class="request-card-header">
                <div class="request-title" style="color: #1b5e20;">📋 ${escapeHTML(req.title)}</div>
                <span class="badge" style="background: #2e7d32; color: #fff;">ℹ️ Task Assigned</span>
              </div>
              <div style="margin-top: 10px; padding: 12px 16px; background-color: #e8f5e9; border: 2px solid #2e7d32; border-radius: 10px;">
                <p style="color: #1b5e20; font-weight: bold; font-size: 1.02rem; margin-bottom: 4px;">
                  📢 The caregiver has assigned this task to another volunteer.
                </p>
                <p style="color: #2e7d32; font-size: 0.93rem; margin: 0;">
                  Thank you so much for offering your voluntary support to <strong>${seniorName}</strong>! You can browse and quote on other open requests below.
                </p>
              </div>
            </div>`;
        }).join('');
      } else {
        notificationsCard.style.display = 'none';
      }
    }

    // --- Render Available (Pending) Requests ---
    if (pendingList) {
      if (pendingRequests.length === 0) {
        pendingList.innerHTML = `
          <div style="padding: 1.5rem; background: var(--color-white); border-radius: var(--border-radius); text-align: center; border: 2px dashed var(--color-primary-light);">
            <p style="color: var(--color-primary-dark); font-weight: bold;">No pending help requests at this time.</p>
            <p style="font-size: 0.95rem; margin-top: 5px;">Check back later to support Senior Citizens in need!</p>
          </div>`;
      } else {
        pendingList.innerHTML = pendingRequests.map(req => {
          let urgencyClass = req.urgency === 'high' ? 'urgency-high' : req.urgency === 'emergency' ? 'urgency-emergency' : '';
          let urgencyLabel = req.urgency === 'emergency' ? 'SOS EMERGENCY' : req.urgency === 'high' ? 'High Priority' : 'Normal';
          let audioHtml = req.audioFile ? `<div class="request-audio-player"><label>🎙️ Senior's Voice Message:</label><audio controls src="${req.audioFile}"></audio></div>` : '';

          let existingQuoteBadge = '';
          let myQuote = null;
          let otherQuote = null;

          if (req.volunteerQuotes && req.volunteerQuotes.length > 0) {
            myQuote = req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === String(currentUserId));
            otherQuote = req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) !== String(currentUserId));
          }

          if (myQuote) {
            const feeStr = (myQuote.serviceFee !== undefined && myQuote.serviceFee > 0) ? `₹${myQuote.serviceFee}` : '₹0 (Free)';
            existingQuoteBadge = `
              <div style="margin-top: 10px; padding: 10px 14px; background: #e8f5e9; border-left: 4px solid #2e7d32; border-radius: 8px; font-size: 0.92rem; color: #1b5e20;">
                ✅ <strong>You submitted a quote: ${feeStr}</strong> (Awaiting Caregiver Selection). You can update your quote below!
              </div>`;
          } else if (otherQuote) {
            const volObj = otherQuote.volunteer;
            const otherVolName = (typeof volObj === 'object' && volObj.name) ? escapeHTML(volObj.name) : 'Another volunteer';
            const feeStr = (otherQuote.serviceFee !== undefined && otherQuote.serviceFee > 0) ? `₹${otherQuote.serviceFee}` : '₹0 (Free)';
            const countStr = req.volunteerQuotes.length > 1 ? ` (${req.volunteerQuotes.length} quotes submitted)` : '';
            existingQuoteBadge = `
              <div style="margin-top: 10px; padding: 10px 14px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 8px; font-size: 0.92rem; color: #0d47a1;">
                ℹ️ <strong>${otherVolName}</strong> quoted <strong>${feeStr}</strong>${countStr} (Awaiting Caregiver Selection). You can also submit your quote!
              </div>`;
          }

          const btnText = myQuote ? '✏️ Update Your Quote' : '🤝 Volunteer to Help';

          return `
            <div class="request-card ${urgencyClass}">
              <div class="request-card-header">
                <div class="request-title">${escapeHTML(req.title)}</div>
                <div style="display: flex; gap: 8px;">
                  <span class="badge ${req.urgency === 'emergency' ? 'badge-urgency-emergency' : req.urgency === 'high' ? 'badge-urgency-high' : 'badge-urgency'}">${urgencyLabel}</span>
                  <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
                </div>
              </div>
              ${req.description ? `<div class="request-description">${escapeHTML(req.description)}</div>` : ''}
              
              <!-- Caregiver Shopping Preference Banner -->
              <div class="caregiver-pref-box" style="margin: 12px 0; padding: 12px 16px; background: linear-gradient(135deg, #fff3e0, #ffe0b2); border: 2px solid #f57c00; border-left: 6px solid #e65100; border-radius: 10px; box-shadow: 0 2px 8px rgba(230,81,0,0.12);">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 1.02rem; font-weight: 800; color: #e65100;">
                  <span>🛒 Caregiver Shopping Preference:</span>
                </div>
                <div style="margin-top: 4px; font-size: 1.08rem; font-weight: 700; color: #bf360c;">
                  ${escapeHTML((req.shoppingPreference && req.shoppingPreference.trim()) ? req.shoppingPreference.trim() : 'No Preference')}
                </div>
              </div>

              ${audioHtml}
              ${existingQuoteBadge}
              ${renderPlatformHelperHtml(req)}
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 0.9rem; color: #666;">Posted: ${new Date(req.createdAt).toLocaleDateString()}</span>
                <button class="btn btn-primary" onclick="acceptHelpRequest('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', '${escapeHTML(req.shoppingPreference || 'No Preference').replace(/'/g, "\\'")}')" style="padding: 10px 20px; font-size: 1rem; min-height: 48px;">
                  ${btnText}
                </button>
              </div>
            </div>`;
        }).join('');
      }
    }
    // --- Render Awaiting Family Approval ---
    if (awaitingList) {
      if (awaitingRequests.length === 0) {
        awaitingList.innerHTML = `<div style="text-align: center; color: #666; padding: 1rem;">No tasks currently awaiting family approval.</div>`;
      } else {
        awaitingList.innerHTML = awaitingRequests.map(req => {
          return `
            <div class="request-card" style="border-left: 4px solid var(--color-warning);">
              <div class="request-card-header">
                <div class="request-title">${escapeHTML(req.title)}</div>
                <span class="badge badge-warning">⏳ Awaiting Family Approval</span>
              </div>
              ${req.description ? `<div class="request-description">${escapeHTML(req.description)}</div>` : ''}
              
              <!-- Caregiver Shopping Preference Banner -->
              <div class="caregiver-pref-box" style="margin: 12px 0; padding: 12px 16px; background: linear-gradient(135deg, #fff3e0, #ffe0b2); border: 2px solid #f57c00; border-left: 6px solid #e65100; border-radius: 10px; box-shadow: 0 2px 8px rgba(230,81,0,0.12);">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 1.02rem; font-weight: 800; color: #e65100;">
                  <span>🛒 Caregiver Shopping Preference:</span>
                </div>
                <div style="margin-top: 4px; font-size: 1.08rem; font-weight: 700; color: #bf360c;">
                  ${escapeHTML((req.shoppingPreference && req.shoppingPreference.trim()) ? req.shoppingPreference.trim() : 'No Preference')}
                </div>
              </div>

              <div class="request-details">
                <p><strong>Senior:</strong> ${req.senior ? req.senior.name : 'Senior Citizen'}</p>
                <p><em>You have accepted this task. The senior's family caregiver has been notified to review and approve your commitment.</em></p>
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Active Commitments (Accepted) ---
    if (activeList) {
      if (activeRequests.length === 0) {
        activeList.innerHTML = `<div style="text-align: center; color: #666; padding: 1rem;">You have no active help commitments right now.</div>`;
      } else {
        activeList.innerHTML = activeRequests.map(req => {
          let seniorName    = req.senior ? req.senior.name : 'Senior Citizen';
          let seniorPhone   = req.senior ? req.senior.phone : 'Not provided';
          let seniorAddress = req.senior ? req.senior.address : 'Not provided';
          let emergencyContact = req.senior ? req.senior.emergencyContact : 'Not provided';

          const isRejected = req.completionVerified === 'rejected';

          let rejectionWarningBox = '';
          if (isRejected) {
            rejectionWarningBox = `
              <div style="margin: 1rem 0; padding: 12px 16px; background-color: #ffebee; border: 2px solid var(--color-emergency); border-radius: 12px;">
                <p style="color: var(--color-emergency); font-weight: bold; font-size: 1.05rem; margin-bottom: 4px;">
                  ⚠️ Delivery Verification Rejected by Family Caregiver
                </p>
                <p style="color: #c62828; font-size: 0.95rem; margin: 0;">
                  <strong>Reason:</strong> "${escapeHTML(req.verificationRejectionReason || 'Caregiver requested updated receipt or delivery photo proof.')}"
                </p>
                <p style="color: #444; font-size: 0.9rem; margin-top: 6px;">
                  This task has been un-marked as complete. Please re-upload the updated receipt or delivery photo below and re-apply for verification.
                </p>
              </div>`;
          }

          return `
            <div class="request-card" style="border-left: 5px solid ${isRejected ? 'var(--color-emergency)' : 'var(--color-primary-dark)'};">
              <div class="request-card-header">
                <div class="request-title">${escapeHTML(req.title)}</div>
                <span class="badge ${isRejected ? 'badge-urgency-emergency' : 'badge-active'}">${isRejected ? '⚠️ Action Required: Re-apply' : 'In Progress'}</span>
              </div>

              ${req.description ? `<div class="request-description" style="margin-top: 10px;">${escapeHTML(req.description)}</div>` : ''}

              <!-- Caregiver Shopping Preference Banner -->
              <div class="caregiver-pref-box" style="margin: 12px 0; padding: 12px 16px; background: linear-gradient(135deg, #fff3e0, #ffe0b2); border: 2px solid #f57c00; border-left: 6px solid #e65100; border-radius: 10px; box-shadow: 0 2px 8px rgba(230,81,0,0.12);">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 1.02rem; font-weight: 800; color: #e65100;">
                  <span>🛒 Caregiver Shopping Preference:</span>
                </div>
                <div style="margin-top: 4px; font-size: 1.08rem; font-weight: 700; color: #bf360c;">
                  ${escapeHTML((req.shoppingPreference && req.shoppingPreference.trim()) ? req.shoppingPreference.trim() : 'No Preference')}
                </div>
              </div>
              
              <div class="request-details" style="background-color: var(--color-bg-light); border: 2px solid var(--color-primary-light);">
                <p style="font-size: 1.1rem; border-bottom: 2px solid var(--color-primary-light); padding-bottom: 5px; margin-bottom: 8px;"><strong>Senior Citizen Information:</strong></p>
                <p><strong>Name:</strong> ${escapeHTML(seniorName)}</p>
                <p><strong>Phone:</strong> <a href="tel:${seniorPhone}" style="color: var(--color-primary-dark); font-weight: bold;">${escapeHTML(seniorPhone)}</a></p>
                <p><strong>Address:</strong> ${escapeHTML(seniorAddress)}</p>
                <p><strong>Emergency Contact:</strong> ${escapeHTML(emergencyContact)}</p>
              </div>

              ${rejectionWarningBox}

              ${renderPlatformHelperHtml(req)}

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 0.9rem; color: #666;">Accepted: ${new Date(req.acceptedAt || Date.now()).toLocaleDateString()}</span>
                <button class="btn btn-primary" onclick="openCompletionModal('${req._id}')" style="padding: 10px 20px; font-size: 1rem; min-height: 48px; background-color: ${isRejected ? '#c62828' : 'var(--color-primary-dark)'};">
                  ${isRejected ? '📸 Re-upload Receipt & Re-apply for Verification' : '✅ Complete Request & Upload Receipt'}
                </button>
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Service History (Completed Tasks with Verification Status) ---
    if (historyList) {
      if (completedRequests.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; color: #666; padding: 1rem;">No completed requests logged yet.</div>`;
      } else {
        historyList.innerHTML = completedRequests.map(req => {
          let audioHtml = req.audioFile ? `<div class="request-audio-player"><label>🎙️ Senior's Voice Message:</label><audio controls src="${req.audioFile}"></audio></div>` : '';
          
          let proofHtml = req.completionProof ? `
            <div style="margin-top: 10px; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-weight: bold; color: var(--color-primary-dark); font-size: 0.9rem;">📸 Uploaded Receipt / Delivery Photo:</label>
                <button type="button" onclick="openImageLightbox('${escapeHTML(req.completionProof)}')" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.85rem; min-height: 32px;">🔍 View Photo</button>
              </div>
              <img src="${escapeHTML(req.completionProof)}" alt="Receipt Photo Proof" onclick="openImageLightbox('${escapeHTML(req.completionProof)}')" style="max-width: 100%; max-height: 180px; border-radius: 6px; margin-top: 5px; display: block; object-fit: contain; cursor: pointer;">
            </div>` : '<div style="margin-top: 8px; font-size: 0.85rem; color: #888;">No receipt/delivery photo attached.</div>';

          let verifyBadge = '';
          let reapplyButtonHtml = '';
          let rejectionReasonAlert = '';

          if (req.completionVerified === 'verified') {
            verifyBadge = `<span class="badge" style="background-color: #2e7d32; color: #fff;">✅ Delivery Verified</span>`;
          } else if (req.completionVerified === 'rejected') {
            verifyBadge = `<span class="badge" style="background-color: #c62828; color: #fff;">❌ VERIFICATION REJECTED</span>`;
            
            rejectionReasonAlert = `
              <div style="margin-top: 10px; padding: 12px 16px; background-color: #ffebee; border: 2px solid var(--color-emergency); border-radius: 10px;">
                <p style="color: var(--color-emergency); font-weight: bold; font-size: 1rem; margin-bottom: 4px;">
                  ⚠️ Verification Rejected by Family Caregiver
                </p>
                <p style="color: #c62828; font-size: 0.95rem; margin: 0;">
                  <strong>Reason:</strong> "${escapeHTML(req.verificationRejectionReason || 'Caregiver requested updated receipt or delivery photo proof.')}"
                </p>
              </div>`;

            reapplyButtonHtml = `
              <div style="margin-top: 14px; text-align: right;">
                <button 
                  class="btn" 
                  onclick="openCompletionModal('${req._id}')" 
                  style="background-color: #c62828; color: #ffffff !important; font-weight: 700; padding: 14px 22px; font-size: 1.05rem; border-radius: 10px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(198,40,40,0.3);"
                >
                  📸 Re-upload Receipt &amp; Re-apply for Verification
                </button>
              </div>`;
          } else if (req.requiresSeniorVoiceCall) {
            verifyBadge = `<span class="badge" style="background-color: #0288d1; color: #fff;">📞 Voice Call Sent to Senior</span>`;
          } else {
            verifyBadge = `<span class="badge" style="background-color: #f57c00; color: #fff;">⏳ Pending Caregiver Verification</span>`;
          }

          return `
            <div class="request-card" style="opacity: 1; border-color: ${req.completionVerified === 'rejected' ? 'var(--color-emergency)' : '#ddd'}; border-left: 5px solid ${req.completionVerified === 'rejected' ? 'var(--color-emergency)' : '#ddd'};">
              <div class="request-card-header">
                <div class="request-title" style="color: #444;">${escapeHTML(req.title)}</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${verifyBadge}
                  <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
                </div>
              </div>
              ${req.description ? `<div class="request-description">${escapeHTML(req.description)}</div>` : ''}
              ${req.shoppingPreference ? `
                <div style="margin-top: 8px; margin-bottom: 12px; padding: 10px 14px; background: #fff3e0; border-left: 4px solid #e65100; border-radius: 8px; font-size: 0.98rem; color: #e65100; font-weight: 600;">
                  🛒 <strong>Caregiver Shopping Preference:</strong> ${escapeHTML(req.shoppingPreference)}
                </div>` : ''}
              ${audioHtml}
              ${proofHtml}
              ${rejectionReasonAlert}
              <div class="request-details" style="margin-top: 10px;">
                <p><strong>Senior Assisted:</strong> ${req.senior ? escapeHTML(req.senior.name) : 'Senior Citizen'}</p>
                <p><strong>Completion Notes:</strong> ${escapeHTML(req.resolutionNotes)}</p>
                <p><strong>Completed On:</strong> ${new Date(req.completedAt || Date.now()).toLocaleDateString()}</p>
              </div>
              ${reapplyButtonHtml}
            </div>`;
        }).join('');
      }
    }

  } else {
    alert("Error loading requests data");
  }
}



// Helper to escape HTML characters to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ──────────────────────────────────────────────────────────
// AI DYNAMIC PLATFORM RECOMMENDATION & PRE-FILLED LINK HELPER
// ──────────────────────────────────────────────────────────
function renderPlatformHelperHtml(req) {
  let platforms = req.suggestedPlatforms;
  
  // Client-side fallback if request doesn't have stored platforms
  if (!platforms || platforms.length === 0) {
    const text = `${req.title || ''} ${req.description || ''} ${req.transcript || ''}`.toLowerCase();
    const query = req.extractedItems || req.title || 'items';
    const enc = encodeURIComponent(query);

    if (text.includes('crocin') || text.includes('medicine') || text.includes('tablet') || text.includes('dolo') || text.includes('syrup')) {
      platforms = [
        { name: 'Apollo 24|7', icon: '🏥', url: `https://www.apollo247.com/search-medicines/${enc}`, color: '#005b9f', searchQuery: query },
        { name: 'PharmEasy', icon: '💊', url: `https://pharmeasy.in/search/all?name=${enc}`, color: '#10847e', searchQuery: query },
        { name: 'Tata 1mg', icon: '🧪', url: `https://www.1mg.com/search/all?name=${enc}`, color: '#ff6f61', searchQuery: query },
        { name: 'NetMeds', icon: '🩹', url: `https://www.netmeds.com/catalogsearch/result?q=${enc}`, color: '#24aeb1', searchQuery: query }
      ];
    } else if (text.includes('pizza') || text.includes('burger') || text.includes('biryani') || text.includes('paratha') || text.includes('food')) {
      platforms = [
        { name: 'Swiggy', icon: '🍕', url: `https://www.swiggy.com/search?query=${enc}`, color: '#fc8019', searchQuery: query },
        { name: 'Zomato', icon: '🔴', url: `https://www.zomato.com/search?q=${enc}`, color: '#cb202d', searchQuery: query },
        { name: 'EatSure', icon: '🍲', url: `https://www.eatsure.com/`, color: '#ff4f00', searchQuery: query }
      ];
    } else if (text.includes('cab') || text.includes('taxi') || text.includes('uber') || text.includes('ola') || text.includes('ride')) {
      platforms = [
        { name: 'Uber', icon: '🚕', url: `https://m.uber.com/`, color: '#000000', searchQuery: query },
        { name: 'Ola', icon: '🚖', url: `https://book.olacabs.com/`, color: '#2bb673', searchQuery: query },
        { name: 'Rapido', icon: '🛵', url: `https://www.rapido.bike/`, color: '#f9a825', searchQuery: query }
      ];
    } else if (text.includes('bill') || text.includes('electricity') || text.includes('recharge') || text.includes('pay')) {
      platforms = [
        { name: 'Google Pay', icon: '💳', url: `https://pay.google.com/`, color: '#1a73e8', searchQuery: query },
        { name: 'PhonePe', icon: '🟣', url: `https://www.phonepe.com/`, color: '#5f259f', searchQuery: query },
        { name: 'Paytm', icon: '📲', url: `https://paytm.com/`, color: '#00b9f1', searchQuery: query },
        { name: 'BHIM', icon: '🇮🇳', url: `https://www.bhimupi.org.in/`, color: '#003975', searchQuery: query }
      ];
    } else if (text.includes('doctor') || text.includes('appointment') || text.includes('hospital') || text.includes('clinic')) {
      platforms = [
        { name: 'Practo', icon: '👨‍⚕️', url: `https://www.practo.com/search?q=${enc}`, color: '#28328c', searchQuery: query },
        { name: 'Apollo 24|7', icon: '🏥', url: `https://www.apollo247.com/specialties`, color: '#005b9f', searchQuery: query },
        { name: 'MediBuddy', icon: '🩺', url: `https://www.medibuddy.in/`, color: '#1a73e8', searchQuery: query }
      ];
    } else {
      platforms = [
        { name: 'Blinkit', icon: '⚡', url: `https://blinkit.com/s/?q=${enc}`, color: '#f5c518', searchQuery: query },
        { name: 'Instamart', icon: '🛒', url: `https://www.swiggy.com/instamart/search?custom_back=true&query=${enc}`, color: '#fc8019', searchQuery: query },
        { name: 'Zepto', icon: '💜', url: `https://www.zeptonow.com/search?q=${enc}`, color: '#7b1fa2', searchQuery: query },
        { name: 'BigBasket', icon: '🧺', url: `https://www.bigbasket.com/ps/?q=${enc}`, color: '#689f38', searchQuery: query },
        { name: 'Amazon Fresh', icon: '🥬', url: `https://www.amazon.in/s?k=${enc}`, color: '#232f3e', searchQuery: query }
      ];
    }
  }

  const cleanQ = cleanProductQuery(req.extractedItems || req.description || req.transcript || '');
  const queryLabel = escapeHTML(cleanQ);

  const chipsHtml = platforms.map(p => {
    const q = cleanProductQuery(p.searchQuery || req.extractedItems || req.description || req.transcript || '');
    return `
      <button 
        type="button" 
        class="platform-chip-btn" 
        style="border-color: ${p.color || '#1976d2'};"
        onclick="openPlatformWithPreFill('${escapeHTML(p.url)}', '${escapeHTML(q)}', '${escapeHTML(p.name)}')"
        title="Open ${escapeHTML(p.name)} pre-filled search for '${escapeHTML(q)}'"
      >
        <span>${p.icon || '🚀'}</span>
        <span>${escapeHTML(p.name)}</span>
        <span style="font-size:0.75rem; color:#888; font-weight:normal;">↗</span>
      </button>`;
  }).join('');

  return `
    <div class="ai-platform-recommendation-box">
      <div class="ai-platform-header">
        <span class="ai-platform-title">🤖 AI Suggested Ordering Platforms</span>
        ${queryLabel ? `<span class="platform-items-pill">🔍 Items: "${queryLabel}"</span>` : ''}
      </div>
      <div class="platform-chips-grid">
        ${chipsHtml}
      </div>
    </div>`;
}

function openPlatformWithPreFill(savedUrl, searchQuery, platformName) {
  const itemQuery = cleanProductQuery(searchQuery);
  const finalUrl = getDynamicPlatformSearchUrl(platformName, itemQuery) || savedUrl;

  // Copy product items to clipboard for smooth paste fallback
  if (itemQuery && navigator.clipboard) {
    navigator.clipboard.writeText(itemQuery).catch(() => {});
  }

  // Open search URL pre-filled with requested product in new tab
  window.open(finalUrl, '_blank');
}

/**
 * Sanitizes search query string so it never contains auto-generated 'Help Request' titles
 */
function cleanProductQuery(q) {
  if (!q || typeof q !== 'string') return 'bread milk';
  let cleaned = q.replace(/Help Request\s*[-–—]?\s*\d{1,2}\s+\w+\s+\d{4}/gi, ' ')
                 .replace(/Help Request\s*[-–—]?\s*/gi, ' ')
                 .replace(/\bHelp Request\b/gi, ' ')
                 .replace(/\bEMERGENCY ALARM ACTIVE\b/gi, ' ')
                 .replace(/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi, ' ')
                 .trim();
  if (!cleaned || cleaned.toLowerCase().includes('help request')) {
    return 'bread milk';
  }
  return cleaned;
}

/**
 * Ensures the generated URL always contains the exact pre-filled search query in the platform's searchbar
 */
function getDynamicPlatformSearchUrl(platformName, query) {
  const cleanQ = cleanProductQuery(query);
  const enc = encodeURIComponent(cleanQ);
  const p = (platformName || '').toLowerCase();

  if (p.includes('blinkit')) return `https://blinkit.com/s/?q=${enc}`;
  if (p.includes('instamart')) return `https://www.swiggy.com/instamart/search?custom_back=true&query=${enc}`;
  if (p.includes('zepto')) return `https://www.zeptonow.com/search?q=${enc}`;
  if (p.includes('bigbasket')) return `https://www.bigbasket.com/ps/?q=${enc}`;
  if (p.includes('amazon fresh')) return `https://www.amazon.in/s?k=${enc}`;
  if (p.includes('swiggy')) return `https://www.swiggy.com/search?query=${enc}`;
  if (p.includes('zomato')) return `https://www.zomato.com/search?q=${enc}`;
  if (p.includes('apollo')) return `https://www.apollo247.com/search-medicines/${enc}`;
  if (p.includes('pharmeasy')) return `https://pharmeasy.in/search/all?name=${enc}`;
  if (p.includes('1mg') || p.includes('tata')) return `https://www.1mg.com/search/all?name=${enc}`;
  if (p.includes('netmeds')) return `https://www.netmeds.com/catalogsearch/result?q=${enc}`;
  if (p.includes('practo')) return `https://www.practo.com/search/doctors?results_type=doctor&q=${enc}`;
  if (p.includes('medibuddy')) return `https://www.medibuddy.in/search?q=${enc}`;
  if (p.includes('croma')) return `https://www.croma.com/searchB?q=${enc}`;
  if (p.includes('reliance')) return `https://www.reliancedigital.in/search?q=${enc}`;
  if (p.includes('flipkart')) return `https://www.flipkart.com/search?q=${enc}`;
  if (p.includes('amazon')) return `https://www.amazon.in/s?k=${enc}`;
  if (p.includes('myntra')) return `https://www.myntra.com/${enc}`;
  if (p.includes('fnp')) return `https://www.fnp.com/search?q=${enc}`;
  if (p.includes('igp')) return `https://www.igp.com/search?q=${enc}`;
  if (p.includes('headsup') || p.includes('tails')) return `https://headsupfortails.com/search?q=${enc}`;
  if (p.includes('supertails')) return `https://supertails.com/search?q=${enc}`;

  return `https://www.google.com/search?q=${encodeURIComponent(platformName + ' ' + cleanQ)}`;
}

// ──────────────────────────────────────────────────────────
// IMAGE LIGHTBOX MODAL FUNCTIONS
// ──────────────────────────────────────────────────────────
function openImageLightbox(imageUrl) {
  if (!imageUrl) return;
  const cleanUrl = imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl;

  const modal = document.getElementById('imageLightboxModal');
  const imgEl = document.getElementById('lightboxImage');
  const linkEl = document.getElementById('lightboxDirectLink');

  if (imgEl) imgEl.src = cleanUrl;
  if (linkEl) linkEl.href = cleanUrl;
  if (modal) modal.style.display = 'flex';
}

function closeImageLightbox() {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) modal.style.display = 'none';
}
