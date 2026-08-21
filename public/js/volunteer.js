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
  const attachedContainer = document.getElementById('attachedDocsContainer');
  const attachedList = document.getElementById('attachedDocsList');
  const attachedCount = document.getElementById('attachedDocsCount');
  const notesEl = document.getElementById('resolutionNotes');

  const req = (window.allVolunteerRequestsMap && window.allVolunteerRequestsMap[id]);

  if (attachedContainer && attachedList) {
    const purchases = (req && req.merchantPurchases && req.merchantPurchases.length > 0) ? req.merchantPurchases : [];
    const extraDocs = (req && req.purchaseProofDocs && req.purchaseProofDocs.length > 0) ? req.purchaseProofDocs : [];

    if (purchases.length > 0 || extraDocs.length > 0) {
      attachedContainer.style.display = 'block';
      if (attachedCount) attachedCount.textContent = `${purchases.length || extraDocs.length} Attached`;

      let html = '';
      if (purchases.length > 0) {
        purchases.forEach((p, idx) => {
          html += `
            <div class="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between text-xs gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center text-[10px] flex-shrink-0">#${idx + 1}</span>
                <div class="truncate">
                  <span class="font-extrabold text-slate-900 block truncate">${p.merchant || 'Store'} — ₹${p.amount}</span>
                  <span class="text-[10px] text-slate-500 font-medium block truncate">${p.itemName ? 'Item: ' + p.itemName : 'Paid via ' + (p.paymentDestinationType || 'Escrow')}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                ${p.receiptDoc ? `
                  <button type="button" onclick="event.stopPropagation(); openImageLightbox('${normalizeDocUrl(p.receiptDoc)}')" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                    <svg class="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>View Bill</span>
                  </button>
                ` : (p.noReceiptReason ? `
                  <span class="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-1 rounded-lg">No Bill (${p.noReceiptReason})</span>
                ` : `<span class="text-[10px] text-slate-400 font-bold italic">No file needed</span>`)}
              </div>
            </div>
          `;
        });
      } else if (extraDocs.length > 0) {
        extraDocs.forEach((doc, idx) => {
          html += `
            <div class="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
              <span class="font-bold text-slate-800">Attached Document #${idx + 1}</span>
              <button type="button" onclick="event.stopPropagation(); openImageLightbox('${normalizeDocUrl(doc)}')" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                <svg class="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>View Proof</span>
              </button>
            </div>
          `;
        });
      }
      attachedList.innerHTML = html;
    } else {
      attachedContainer.style.display = 'none';
    }
  }

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
  const navUserName = document.getElementById('navUserName');
  if (welcomeTitle && currentVolunteerUser) {
    welcomeTitle.textContent = `Welcome back, ${currentVolunteerUser.name || 'Volunteer'}!`;
  }
  if (navUserName && currentVolunteerUser) {
    navUserName.textContent = `Hello, ${currentVolunteerUser.name || 'Volunteer'}`;
  }

  // Render initial status from localStorage immediately
  if (currentVolunteerUser) {
    renderKycStatus(currentVolunteerUser);
    await renderRatingProfileCard(currentVolunteerUser);
  }

  // Refresh live user profile synchronously from backend on load
  try {
    const meRes = await apiCall('/auth/me', 'GET');
    if (meRes && meRes.data && meRes.data.user) {
      currentVolunteerUser = meRes.data.user;
      localStorage.setItem('user', JSON.stringify(resDataUser(meRes.data.user)));
      if (welcomeTitle) {
        welcomeTitle.textContent = `Welcome back, ${currentVolunteerUser.name || 'Volunteer'}!`;
      }
      if (navUserName) {
        navUserName.textContent = `Hello, ${currentVolunteerUser.name || 'Volunteer'}`;
      }
      renderKycStatus(currentVolunteerUser);
      await renderRatingProfileCard(currentVolunteerUser);
    }
  } catch (err) {
    console.error('Error fetching profile:', err);
  }

  // Load requests
  await loadVolunteerRequests();

  // Support ?tab= URL param (e.g. ?tab=active)
  const urlParams = new URLSearchParams(window.location.search);
  const qTab = urlParams.get('tab');
  if (qTab && ['pending', 'active', 'awaiting', 'history'].includes(qTab)) {
    switchTaskTab(qTab);
  }

  // Load earnings wallet
  loadVolunteerEarnings();

  // Auto-refresh requests every 15 seconds so new requests pop up live
  setInterval(() => {
    loadVolunteerRequests(true);
  }, 15000);

  // Auto-refresh earnings every 60 seconds
  setInterval(() => {
    loadVolunteerEarnings(true);
  }, 60000);

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
        showToast('KYC Documents submitted! Admin & Police clearance is now pending review.', 'success');
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
      
      if (receiptPhotoInput && receiptPhotoInput.files && receiptPhotoInput.files.length > 0) {
        for (let i = 0; i < receiptPhotoInput.files.length; i++) {
          formData.append('proofs', receiptPhotoInput.files[i]);
        }
      }

      const res = await apiCall(`/requests/${activeRequestIdForCompletion}/complete`, 'PUT', formData);

      if (res.ok && res.data.success) {
        closeCompletionModal();
        if (typeof showToast === 'function') {
          showToast(res.data.message || 'Request completed successfully!', 'success');
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
          showToast('Service fee quote submitted! Task is now sent to the family caregiver for approval.', 'success');
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
          btnViewTrustStatus.textContent = 'Hide Verification Status';
        } else {
          kycStatusCard.style.display = 'none';
          btnViewTrustStatus.textContent = 'Verification Status: Verified';
        }
      }
    });
  }

  // Initialize the default tab
  if (typeof switchTaskTab === 'function') {
    switchTaskTab('pending');
  } else if (window.switchTaskTab) {
    window.switchTaskTab('pending');
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

  // Section elements to show/hide based on verification
  const topMetricsGrid = document.getElementById('topMetricsGrid');
  const volunteerWorkspaceGrid = document.getElementById('volunteerWorkspaceGrid');
  const helperPerformanceSection = document.getElementById('helperPerformanceSection');
  const earningsWalletCard = document.getElementById('earningsWalletCard');
  const unverifiedTrustContainer = document.getElementById('unverifiedTrustContainer');
  const welcomeVerificationPill = document.getElementById('welcomeVerificationPill');
  const welcomeVerificationText = document.getElementById('welcomeVerificationText');

  const isIdVerified = user.isIdVerified === true || user.isIdVerified === 'true';
  const isPoliceVerified = user.isPoliceVerified === true || user.isPoliceVerified === 'true';
  const isFullyVerified = (status === 'verified') && isIdVerified && isPoliceVerified;

  if (isFullyVerified) {
    // ════════════════════════════════════════════════════════════════
    // VERIFIED VOLUNTEER STATE: Show all features, tasks, wallet, stats
    // ════════════════════════════════════════════════════════════════
    if (unverifiedTrustContainer) unverifiedTrustContainer.style.display = 'none';
    if (topMetricsGrid) topMetricsGrid.style.display = 'grid';
    if (volunteerWorkspaceGrid) volunteerWorkspaceGrid.style.display = 'grid';
    if (helperPerformanceSection) helperPerformanceSection.style.display = 'block';
    if (earningsWalletCard) earningsWalletCard.style.display = 'block';
    if (volunteerTaskGrid) volunteerTaskGrid.style.display = 'block';

    if (welcomeVerificationPill) {
      welcomeVerificationPill.className = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-xl border border-emerald-400/40 text-xs font-bold text-emerald-100 shadow-xs";
    }
    if (welcomeVerificationText) {
      welcomeVerificationText.textContent = "Community Volunteer — Verified";
    }

    if (kycStatusCard) kycStatusCard.style.display = 'none';

  } else {
    // ════════════════════════════════════════════════════════════════
    // UNVERIFIED STATE: ONLY show Multi-Level Trust & Verification section
    // Hide all requests, task workspace, wallet, top metrics, & performance
    // ════════════════════════════════════════════════════════════════
    if (topMetricsGrid) topMetricsGrid.style.display = 'none';
    if (volunteerWorkspaceGrid) volunteerWorkspaceGrid.style.display = 'none';
    if (helperPerformanceSection) helperPerformanceSection.style.display = 'none';
    if (earningsWalletCard) earningsWalletCard.style.display = 'none';
    if (unverifiedTrustContainer) unverifiedTrustContainer.style.display = 'block';

    if (welcomeVerificationPill) {
      welcomeVerificationPill.className = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 backdrop-blur-md rounded-xl border border-amber-400/40 text-xs font-bold text-amber-100 shadow-xs";
    }
    if (welcomeVerificationText) {
      welcomeVerificationText.textContent = "Community Volunteer — Pending Verification";
    }

    // Populate the 4 steps in the Unverified Spotlight
    const unverifiedStepGovtIdText = document.getElementById('unverifiedStepGovtIdText');
    const unverifiedStepGovtIdIcon = document.getElementById('unverifiedStepGovtIdIcon');
    const unverifiedStepSelfieText = document.getElementById('unverifiedStepSelfieText');
    const unverifiedStepSelfieIcon = document.getElementById('unverifiedStepSelfieIcon');
    const unverifiedStepPoliceText = document.getElementById('unverifiedStepPoliceText');
    const unverifiedStepPoliceIcon = document.getElementById('unverifiedStepPoliceIcon');
    const unverifiedAlertBanner = document.getElementById('unverifiedAlertBanner');
    const btnUnverifiedOpenKyc = document.getElementById('btnUnverifiedOpenKyc');
    const btnUnverifiedOpenKycText = document.getElementById('btnUnverifiedOpenKycText');

    const iconCheck = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';
    const iconClock = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    const iconAlert = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>';

    if (unverifiedStepGovtIdText) {
      if (isGovtIdVerified) {
        unverifiedStepGovtIdText.textContent = 'Verified';
        unverifiedStepGovtIdText.className = 'text-xs font-extrabold text-emerald-700 block';
        if (unverifiedStepGovtIdIcon) {
          unverifiedStepGovtIdIcon.innerHTML = iconCheck;
          unverifiedStepGovtIdIcon.className = 'w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      } else if (user.govtIdCard) {
        unverifiedStepGovtIdText.textContent = 'Submitted (Pending Review)';
        unverifiedStepGovtIdText.className = 'text-xs font-extrabold text-brand-700 block';
        if (unverifiedStepGovtIdIcon) {
          unverifiedStepGovtIdIcon.innerHTML = iconClock;
          unverifiedStepGovtIdIcon.className = 'w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      } else {
        unverifiedStepGovtIdText.textContent = 'Pending Upload';
        unverifiedStepGovtIdText.className = 'text-xs font-extrabold text-amber-700 block';
        if (unverifiedStepGovtIdIcon) {
          unverifiedStepGovtIdIcon.innerHTML = iconAlert;
          unverifiedStepGovtIdIcon.className = 'w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      }
    }

    if (unverifiedStepSelfieText) {
      if (isIdVerified) {
        unverifiedStepSelfieText.textContent = 'Verified';
        unverifiedStepSelfieText.className = 'text-xs font-extrabold text-emerald-700 block';
        if (unverifiedStepSelfieIcon) {
          unverifiedStepSelfieIcon.innerHTML = iconCheck;
          unverifiedStepSelfieIcon.className = 'w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      } else if (user.selfiePhoto) {
        unverifiedStepSelfieText.textContent = 'Submitted (Pending Review)';
        unverifiedStepSelfieText.className = 'text-xs font-extrabold text-brand-700 block';
        if (unverifiedStepSelfieIcon) {
          unverifiedStepSelfieIcon.innerHTML = iconClock;
          unverifiedStepSelfieIcon.className = 'w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      } else {
        unverifiedStepSelfieText.textContent = 'Pending Upload';
        unverifiedStepSelfieText.className = 'text-xs font-extrabold text-amber-700 block';
        if (unverifiedStepSelfieIcon) {
          unverifiedStepSelfieIcon.innerHTML = iconAlert;
          unverifiedStepSelfieIcon.className = 'w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      }
    }

    if (unverifiedStepPoliceText) {
      if (isPoliceVerified) {
        unverifiedStepPoliceText.textContent = 'Cleared & Verified';
        unverifiedStepPoliceText.className = 'text-xs font-extrabold text-emerald-700 block';
        if (unverifiedStepPoliceIcon) {
          unverifiedStepPoliceIcon.innerHTML = iconCheck;
          unverifiedStepPoliceIcon.className = 'w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      } else {
        unverifiedStepPoliceText.textContent = 'Pending Admin Clearance';
        unverifiedStepPoliceText.className = 'text-xs font-extrabold text-amber-700 block';
        if (unverifiedStepPoliceIcon) {
          unverifiedStepPoliceIcon.innerHTML = iconClock;
          unverifiedStepPoliceIcon.className = 'w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-xs';
        }
      }
    }

    if (unverifiedAlertBanner) {
      if (status === 'pending') {
        unverifiedAlertBanner.className = 'p-4 rounded-2xl bg-blue-50 border border-blue-200/80 text-xs font-semibold text-blue-900 leading-relaxed';
        unverifiedAlertBanner.innerHTML = `
          <div class="flex items-start gap-3">
            <span class="text-base">📋</span>
            <div>
              <strong class="font-extrabold text-blue-950 block text-sm mb-0.5">KYC Documents Submitted &amp; Pending Admin Clearance</strong>
              <span>Your National ID card and live selfie have been successfully uploaded. AgeWell Administrators are verifying your identity and police safety records. Once approved, all elder requests and your earnings wallet will unlock instantly.</span>
            </div>
          </div>
        `;
        if (btnUnverifiedOpenKycText) btnUnverifiedOpenKycText.textContent = 'Update / Replace Documents';
      } else if (status === 'rejected') {
        unverifiedAlertBanner.className = 'p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-xs font-semibold text-rose-900 leading-relaxed';
        const reason = user.verificationRejectionReason ? `<p class="mt-1 font-bold text-rose-800 bg-white/70 p-2 rounded-xl border border-rose-200">Admin Note: ${escapeHTML(user.verificationRejectionReason)}</p>` : '';
        unverifiedAlertBanner.innerHTML = `
          <div class="flex items-start gap-3">
            <span class="text-base">❌</span>
            <div>
              <strong class="font-extrabold text-rose-950 block text-sm mb-0.5">Verification Clarification Requested</strong>
              <span>Your submission requires document correction before your account can be cleared for elder visits.${reason}</span>
            </div>
          </div>
        `;
        if (btnUnverifiedOpenKycText) btnUnverifiedOpenKycText.textContent = 'Re-Submit Corrected Documents';
      } else {
        unverifiedAlertBanner.className = 'p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs font-semibold text-amber-900 leading-relaxed';
        unverifiedAlertBanner.innerHTML = `
          <div class="flex items-start gap-3">
            <span class="text-base">🛡️</span>
            <div>
              <strong class="font-extrabold text-amber-950 block text-sm mb-0.5">Identity Verification Required</strong>
              <span>To ensure complete elder safety, please upload a clear photo of your Government ID (Aadhaar / Passport / Voter ID) and a live selfie photo.</span>
            </div>
          </div>
        `;
        if (btnUnverifiedOpenKycText) btnUnverifiedOpenKycText.textContent = 'Upload KYC Documents Now';
      }
    }

    if (btnUnverifiedOpenKyc) {
      btnUnverifiedOpenKyc.onclick = () => {
        const modalAadhaarNumber = document.getElementById('modalAadhaarNumber');
        if (modalAadhaarNumber && currentVolunteerUser && currentVolunteerUser.aadhaarNumber) {
          modalAadhaarNumber.value = currentVolunteerUser.aadhaarNumber;
        }
        const kycModal = document.getElementById('kycModal');
        if (kycModal) kycModal.style.display = 'flex';
      };
    }
  }
}

// Volunteer opens quote modal to accept request and specify service charge
function acceptHelpRequest(id, title, pref = '', allowedBudget = null) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.verificationStatus !== 'verified') {
    showToast('Verification Clearance Required: You must complete KYC document submission and receive Admin & Police clearance before accepting requests.', 'error');
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
  const budgetContainer = document.getElementById('quoteModalBudgetContainer');
  const budgetText = document.getElementById('quoteModalBudgetText');

  if (titleEl && title) titleEl.textContent = title;
  if (feeInput) feeInput.value = '';
  if (notesInput) notesInput.value = '';

  const hasPref = (pref && pref.trim() && pref !== 'No Preference');
  const hasBudget = (allowedBudget !== null && allowedBudget !== undefined && !isNaN(Number(allowedBudget)) && Number(allowedBudget) > 0);

  if (prefText) prefText.textContent = hasPref ? pref.trim() : 'No specific preference';
  if (budgetText) budgetText.textContent = hasBudget ? `₹${allowedBudget}` : '';
  if (budgetContainer) budgetContainer.style.display = hasBudget ? 'flex' : 'none';

  if (prefContainer) {
    prefContainer.style.display = (hasPref || hasBudget) ? 'block' : 'none';
  }

  if (modal) modal.style.display = 'flex';
}



// Fetch and Render requests for Volunteers
async function loadVolunteerRequests(silent = false) {
  // Always sync latest verification profile & rating stats from backend
  const meRes = await apiCall('/auth/me', 'GET');
  if (meRes.ok && meRes.data && meRes.data.user) {
    currentVolunteerUser = meRes.data.user;
    localStorage.setItem('user', JSON.stringify(meRes.data.user));
    renderKycStatus(meRes.data.user);
    await renderRatingProfileCard(meRes.data.user);
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
    window.allVolunteerRequestsMap = {};
    if (requests && requests.length > 0) {
      requests.forEach(r => {
        if (r && r._id) window.allVolunteerRequestsMap[r._id] = r;
      });
    }
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

    const dismissedKey = currentUserId ? `dismissed_notifications_${currentUserId}` : 'dismissed_notifications';
    const dismissedList = JSON.parse(localStorage.getItem(dismissedKey) || '[]');

    // Split by status:
    // 0. Task Assignment Notifications: Requests where this volunteer submitted a quote, but caregiver selected another volunteer (excluding dismissed)
    const notifiedRequests  = requests.filter(r => (r.status === 'accepted' || r.status === 'completed') && hasMyQuote(r) && !isMyApprovedTask(r) && !dismissedList.includes(r._id));
    
    // Requests where this volunteer was allotted, but the senior cancelled
    const cancelledRequests = requests.filter(r => r.status === 'cancelled' && isMyApprovedTask(r) && !dismissedList.includes(r._id));
    
    const allNotifRequests = [...notifiedRequests, ...cancelledRequests];

    // 1. Available Help Requests: Open requests with status 'pending' or 'awaiting_approval'
    const pendingRequests   = requests.filter(r => r.status === 'pending' || r.status === 'awaiting_approval');
    // 2. Awaiting Family Approval: Requests where this volunteer submitted a quote and status is 'awaiting_approval'
    const awaitingRequests  = requests.filter(r => r.status === 'awaiting_approval' && hasMyQuote(r));
    // 3. Active Commitments: Requests assigned to this volunteer in any active escrow stage
    const activeRequests    = requests.filter(r => (r.status === 'accepted' || r.status === 'purchase_cost_submitted' || r.status === 'purchase_funded' || r.status === 'awaiting_verification' || r.status === 'in_progress') && isMyApprovedTask(r));
    // 4. Completed History: Tasks completed by this volunteer
    const completedRequests = requests.filter(r => r.status === 'completed' && isMyApprovedTask(r));

    // Save to window for tab switching and actions
    window.notifiedRequestIds = allNotifRequests.map(r => r._id);
    window.currentPendingRequests = pendingRequests;

    // Track seen help requests in localStorage per volunteer
    const seenKey = currentUserId ? `seen_pending_requests_${currentUserId}` : 'seen_pending_requests';
    let seenList = JSON.parse(localStorage.getItem(seenKey) || '[]');

    // If volunteer is currently on the 'Browse Requests' tab (default when viewing the portal), mark requests as seen
    const isViewingBrowseRequests = (window.currentVolunteerTab === 'pending' || !window.currentVolunteerTab);
    if (isViewingBrowseRequests && pendingRequests.length > 0) {
      pendingRequests.forEach(r => {
        const idStr = String(r._id || '');
        if (idStr && !seenList.includes(idStr)) seenList.push(idStr);
      });
      localStorage.setItem(seenKey, JSON.stringify(seenList));
    }

    // New unseen requests: requests that arrived that volunteer hasn't opened/seen yet and hasn't quoted on
    const newPendingActionCount = isViewingBrowseRequests 
      ? 0 
      : pendingRequests.filter(r => !seenList.includes(String(r._id)) && !hasMyQuote(r)).length;

    // Active tasks requiring action from volunteer:
    const activeActionRequiredCount = activeRequests.filter(r => r.status === 'accepted' || r.status === 'purchase_funded' || r.status === 'in_progress').length;

    // Update badge counts on tabs & top summary bar dynamically
    const elCountPending = document.getElementById('countPending');
    const elCountActive = document.getElementById('countActive');
    const elCountAwaiting = document.getElementById('countAwaiting');
    const elCountHistory = document.getElementById('countHistory');

    const elQuickPending = document.getElementById('countQuickPending');
    const elQuickActive = document.getElementById('countQuickActive');
    const elQuickCompleted = document.getElementById('countQuickCompleted');

    // Helper to format tab counter badges based on section state & actionNeeded
    function updateNavBadge(el, count, actionNeeded = false, isHistory = false) {
      if (!el) return;
      el.textContent = count;
      el.dataset.actionNeeded = actionNeeded ? "true" : "false";
      el.dataset.isHistory = isHistory ? "true" : "false";
      if (isHistory) {
        // Just reflect the number in a neutral slate pill, never blue, never blinking
        el.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
      } else if (actionNeeded && count > 0) {
        // Attention-grabbing blinking pulse animation ONLY when new unseen requests exist
        el.className = "bg-brand-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-xs badge-blink-active flex-shrink-0";
      } else if (count > 0) {
        // Once volunteer opens portal and sees the req / quotes -> calm neutral slate pill, NOT blue, NOT blinking
        el.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
      } else {
        el.className = "bg-slate-100 text-slate-400 text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0";
      }
    }

    updateNavBadge(elCountPending, pendingRequests.length, newPendingActionCount > 0, false);
    updateNavBadge(elCountActive, activeRequests.length, activeActionRequiredCount > 0, false);
    updateNavBadge(elCountAwaiting, awaitingRequests.length, false, false);
    updateNavBadge(elCountHistory, completedRequests.length, false, true);

    if (elQuickPending) elQuickPending.textContent = pendingRequests.length;
    if (elQuickActive) elQuickActive.textContent = activeRequests.length;
    if (elQuickCompleted) elQuickCompleted.textContent = completedRequests.length;

    // --- Render Task Notifications ---
    if (notificationsCard && notificationsList) {
      if (allNotifRequests.length > 0) {
        notificationsCard.style.display = 'block';
        notificationsList.innerHTML = allNotifRequests.map(req => {
          const seniorName = req.senior ? escapeHTML(req.senior.name) : 'Senior Citizen';

          if (req.status === 'cancelled') {
            return `
              <div class="bg-white rounded-2xl border border-rose-200/80 shadow-2xs p-4 relative overflow-hidden">
                <div class="h-1 bg-rose-500 -mx-4 -mt-4 mb-3"></div>
                <div class="flex justify-between items-start gap-3 flex-wrap mb-2">
                  <h4 class="text-sm font-extrabold text-rose-700 tracking-tight">${escapeHTML(req.title)}</h4>
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>
                    <button type="button" onclick="dismissTaskNotification('${req._id}')" class="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all cursor-pointer">Dismiss</button>
                  </div>
                </div>
                <div class="p-3 bg-rose-50/70 border border-rose-200/70 rounded-xl text-xs text-rose-900 font-medium">
                  The senior has cancelled this request. Help is no longer required. Thank you for offering support to <strong>${seniorName}</strong>!
                </div>
              </div>`;
          }

          return `
            <div class="bg-white rounded-2xl border border-brand-200/80 shadow-2xs p-4 relative overflow-hidden">
              <div class="h-1 bg-brand-500 -mx-4 -mt-4 mb-3"></div>
              <div class="flex justify-between items-start gap-3 flex-wrap mb-2">
                <h4 class="text-sm font-extrabold text-slate-900 tracking-tight">${escapeHTML(req.title)}</h4>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-brand-50 text-brand-700 border border-brand-200">Task Assigned</span>
                  <button type="button" onclick="dismissTaskNotification('${req._id}')" class="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all cursor-pointer">Dismiss</button>
                </div>
              </div>
              <div class="p-3 bg-brand-50/70 border border-brand-200/70 rounded-xl text-xs text-brand-950 font-medium">
                The caregiver has assigned this task to another volunteer. Thank you for your voluntary support to <strong>${seniorName}</strong>! You can browse other open requests below.
              </div>
            </div>`;
        }).join('');
      } else {
        notificationsCard.style.display = 'none';
      }
    }

    // Auto-switch to Active Tasks if volunteer has active tasks and 0 pending
    if (!window.hasInitializedDefaultTab) {
      window.hasInitializedDefaultTab = true;
      const urlParams = new URLSearchParams(window.location.search);
      const qTab = urlParams.get('tab');
      if (qTab && ['pending', 'active', 'awaiting', 'history'].includes(qTab)) {
        switchTaskTab(qTab);
      } else if (activeRequests.length > 0 && pendingRequests.length === 0) {
        switchTaskTab('active');
      }
    }

    // --- Render Available (Pending) Requests ---
    if (pendingList) {
      const activeNoticeBanner = (activeRequests.length > 0)
        ? `
          <div class="mb-4 p-4 bg-emerald-50/90 border-2 border-emerald-300 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center flex-shrink-0 font-extrabold shadow-2xs">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div>
                <span class="text-sm font-extrabold text-emerald-950 block">You have ${activeRequests.length} Active Assigned Task${activeRequests.length > 1 ? 's' : ''}!</span>
                <span class="text-xs text-emerald-800 font-medium">Caregiver has approved and assigned ${activeRequests.map(r => `<strong>"${escapeHTML(r.title)}"</strong>`).join(', ')} to you.</span>
              </div>
            </div>
            <button type="button" onclick="switchTaskTab('active')" class="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 border-none cursor-pointer flex items-center justify-center gap-1.5 flex-shrink-0">
              <span>Open Active Tasks (${activeRequests.length})</span>
              <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>`
        : '';

      if (pendingRequests.length === 0) {
        pendingList.innerHTML = activeNoticeBanner + `
          <div class="bg-brand-50/50 border-2 border-dashed border-brand-200 rounded-3xl p-8 text-center space-y-2">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-brand-100/80 text-brand-700 flex items-center justify-center shadow-xs">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p class="text-base font-extrabold text-brand-950" data-i18n="vd_no_pending">No pending help requests at this time.</p>
            <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">Check back later to support Senior Citizens in your neighborhood!</p>
          </div>`;
      } else {
        pendingList.innerHTML = activeNoticeBanner + pendingRequests.map(req => {
          const urgencyBadge = req.urgency === 'emergency'
            ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-extrabold tracking-wide shadow-2xs whitespace-nowrap">
                 <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                 Emergency
               </span>`
            : req.urgency === 'high'
              ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold tracking-wide shadow-2xs whitespace-nowrap">
                   <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                   High Priority
                 </span>`
              : `<span class="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200/80 rounded-full text-xs font-bold shadow-2xs whitespace-nowrap">
                   Normal
                 </span>`;

          const categoryBadge = getCategoryBadgeHtml(req.category);
          const voiceNoteHtml = getVoiceNotePlayerHtml(req.audioFile);
          const prefHtml = getShoppingPreferenceHtml(req.shoppingPreference);
          const budgetHtml = getAllowedBudgetHtml(req.allowedBudget, req.fundingMode);

          let existingQuoteBadge = '';
          let myQuote = null;
          let otherQuote = null;

          if (req.volunteerQuotes && req.volunteerQuotes.length > 0) {
            myQuote = req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === String(currentUserId));
            otherQuote = req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) !== String(currentUserId));
          }

          if (myQuote) {
            const feeStr = (myQuote.serviceFee !== undefined && myQuote.serviceFee > 0) ? `₹${myQuote.serviceFee}` : '₹0 (Voluntary)';
            existingQuoteBadge = `
              <div class="mb-4 p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  </div>
                  <span><strong>Your Quote Submitted:</strong> <strong class="text-emerald-700 font-extrabold text-sm">${feeStr}</strong> (Awaiting Caregiver Selection)</span>
                </div>
              </div>`;
          } else if (otherQuote) {
            const feeStr = (otherQuote.serviceFee !== undefined && otherQuote.serviceFee > 0) ? `₹${otherQuote.serviceFee}` : '₹0 (Voluntary)';
            const countStr = req.volunteerQuotes.length > 1 ? ` (${req.volunteerQuotes.length} quotes submitted)` : '';
            existingQuoteBadge = `
              <div class="mb-4 p-3 bg-brand-50/80 border border-brand-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-brand-950 shadow-2xs">
                <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                <span>A volunteer quoted <strong>${feeStr}</strong>${countStr}. You can also submit your voluntary quote!</span>
              </div>`;
          }

          const btnText = myQuote ? 'Update Your Quote' : 'Quote Fee & Volunteer';

          return `
            <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 transition-all relative overflow-hidden group" id="reqCard-${req._id}">
              <!-- Top accent gradient line -->
              <div class="h-1.5 bg-gradient-to-r from-brand-500 to-brand-600 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

              <!-- Header: Title, Category & Date + Badges -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100 mb-4">
                <div class="space-y-2 flex-1 min-w-0">
                  <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-brand-700 transition-colors">${escapeHTML(req.title)}</h3>
                  <div class="flex items-center gap-2.5 text-xs font-semibold text-slate-500 flex-wrap">
                    ${categoryBadge}
                    <span class="inline-flex items-center gap-1.5 text-slate-400 font-medium pl-1">
                      <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span>${new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 sm:self-center flex-wrap">
                  ${urgencyBadge}
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">
                    <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                    Seeking Volunteers
                  </span>
                </div>
              </div>

              <!-- Description -->
              ${req.description && req.description !== req.title ? `
                <div class="text-sm font-medium text-slate-700 leading-relaxed mb-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100">
                  ${escapeHTML(req.description)}
                </div>` : ''}

              ${voiceNoteHtml}
              ${prefHtml}
              ${budgetHtml}
              ${existingQuoteBadge}
              ${renderPlatformHelperHtml(req)}

              <!-- Action Area -->
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 flex-wrap gap-3">
                <div class="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <svg class="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>Free or Quoted Service Assistance</span>
                </div>
                <button
                  type="button"
                  onclick="acceptHelpRequest('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', '${escapeHTML(req.shoppingPreference || 'No Preference').replace(/'/g, "\\'")}', ${req.allowedBudget || 'null'})"
                  class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 border-none cursor-pointer"
                >
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>${btnText}</span>
                </button>
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Awaiting Family Approval ---
    if (awaitingList) {
      if (awaitingRequests.length === 0) {
        awaitingList.innerHTML = `
          <div class="bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-3xl p-8 text-center space-y-2">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center shadow-xs">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p class="text-base font-extrabold text-amber-950" data-i18n="vd_no_awaiting">No tasks currently awaiting family approval.</p>
            <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">When you quote to help, the family reviews your profile and fee quote here.</p>
          </div>`;
      } else {
        awaitingList.innerHTML = awaitingRequests.map(req => {
          const categoryBadge = getCategoryBadgeHtml(req.category);
          const prefHtml = getShoppingPreferenceHtml(req.shoppingPreference);
          const budgetHtml = getAllowedBudgetHtml(req.allowedBudget, req.fundingMode);
          const voiceNoteHtml = getVoiceNotePlayerHtml(req.audioFile);

          let quotedFee = 0;
          const currentVolUser = JSON.parse(localStorage.getItem('user') || '{}');
          const myVolId = currentVolUser._id || currentVolUser.id;

          if (req.volunteerQuotes && req.volunteerQuotes.length > 0 && myVolId) {
            const match = req.volunteerQuotes.find(q => {
              const vId = q.volunteer ? (typeof q.volunteer === 'object' ? (q.volunteer._id || q.volunteer.id) : q.volunteer) : null;
              return String(vId) === String(myVolId);
            });
            if (match) {
              quotedFee = Number(match.serviceFee || 0);
            }
          }

          if (quotedFee === 0 && req.serviceFee !== undefined && req.serviceFee !== null && Number(req.serviceFee) > 0) {
            quotedFee = Number(req.serviceFee);
          }

          return `
            <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 transition-all relative overflow-hidden group">
              <div class="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

              <!-- Header -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100 mb-4">
                <div class="space-y-2 flex-1 min-w-0">
                  <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">${escapeHTML(req.title)}</h3>
                  <div class="flex items-center gap-2.5 text-xs font-semibold text-slate-500 flex-wrap">
                    ${categoryBadge}
                    <span class="inline-flex items-center gap-1.5 text-slate-400 font-medium pl-1">
                      <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span>${new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 sm:self-center">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Awaiting Caregiver Selection
                  </span>
                </div>
              </div>

              ${req.description ? `<div class="text-sm font-medium text-slate-700 leading-relaxed mb-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100">${escapeHTML(req.description)}</div>` : ''}
              ${voiceNoteHtml}
              ${prefHtml}
              ${budgetHtml}

              <!-- Your Quoted Fee Strip -->
              <div class="flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-50/80 via-amber-50/50 to-orange-50/40 border border-amber-200/90 rounded-2xl mb-4 shadow-2xs">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-800 flex items-center justify-center flex-shrink-0 font-black text-base shadow-2xs">
                    ₹
                  </div>
                  <div>
                    <span class="text-[11px] font-bold text-amber-900/70 uppercase tracking-wider block">Your Quoted Service Charge</span>
                    <span class="text-lg font-black text-slate-900 leading-tight">₹${quotedFee}</span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-800 rounded-xl text-xs font-extrabold shadow-2xs">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Under Review
                  </span>
                </div>
              </div>

              <!-- Notice card -->
              <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 space-y-1">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <p><strong>Senior:</strong> ${req.senior ? escapeHTML(req.senior.name) : 'Senior Citizen'}</p>
                </div>
                <p class="text-[11px] text-slate-500 font-medium leading-normal">The family caregiver has been notified to review your quote of <strong>₹${quotedFee}</strong>. Once approved, the task moves to your active commitments.</p>
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Active Commitments (Accepted) ---
    if (activeList) {
      if (activeRequests.length === 0) {
        activeList.innerHTML = `
          <div class="bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-3xl p-8 text-center space-y-2">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shadow-xs">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p class="text-base font-extrabold text-emerald-950" data-i18n="vd_no_active">You have no active help commitments right now.</p>
            <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">Browse open requests and quote your fee to start helping!</p>
          </div>`;
      } else {
        activeList.innerHTML = activeRequests.map(req => {
          let seniorName    = req.senior ? req.senior.name : 'Senior Citizen';
          let seniorPhone   = req.senior ? req.senior.phone : 'Not provided';
          let seniorAddress = req.senior ? req.senior.address : 'Not provided';
          let emergencyContact = req.senior ? req.senior.emergencyContact : 'Not provided';

          let myQuotedFee = (req.serviceFee !== undefined && req.serviceFee !== null && Number(req.serviceFee) > 0) ? Number(req.serviceFee) : 0;
          if (myQuotedFee === 0 && req.volunteerQuotes && req.volunteerQuotes.length > 0) {
            const currentVolUser = JSON.parse(localStorage.getItem('user') || '{}');
            const myVolId = currentVolUser._id || currentVolUser.id;
            let match = null;
            if (myVolId) {
              match = req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === String(myVolId));
            }
            if (!match) match = req.volunteerQuotes[0];
            if (match && match.serviceFee) myQuotedFee = Number(match.serviceFee);
          }

          const isRejected = req.completionVerified === 'rejected';

          let rejectionWarningBox = '';
          if (isRejected) {
            rejectionWarningBox = `
              <div class="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 font-semibold shadow-2xs">
                <p class="font-bold text-rose-800 mb-1">Delivery Proof Rejected by Caregiver</p>
                <p class="font-medium text-rose-700"><strong>Reason:</strong> "${escapeHTML(req.verificationRejectionReason || 'Caregiver requested updated receipt or delivery photo proof.')}"</p>
                <p class="text-slate-500 font-normal mt-1">Please re-upload a clear store receipt or delivery photo proof.</p>
              </div>`;
          }

          if (req.purchaseRejectionReason && req.status === 'accepted') {
            rejectionWarningBox += `
              <div class="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-semibold shadow-2xs">
                <p class="font-bold text-amber-800 mb-1">Caregiver Requested Revision on Purchase Cost</p>
                <p class="font-medium text-amber-700"><strong>Caregiver Note:</strong> "${escapeHTML(req.purchaseRejectionReason)}"</p>
                <p class="text-slate-500 font-normal mt-1">Please adjust your purchase details and re-submit below.</p>
              </div>`;
          }

          let stepBoxHtml = '';
          let actionBtnHtml = '';

          // ── Proof Hierarchy: derive which flow this task follows ──────────────
          const proofType = req.taskProofType || (
            req.category === 'Grocery Shopping' ? 'financial' :
            (req.category === 'Tech Support' || req.category === 'Housekeeping' || req.category === 'Companionship') ? 'service_only' : 'mixed'
          );
          const isServiceOnly = proofType === 'service_only';
          const isFinancial   = proofType === 'financial';
          const isMixed       = proofType === 'mixed';

          // Proof type badge for task card header context
          const proofBadge = isServiceOnly
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">✓ Service Task</span>`
            : isFinancial
              ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">🧾 Bill Required</span>`
              : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">❓ Purchase Optional</span>`;

          if (isServiceOnly) {
            // ── SERVICE-ONLY: ALWAYS pure service UI (no bill, no merchant payment, no budget) ──
            if (req.status === 'awaiting_verification') {
              stepBoxHtml = `
                <div class="mb-4 p-3.5 bg-teal-50/80 border border-teal-200/80 rounded-2xl text-xs text-teal-950 font-medium">
                  <strong>Task Completion Awaiting Confirmation</strong><br/>
                  The senior or their caregiver will confirm that the service was performed to release your service charge.
                </div>`;
              actionBtnHtml = `
                <div class="inline-flex items-center justify-center px-4 py-2.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-2xl text-xs font-extrabold select-none">
                  Awaiting Confirmation
                </div>`;
            } else {
              stepBoxHtml = `
                <div class="mb-4 p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-2xl text-xs text-teal-950 font-medium">
                  <strong>Service Task — No Purchase Required</strong><br/>
                  Perform the requested service for the senior, then mark it as done. No bill or receipt needed.
                </div>`;
              actionBtnHtml = `
                <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openMarkDoneModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', 'service_only')">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>Mark Task Done</span>
                </button>`;
            }
          } else if (req.status === 'accepted') {
            if (req.fundingMode === 'pre_fund') {
              // ── PRE-FUNDED: Volunteer can make direct merchant payments within assigned budget ──
              const authorizedBudget = Number(req.allowedBudget || 0);
              let totalSpent = 0;
              if (req.merchantPurchases && req.merchantPurchases.length > 0) {
                totalSpent = req.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
              } else if (req.fundingMode !== 'pre_fund' && req.actualPurchaseCost && Number(req.actualPurchaseCost) > 0) {
                totalSpent = Number(req.actualPurchaseCost);
              }
              const remainingBudget = authorizedBudget > 0 ? Math.max(0, authorizedBudget - totalSpent) : 0;

              let purchasesHistoryHtml = '';
              if (req.merchantPurchases && req.merchantPurchases.length > 0) {
                purchasesHistoryHtml = `
                  <div class="mt-2 pt-2 border-t border-emerald-200/80 space-y-1.5">
                    <span class="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider block">Merchant Payments Made:</span>
                    <div class="space-y-1">
                      ${req.merchantPurchases.map(p => `
                        <div class="flex items-center justify-between text-xs bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-200">
                          <span class="font-bold text-slate-800">✅ <strong>₹${p.amount}</strong> paid to ${escapeHTML(p.merchant || 'Store')}</span>
                          <span class="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Mock Gateway</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>`;
              }

              stepBoxHtml = `
                <div class="mb-4 p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl text-xs text-emerald-950 font-medium space-y-3">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center gap-1.5 font-extrabold text-emerald-900">
                      <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
                      <span>Pre-Funded Budget Authorized</span>
                    </div>
                    <span class="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">Escrow Active</span>
                  </div>

                  <!-- Financial Ledger Strip (Authorized, Spent, Remaining) -->
                  <div class="grid grid-cols-3 gap-2.5 text-center">
                    <div class="p-2 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Authorized</span>
                      <span class="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">₹${authorizedBudget}</span>
                    </div>
                    <div class="p-2 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Spent</span>
                      <span class="text-xs sm:text-sm font-black text-amber-700 block mt-0.5">₹${totalSpent}</span>
                    </div>
                    <div class="p-2 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Remaining</span>
                      <span class="text-xs sm:text-sm font-black text-emerald-700 block mt-0.5">₹${remainingBudget}</span>
                    </div>
                  </div>

                  ${purchasesHistoryHtml}
                </div>`;

              actionBtnHtml = `
                <div class="flex items-center gap-2 flex-wrap">
                  <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openVolunteerPayPurchaseModal('${req._id}')">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
                    <span>Pay for Purchase</span>
                  </button>
                  <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openCompletionModal('${req._id}')">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Upload Proof &amp; Complete</span>
                  </button>
                </div>`;
            } else if (isMixed) {
              // ── MIXED / CAREGIVER DIRECT: volunteer declares if a purchase was made ───
              stepBoxHtml = `
                <div class="mb-4 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs text-blue-950 font-medium">
                  <strong>Caregiver Direct Approval: Did this task involve purchasing anything?</strong><br/>
                  If you bought items, submit the purchase cost + store payment info first and wait for caregiver payment approval. Otherwise, mark it done.
                </div>`;
              actionBtnHtml = `
                <div class="flex flex-wrap gap-2">
                  <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openPurchaseCostModal('${req._id}')">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <span>Submit Store Bill &amp; Payment Info</span>
                  </button>
                  <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openMarkDoneModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', '${proofType}')">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Mark Done (No Purchase Needed)</span>
                  </button>
                </div>`;
            } else {
              // ── FINANCIAL / CAREGIVER DIRECT: Volunteer submits cost and waits for caregiver payment approval ───
              stepBoxHtml = `
                <div class="mb-4 p-3.5 bg-brand-50/70 border border-brand-200/80 rounded-2xl text-xs text-brand-950 font-medium">
                  <strong>Caregiver Direct Payment:</strong> Submit actual purchase details &amp; store bill first, and wait for caregiver payment approval before final delivery.
                </div>`;
              actionBtnHtml = `
                <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openPurchaseCostModal('${req._id}')">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span>Submit Store Bill &amp; Payment Info</span>
                </button>`;
            }
          } else if (req.status === 'purchase_cost_submitted') {
            let proofImages = req.purchaseProofDocs && req.purchaseProofDocs.length > 0 
              ? req.purchaseProofDocs 
              : (req.purchaseProofDoc ? [req.purchaseProofDoc] : []);
            let proofSlider = renderProofSliderHtml(req._id, proofImages);

            const shopName = req.merchantDetails?.shopName || 'Merchant / Shop';
            stepBoxHtml = `
              <div class="mb-4 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-950 font-medium space-y-1.5">
                <div class="flex items-center justify-between">
                  <strong class="font-extrabold text-amber-900">Direct Merchant Payment Pending: ₹${req.actualPurchaseCost || 0}</strong>
                  <span class="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">${escapeHTML(shopName)}</span>
                </div>
                <p class="text-slate-700">Waiting for caregiver to pay the merchant directly via UPI QR / Payment Link. Once paid, you will be notified to collect the items!</p>
                ${proofSlider}
              </div>`;
            actionBtnHtml = `
              <div class="inline-flex items-center justify-center px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-extrabold select-none">
                Waiting for Caregiver to Pay Merchant
              </div>`;
          } else if (req.status === 'purchase_funded' || req.status === 'in_progress') {
            const isPreFund = (req.fundingMode === 'pre_fund');
            
            if (isPreFund) {
              const authorizedBudget = Number(req.allowedBudget || 0);
              let totalSpent = 0;
              if (req.merchantPurchases && req.merchantPurchases.length > 0) {
                totalSpent = req.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
              } else if (req.fundingMode !== 'pre_fund' && req.actualPurchaseCost && Number(req.actualPurchaseCost) > 0) {
                totalSpent = Number(req.actualPurchaseCost);
              }
              const remainingBudget = authorizedBudget > 0 ? Math.max(0, authorizedBudget - totalSpent) : 0;

              let purchasesHistoryHtml = '';
              if (req.merchantPurchases && req.merchantPurchases.length > 0) {
                purchasesHistoryHtml = `
                  <div class="mt-2 pt-2 border-t border-emerald-200/80 space-y-1.5">
                    <span class="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider block">Merchant Payments Made:</span>
                    <div class="space-y-1">
                      ${req.merchantPurchases.map(p => `
                        <div class="flex items-center justify-between text-xs bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-200">
                          <span class="font-bold text-slate-800">✅ <strong>₹${p.amount}</strong> paid to ${escapeHTML(p.merchant || 'Store')}</span>
                          <span class="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Mock Gateway</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>`;
              }

              stepBoxHtml = `
                <div class="mb-4 p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl text-xs text-emerald-950 font-medium space-y-3">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center gap-1.5 font-extrabold text-emerald-900">
                      <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
                      <span>Pre-Funded Budget Authorized</span>
                    </div>
                    <span class="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">Escrow Active</span>
                  </div>

                  <!-- Financial Ledger Strip (Authorized, Spent, Remaining) -->
                  <div class="grid grid-cols-3 gap-2.5 text-center">
                    <div class="p-2 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Authorized</span>
                      <span class="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">₹${authorizedBudget}</span>
                    </div>
                    <div class="p-2 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Spent</span>
                      <span class="text-xs sm:text-sm font-black text-amber-700 block mt-0.5">₹${totalSpent}</span>
                    </div>
                    <div class="p-2 bg-white rounded-xl border border-emerald-200/90 shadow-2xs">
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Remaining</span>
                      <span class="text-xs sm:text-sm font-black text-emerald-700 block mt-0.5">₹${remainingBudget}</span>
                    </div>
                  </div>

                  ${purchasesHistoryHtml}
                </div>`;

              actionBtnHtml = `
                <div class="flex items-center gap-2 flex-wrap">
                  <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openVolunteerPayPurchaseModal('${req._id}')">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
                    <span>Pay for Purchase</span>
                  </button>
                  <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openCompletionModal('${req._id}')">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Upload Proof &amp; Complete</span>
                  </button>
                </div>`;
            } else {
              const shopName = req.merchantDetails?.shopName || 'Merchant / Shop';
              stepBoxHtml = `
                <div class="mb-4 p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-xs text-emerald-950 font-medium space-y-1">
                  <div class="flex items-center gap-1.5 font-extrabold text-emerald-900">
                    <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Merchant Payment Confirmed: ₹${req.actualPurchaseCost || 0} Paid to ${escapeHTML(shopName)}</span>
                  </div>
                  <p class="text-slate-700">Caregiver has completed payment to the store. Collect the items from the merchant and deliver to <strong>${escapeHTML(seniorName)}</strong>. Upload delivery proof when done!</p>
                </div>`;
              actionBtnHtml = `
                <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openCompletionModal('${req._id}')">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>Upload Delivery Proof &amp; Complete</span>
                </button>`;
            }
          } else if (req.status === 'awaiting_verification') {
            const isServiceOnlyVerif = proofType === 'service_only' || (proofType === 'mixed' && !req.volunteerDeclaredPurchase);
            stepBoxHtml = `
              <div class="mb-4 p-3.5 ${isServiceOnlyVerif ? 'bg-teal-50/80 border-teal-200/80' : 'bg-purple-50/80 border-purple-200/80'} border rounded-2xl text-xs ${isServiceOnlyVerif ? 'text-teal-950' : 'text-purple-950'} font-medium">
                <strong>${isServiceOnlyVerif ? 'Task Completion Awaiting Confirmation' : 'Store Bill &amp; Delivery Proof Uploaded'}</strong><br/>
                ${isServiceOnlyVerif
                  ? 'The senior or their caregiver will confirm that the service was performed.'
                  : `Awaiting Caregiver Final Verification &amp; Service Charge (₹${myQuotedFee > 0 ? myQuotedFee : 150}) Escrow Release.`}
              </div>`;
            actionBtnHtml = `
              <div class="inline-flex items-center justify-center px-4 py-2.5 ${isServiceOnlyVerif ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-purple-50 text-purple-800 border-purple-200'} border rounded-2xl text-xs font-extrabold select-none">
                ${isServiceOnlyVerif ? 'Awaiting Confirmation' : 'Verification Pending'}
              </div>`;
          } else {
            actionBtnHtml = `
              <button class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 border-none cursor-pointer" onclick="openCompletionModal('${req._id}')">
                <span>${isRejected ? 'Re-upload & Re-apply' : 'Complete & Upload Proof'}</span>
              </button>`;
          }

          const categoryBadge = getCategoryBadgeHtml(req.category);
          const voiceNoteHtml = getVoiceNotePlayerHtml(req.audioFile);
          const prefHtml = getShoppingPreferenceHtml(req.shoppingPreference);
          const budgetHtml = getAllowedBudgetHtml(req.allowedBudget, req.fundingMode);

          return `
            <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 transition-all relative overflow-hidden group ${isRejected ? 'border-rose-200' : ''}">
              <div class="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

              <!-- Header -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100 mb-4">
                <div class="space-y-2 flex-1 min-w-0">
                  <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">${escapeHTML(req.title)}</h3>
                  <div class="flex items-center gap-2.5 text-xs font-semibold text-slate-500 flex-wrap">
                    ${categoryBadge}
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Quoted Fee: ₹${myQuotedFee > 0 ? myQuotedFee : '0 (Free)'}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 sm:self-center">
                  <span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Task In Progress
                  </span>
                </div>
              </div>

              ${req.description ? `<div class="text-sm font-medium text-slate-700 leading-relaxed mb-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100">${escapeHTML(req.description)}</div>` : ''}

              <!-- Senior Contact Card -->
              <div class="rounded-2xl p-4 bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1.5 mb-4 shadow-2xs">
                <div class="flex items-center justify-between pb-1.5 border-b border-slate-200/60 font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  <span>Senior Citizen Details</span>
                </div>
                <p><strong>Name:</strong> ${escapeHTML(seniorName)}</p>
                <p><strong>Phone:</strong> <a href="tel:${seniorPhone}" class="text-brand-600 font-bold hover:underline">${escapeHTML(seniorPhone)}</a></p>
                <p><strong>Address:</strong> ${escapeHTML(seniorAddress)}</p>
                ${emergencyContact ? `<p class="text-slate-500"><strong>Emergency Contact:</strong> ${escapeHTML(emergencyContact)}</p>` : ''}
              </div>

              ${voiceNoteHtml}
              ${prefHtml}
              ${rejectionWarningBox}
              ${stepBoxHtml}
              ${renderPlatformHelperHtml(req)}

              <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 flex-wrap gap-3">
                <span class="text-xs text-slate-400 font-medium">Accepted: ${new Date(req.acceptedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                ${actionBtnHtml}
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Service History (Completed Tasks with Verification Status) ---
    if (historyList) {
      if (completedRequests.length === 0) {
        historyList.innerHTML = `
          <div class="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-2">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-xs">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p class="text-base font-extrabold text-slate-900" data-i18n="vd_no_history">No completed requests logged yet.</p>
            <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">Your verified completions and caregiver ratings will appear here.</p>
          </div>`;
      } else {
        historyList.innerHTML = completedRequests.map(req => {
          const voiceNoteHtml = getVoiceNotePlayerHtml(req.audioFile);
          const categoryBadge = getCategoryBadgeHtml(req.category);

          const serviceFeeEarned = Number((req.serviceFee !== undefined && req.serviceFee !== null)
            ? req.serviceFee
            : ((req.volunteerQuotes && req.volunteerQuotes[0] && req.volunteerQuotes[0].serviceFee !== undefined)
              ? req.volunteerQuotes[0].serviceFee
              : (req.paymentDetails ? req.paymentDetails.volunteerFee : 0))) || 0;

          const tipEarned = Number(req.tipAmount || (req.paymentDetails ? req.paymentDetails.tipAmount : 0) || (req.tipPaymentDetails ? req.tipPaymentDetails.amountPaid : 0)) || 0;
          const totalEarned = serviceFeeEarned + tipEarned;

          let earningsHtml = `
            <div class="mb-4 p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl shadow-2xs">
              <div class="flex justify-between items-center flex-wrap gap-2">
                <span class="text-xs font-bold text-emerald-950">
                  Total Earned: <strong class="text-sm font-extrabold text-emerald-700">₹${totalEarned}</strong>
                </span>
                ${tipEarned > 0 ? `
                  <button type="button" onclick="showTipEarnedModal('${escapeHTML(req.title).replace(/'/g, "\\'")}', ${tipEarned}, ${serviceFeeEarned})" class="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-full font-extrabold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1">
                    Bonus Tip: ₹${tipEarned}
                  </button>` : ''}
              </div>
              <div class="text-[11px] text-emerald-700 font-semibold mt-1">
                Breakdown: Service Charge ₹${serviceFeeEarned} ${tipEarned > 0 ? `+ Caregiver Tip ₹${tipEarned}` : ''}
              </div>
            </div>`;

          let proofHtml = req.completionProof ? `
            <div class="mb-4 p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl">
              <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
                <label class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Uploaded Proof:</label>
                <button type="button" onclick="openImageLightbox('${escapeHTML(req.completionProof)}')" class="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-all">View Photo</button>
              </div>
              <img src="${escapeHTML(req.completionProof)}" alt="Receipt Photo Proof" onclick="openImageLightbox('${escapeHTML(req.completionProof)}')" class="max-w-full max-h-[140px] rounded-xl block object-contain cursor-pointer mx-auto border border-slate-200">
            </div>` : '';

          let verifyBadge = '';
          let reapplyButtonHtml = '';
          let rejectionReasonAlert = '';

          if (req.completionVerified === 'verified') {
            verifyBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              Verified &amp; Paid
            </span>`;
          } else if (req.completionVerified === 'rejected') {
            verifyBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">Rejected</span>`;
            
            rejectionReasonAlert = `
              <div class="mb-4 p-3 bg-rose-50/70 border border-rose-200 rounded-2xl text-xs text-rose-900 font-semibold">
                <p class="font-bold text-rose-800 mb-0.5">Verification Rejected</p>
                <p class="font-medium text-rose-700"><strong>Reason:</strong> "${escapeHTML(req.verificationRejectionReason || 'Updated receipt proof needed.')}"</p>
              </div>`;

            reapplyButtonHtml = `
              <button class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer shadow-xs border-none" onclick="openCompletionModal('${req._id}')">
                Re-apply Completion
              </button>`;
          } else {
            verifyBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">Pending Verification</span>`;
          }

          return `
            <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 transition-all relative overflow-hidden group">
              <div class="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

              <!-- Header -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100 mb-4">
                <div class="space-y-2 flex-1 min-w-0">
                  <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">${escapeHTML(req.title)}</h3>
                  <div class="flex items-center gap-2.5 text-xs font-semibold text-slate-500 flex-wrap">
                    ${categoryBadge}
                    <span class="inline-flex items-center gap-1.5 text-slate-400 font-medium pl-1">
                      <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span>Completed ${new Date(req.completedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 sm:self-center">
                  ${verifyBadge}
                </div>
              </div>

              ${req.description ? `<div class="text-sm font-medium text-slate-700 leading-relaxed mb-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100">${escapeHTML(req.description)}</div>` : ''}
              ${voiceNoteHtml}
              ${proofHtml}
              ${rejectionReasonAlert}

              <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-1 mb-4">
                <p><strong>Senior Assisted:</strong> ${req.senior ? escapeHTML(req.senior.name) : 'Senior Citizen'}</p>
                <p><strong>Completion Summary:</strong> ${escapeHTML(req.resolutionNotes || 'Task completed successfully.')}</p>
              </div>

              ${earningsHtml}

              ${req.feedback ? `
                <div class="mb-4 p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
                  <div class="font-extrabold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-amber-500 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    Caregiver Feedback &amp; Rating Review
                  </div>
                  <div class="flex gap-3 flex-wrap text-xs text-slate-700">
                    <span>Cost: <strong class="text-amber-800">${req.feedback.costUtilization}/5</strong></span>
                    <span>Speed: <strong class="text-amber-800">${req.feedback.speedTimeliness}/5</strong></span>
                    <span>Kindness: <strong class="text-amber-800">${req.feedback.communication}/5</strong></span>
                    <span>Recommend: <strong class="text-emerald-700">${escapeHTML(req.feedback.chooseAgain)}</strong></span>
                  </div>
                  ${req.feedback.additionalFeedback ? `<p class="text-xs text-slate-600 italic bg-white p-2.5 rounded-xl border border-amber-200/60 mt-1">"${escapeHTML(req.feedback.additionalFeedback)}"</p>` : ''}
                </div>` : ''}

              ${reapplyButtonHtml}
            </div>`;
        }).join('');
      }
    }

    // Refresh volunteer earnings wallet silently to match loaded active/service history
    await loadVolunteerEarnings(true);
  } else {
    alert("Error loading requests data");
  }
}

// Helper functions for Category Badges, Shopping Preferences and Voice Note Player
function getCategoryBadgeHtml(category) {
  const cat = (category || 'other').toLowerCase();
  if (cat.includes('grocery') || cat.includes('shopping')) {
    return `<span class="inline-flex items-center gap-1.5 text-amber-700 font-bold bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-xl">
      <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.263-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
      <span>Grocery Shopping</span>
    </span>`;
  }
  if (cat.includes('med') || cat.includes('doctor') || cat.includes('health') || cat.includes('escort')) {
    return `<span class="inline-flex items-center gap-1.5 text-rose-700 font-bold bg-rose-50 border border-rose-200/60 px-2.5 py-0.5 rounded-xl">
      <svg class="w-3.5 h-3.5 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
      <span>Medical Escort</span>
    </span>`;
  }
  if (cat.includes('tech') || cat.includes('mobile') || cat.includes('phone') || cat.includes('support')) {
    return `<span class="inline-flex items-center gap-1.5 text-blue-700 font-bold bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-xl">
      <svg class="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>
      <span>Tech Support</span>
    </span>`;
  }
  if (cat.includes('clean') || cat.includes('house') || cat.includes('maid')) {
    return `<span class="inline-flex items-center gap-1.5 text-teal-700 font-bold bg-teal-50 border border-teal-200/60 px-2.5 py-0.5 rounded-xl">
      <svg class="w-3.5 h-3.5 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>
      <span>Housekeeping</span>
    </span>`;
  }
  if (cat.includes('companion') || cat.includes('talk') || cat.includes('chat') || cat.includes('social')) {
    return `<span class="inline-flex items-center gap-1.5 text-purple-700 font-bold bg-purple-50 border border-purple-200/60 px-2.5 py-0.5 rounded-xl">
      <svg class="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
      <span>Companionship</span>
    </span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 text-slate-700 font-bold bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-xl">
    <svg class="w-3.5 h-3.5 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/></svg>
    <span>${escapeHTML(category || 'Assistance')}</span>
  </span>`;
}

function getShoppingPreferenceHtml(pref) {
  if (!pref || !pref.trim()) return '';
  return `
    <div class="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-3 mb-3.5 flex items-center gap-2.5 text-xs text-amber-950 shadow-2xs">
      <div class="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.263-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <strong class="font-bold text-amber-900">Caregiver Preference:</strong>
        <span class="font-medium text-amber-800">${escapeHTML(pref.trim())}</span>
      </div>
    </div>`;
}

function getAllowedBudgetHtml(budget) {
  if (budget === undefined || budget === null || isNaN(Number(budget)) || Number(budget) <= 0) return '';

  return `
    <div class="bg-emerald-50/80 border border-emerald-200/70 rounded-2xl p-3 mb-3.5 flex items-center justify-between gap-2.5 text-xs text-emerald-950 shadow-2xs flex-wrap">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center flex-shrink-0 font-extrabold text-xs">
          ₹
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <strong class="font-bold text-emerald-900">Allowed Budget:</strong>
          <span class="font-extrabold text-emerald-700 text-sm">₹${budget}</span>
        </div>
      </div>
    </div>`;
}

function getVoiceNotePlayerHtml(audioFile) {
  if (!audioFile) return '';
  return `
    <div class="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-2xs">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/70 text-indigo-600 flex items-center justify-center shadow-xs flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-extrabold text-slate-900 tracking-tight">Senior Voice Message</span>
            <span class="px-1.5 py-0.5 bg-indigo-100/80 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider">Voice Note</span>
          </div>
          <span class="text-[11px] text-slate-500 font-medium">Recorded Voice Request Attached</span>
        </div>
      </div>
      <audio controls src="${audioFile}" class="h-10 w-full sm:w-72 max-w-full rounded-xl"></audio>
    </div>`;
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
  // Companionship is purely human/volunteer oriented - do not suggest any AI platforms
  if (req.category === 'Companionship' || (req.category && req.category.toLowerCase() === 'companionship')) {
    return '';
  }

  // Do not show AI Suggested Platforms after payment/purchase cost is submitted or completed
  const hideStatuses = ['purchase_cost_submitted', 'purchase_funded', 'awaiting_verification', 'completed', 'fulfilled_by_family', 'delivery_completed'];
  if (hideStatuses.includes(req.status)) {
    return '';
  }

  let platforms = req.suggestedPlatforms;
  
  // Client-side fallback if request doesn't have stored platforms
  if (!platforms || platforms.length === 0) {
    const text = `${req.title || ''} ${req.description || ''} ${req.transcript || ''}`.toLowerCase();
    const query = req.extractedItems || req.title || 'items';
    const enc = encodeURIComponent(query);

    if (text.includes('crocin') || text.includes('medicine') || text.includes('tablet') || text.includes('dolo') || text.includes('syrup')) {
      platforms = [
        { name: 'Apollo 24|7', url: `https://www.apollo247.com/search-medicines/${enc}`, color: '#005b9f', searchQuery: query },
        { name: 'PharmEasy', url: `https://pharmeasy.in/search/all?name=${enc}`, color: '#10847e', searchQuery: query },
        { name: 'Tata 1mg', url: `https://www.1mg.com/search/all?name=${enc}`, color: '#ff6f61', searchQuery: query },
        { name: 'NetMeds', url: `https://www.netmeds.com/catalogsearch/result?q=${enc}`, color: '#24aeb1', searchQuery: query }
      ];
    } else if (text.includes('pizza') || text.includes('burger') || text.includes('biryani') || text.includes('paratha') || text.includes('food')) {
      platforms = [
        { name: 'Swiggy', url: `https://www.swiggy.com/search?query=${enc}`, color: '#fc8019', searchQuery: query },
        { name: 'Zomato', url: `https://www.zomato.com/search?q=${enc}`, color: '#cb202d', searchQuery: query },
        { name: 'EatSure', url: `https://www.eatsure.com/`, color: '#ff4f00', searchQuery: query }
      ];
    } else if (text.includes('cab') || text.includes('taxi') || text.includes('uber') || text.includes('ola') || text.includes('ride')) {
      platforms = [
        { name: 'Uber', url: `https://m.uber.com/`, color: '#000000', searchQuery: query },
        { name: 'Ola', url: `https://book.olacabs.com/`, color: '#2bb673', searchQuery: query },
        { name: 'Rapido', url: `https://www.rapido.bike/`, color: '#f9a825', searchQuery: query }
      ];
    } else if (text.includes('bill') || text.includes('electricity') || text.includes('recharge') || text.includes('pay')) {
      platforms = [
        { name: 'Google Pay', url: `https://pay.google.com/`, color: '#1a73e8', searchQuery: query },
        { name: 'PhonePe', url: `https://www.phonepe.com/`, color: '#5f259f', searchQuery: query },
        { name: 'Paytm', url: `https://paytm.com/`, color: '#00b9f1', searchQuery: query },
        { name: 'BHIM', url: `https://www.bhimupi.org.in/`, color: '#003975', searchQuery: query }
      ];
    } else if (text.includes('doctor') || text.includes('appointment') || text.includes('hospital') || text.includes('clinic')) {
      platforms = [
        { name: 'Practo', url: `https://www.practo.com/search?q=${enc}`, color: '#28328c', searchQuery: query },
        { name: 'Apollo 24|7', url: `https://www.apollo247.com/specialties`, color: '#005b9f', searchQuery: query },
        { name: 'MediBuddy', url: `https://www.medibuddy.in/`, color: '#1a73e8', searchQuery: query }
      ];
    } else {
      platforms = [
        { name: 'Blinkit', url: `https://blinkit.com/s/?q=${enc}`, color: '#f5c518', searchQuery: query },
        { name: 'Instamart', url: `https://www.swiggy.com/instamart/search?custom_back=true&query=${enc}`, color: '#fc8019', searchQuery: query },
        { name: 'Zepto', url: `https://www.zeptonow.com/search?q=${enc}`, color: '#7b1fa2', searchQuery: query },
        { name: 'BigBasket', url: `https://www.bigbasket.com/ps/?q=${enc}`, color: '#689f38', searchQuery: query },
        { name: 'Amazon Fresh', url: `https://www.amazon.in/s?k=${enc}`, color: '#232f3e', searchQuery: query }
      ];
    }
  }

  const cleanQ = cleanProductQuery(req.extractedItems || req.description || req.transcript || '');
  const queryLabel = escapeHTML(cleanQ);

  const chipsHtml = platforms.map(p => {
    const q = cleanProductQuery(p.searchQuery || req.extractedItems || req.description || req.transcript || '');
    const titleAttr = p.bestFor ? `${escapeHTML(p.name)} - ${escapeHTML(p.bestFor)} (${escapeHTML(p.suitability || '')})` : `Open ${escapeHTML(p.name)} search for '${escapeHTML(q)}'`;
    return `
      <button 
        type="button" 
        class="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200/90 hover:border-brand-300 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer group flex-wrap"
        onclick="openPlatformWithPreFill('${escapeHTML(p.url)}', '${escapeHTML(q)}', '${escapeHTML(p.name)}')"
        title="${titleAttr}"
      >
        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${p.color || '#026bc9'};"></span>
        <span class="font-extrabold text-slate-900">${escapeHTML(p.name)}</span>
        ${p.bestFor ? `<span class="text-[10px] text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded-md">${escapeHTML(p.bestFor)}</span>` : ''}
        ${p.suitability ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-full ${p.suitability === 'High' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">${escapeHTML(p.suitability)} Suitability</span>` : ''}
        <svg class="w-3 h-3 text-slate-400 group-hover:text-brand-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
      </button>`;
  }).join('');

  return `
    <div class="bg-gradient-to-r from-brand-50/40 via-slate-50 to-indigo-50/30 border border-brand-200/60 rounded-2xl p-4 mb-4 shadow-2xs">
      <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>
          </div>
          <span class="text-xs font-extrabold text-slate-800">AI Suggested Platforms &amp; Companions</span>
        </div>
        ${queryLabel ? `<span class="bg-white border border-brand-200/80 text-brand-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">Focus: "${queryLabel}"</span>` : ''}
      </div>
      <div class="flex items-center gap-2 flex-wrap">
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
                 .replace(/\bआपातकालीन अलार्म सक्रिय\b/gi, ' ')
                 .replace(/\bआणीबाणीचा अलार्म सक्रिय\b/gi, ' ')
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

  if (p.includes('elliq')) return 'https://elliq.com/';
  if (p.includes('pi') && !p.includes('pharmeasy') && !p.includes('rapido')) return 'https://pi.ai/';
  if (p.includes('chatgpt') || p.includes('openai')) return 'https://chatgpt.com/';
  if (p.includes('replika')) return 'https://replika.ai/';
  if (p.includes('character.ai') || p.includes('character')) return 'https://character.ai/';
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
let currentLightboxImages = [];
let currentLightboxIndex = 0;

function normalizeDocUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let str = rawUrl.replace(/\\/g, '/');
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) return str;
  const uploadsIdx = str.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    return str.substring(uploadsIdx);
  }
  const uploadsNoSlashIdx = str.indexOf('uploads/');
  if (uploadsNoSlashIdx !== -1) {
    return '/' + str.substring(uploadsNoSlashIdx);
  }
  return str.startsWith('/') ? str : '/' + str;
}

window.openImageLightbox = function(imageUrl, reqIdOrImages = null) {
  if (!imageUrl && !reqIdOrImages) return;

  const modal = document.getElementById('imageLightboxModal');

  let images = [];
  if (Array.isArray(reqIdOrImages)) {
    images = reqIdOrImages.map(normalizeDocUrl);
  } else if (typeof reqIdOrImages === 'string' && window.proofSliderData && window.proofSliderData[reqIdOrImages]) {
    images = window.proofSliderData[reqIdOrImages].map(normalizeDocUrl);
  } else if (typeof imageUrl === 'string') {
    images = [normalizeDocUrl(imageUrl)];
  }

  images = images.filter(Boolean);
  currentLightboxImages = images;

  const cleanUrl = normalizeDocUrl(typeof imageUrl === 'string' ? imageUrl : (images[0] || ''));
  let idx = images.indexOf(cleanUrl);
  if (idx === -1) idx = 0;
  currentLightboxIndex = idx;

  updateLightboxView();

  if (modal) modal.style.display = 'flex';
};

function updateLightboxView() {
  if (!currentLightboxImages || currentLightboxImages.length === 0) return;

  const imgEl = document.getElementById('lightboxImage');
  const linkEl = document.getElementById('lightboxDirectLink');
  const counterEl = document.getElementById('lightboxCounter');
  const prevBtn = document.getElementById('btnLightboxPrev');
  const nextBtn = document.getElementById('btnLightboxNext');

  const count = currentLightboxImages.length;
  const currentImg = currentLightboxImages[currentLightboxIndex];

  if (imgEl) imgEl.src = currentImg;
  if (linkEl) linkEl.href = currentImg;

  if (count > 1) {
    if (counterEl) {
      counterEl.style.display = 'block';
      counterEl.textContent = `${currentLightboxIndex + 1} / ${count}`;
    }
    if (prevBtn) {
      prevBtn.style.display = 'block';
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        currentLightboxIndex = (currentLightboxIndex - 1 + count) % count;
        updateLightboxView();
      };
    }
    if (nextBtn) {
      nextBtn.style.display = 'block';
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        currentLightboxIndex = (currentLightboxIndex + 1) % count;
        updateLightboxView();
      };
    }
  } else {
    // If ONLY 1 photo: hide counter and navigation arrows!
    if (counterEl) counterEl.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
  }
}

function closeImageLightbox() {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) modal.style.display = 'none';
}

async function renderRatingProfileCard(user) {
  if (!user) return;

  let stats = user.ratingStats;
  const volId = user._id || user.id;

  if (volId) {
    try {
      const statsRes = await apiCall(`/auth/volunteer-stats/${volId}`, 'GET');
      if (statsRes && statsRes.ok && statsRes.data && statsRes.data.stats) {
        stats = statsRes.data.stats;
        user.ratingStats = stats;
      }
    } catch (err) {
      console.warn('Error fetching volunteer rating stats:', err);
    }
  }

  if (!stats) return;

  const simpleOverallBadge = document.getElementById('simpleOverallBadge');
  const simpleCost = document.getElementById('simpleCost');
  const simpleSpeed = document.getElementById('simpleSpeed');
  const simpleComm = document.getElementById('simpleComm');
  const simpleRecommend = document.getElementById('simpleRecommend');
  const simpleTasks = document.getElementById('simpleTasks');
  const simpleReviews = document.getElementById('simpleReviews');

  if (simpleOverallBadge) {
    const rVal = (stats.reviewsCount > 0 && stats.overallRating) ? stats.overallRating.toFixed(1) : (stats.tasksCompleted > 0 ? '5.0' : '0.0');
    simpleOverallBadge.innerHTML = `<span class="text-xl font-extrabold text-slate-900 tracking-tight">${rVal}</span><span class="text-[11px] font-bold text-slate-400">/ 5.0</span>`;
  }

  const quickRatingText = document.getElementById('quickRatingText');
  if (quickRatingText) {
    if (stats.reviewsCount > 0) {
      quickRatingText.textContent = `${stats.overallRating.toFixed(1)} ★ Rating`;
    } else if (stats.tasksCompleted > 0) {
      quickRatingText.textContent = `${stats.tasksCompleted} Completed`;
    } else {
      quickRatingText.textContent = `5.0 ★ Rating`;
    }
  }

  if (simpleCost) {
    const val = stats.costUtilization > 0 ? stats.costUtilization.toFixed(1) : (stats.tasksCompleted > 0 ? '5.0' : '0.0');
    simpleCost.innerHTML = `<span class="text-xl font-extrabold text-slate-900 tracking-tight">${val}</span><span class="text-[11px] font-bold text-slate-400">/ 5.0</span>`;
  }
  if (simpleSpeed) {
    const val = stats.speedTimeliness > 0 ? stats.speedTimeliness.toFixed(1) : (stats.tasksCompleted > 0 ? '5.0' : '0.0');
    simpleSpeed.innerHTML = `<span class="text-xl font-extrabold text-slate-900 tracking-tight">${val}</span><span class="text-[11px] font-bold text-slate-400">/ 5.0</span>`;
  }
  if (simpleComm) {
    const val = stats.communication > 0 ? stats.communication.toFixed(1) : (stats.tasksCompleted > 0 ? '5.0' : '0.0');
    simpleComm.innerHTML = `<span class="text-xl font-extrabold text-slate-900 tracking-tight">${val}</span><span class="text-[11px] font-bold text-slate-400">/ 5.0</span>`;
  }
  if (simpleRecommend) {
    simpleRecommend.textContent = `${stats.recommendationRate || 100}% Families Recommend`;
  }
  if (simpleTasks) {
    const count = stats.tasksCompleted || 0;
    simpleTasks.textContent = `${count} task${count === 1 ? '' : 's'}`;
  }
  if (simpleReviews) {
    const count = stats.reviewsCount || 0;
    simpleReviews.textContent = `${count} review${count === 1 ? '' : 's'}`;
  }
}

// ── Mark Task Done Modal (service_only / mixed-no-purchase) ──────────────────
// Opens a lightweight completion modal — no bill needed, optional photo + note
window.openMarkDoneModal = function(requestId, taskTitle, proofType) {
  const modal = document.getElementById('markDoneModal');
  if (!modal) { alert('Mark Done modal not found.'); return; }

  const reqIdEl = document.getElementById('markDoneRequestId');
  const titleEl = document.getElementById('markDoneTaskTitle');
  const noteEl  = document.getElementById('markDoneNote');
  const fileEl  = document.getElementById('markDonePhoto');
  const previewEl = document.getElementById('markDonePhotoPreview');
  const proofTypeEl = document.getElementById('markDoneProofType');

  if (reqIdEl) reqIdEl.value = requestId || '';
  if (titleEl) titleEl.textContent = taskTitle || 'Task';
  if (noteEl)  noteEl.value = '';
  if (fileEl)  fileEl.value = '';
  if (previewEl) previewEl.style.display = 'none';
  if (proofTypeEl) proofTypeEl.value = proofType || 'service_only';

  modal.style.display = 'flex';
};

window.closeMarkDoneModal = function() {
  const modal = document.getElementById('markDoneModal');
  if (modal) modal.style.display = 'none';
};

window.markDonePhotoPreview = function(input) {
  const previewDiv = document.getElementById('markDonePhotoPreview');
  if (!previewDiv) return;
  previewDiv.innerHTML = '';
  if (input.files && input.files.length > 0) {
    previewDiv.classList.remove('hidden');
    previewDiv.style.display = 'flex';
    previewDiv.className = 'mt-2 flex flex-wrap gap-2';
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-2xs';
        previewDiv.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  } else {
    previewDiv.classList.add('hidden');
    previewDiv.style.display = 'none';
  }
};

window.handleMarkDoneSubmit = async function(e) {
  e.preventDefault();

  const requestId  = document.getElementById('markDoneRequestId')?.value;
  const noteVal    = document.getElementById('markDoneNote')?.value || '';
  const photoEl    = document.getElementById('markDonePhoto');
  const proofType  = document.getElementById('markDoneProofType')?.value || 'service_only';
  const btnSubmit  = document.getElementById('btnMarkDone');

  if (!requestId) { alert('Request ID missing'); return; }

  const formData = new FormData();
  formData.append('resolutionNotes', noteVal.trim() || 'Task completed by volunteer.');
  formData.append('volunteerDeclaredPurchase', 'false'); // service_only / mixed-no-purchase
  if (photoEl && photoEl.files && photoEl.files.length > 0) {
    for (let i = 0; i < photoEl.files.length; i++) {
      formData.append('proofs', photoEl.files[i]);
    }
  }

  if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Submitting...'; }

  try {
    const res = await apiCall(`/requests/${requestId}/complete`, 'PUT', formData);
    if (res.ok && res.data.success) {
      showToast(res.data.message || 'Task marked as done! Awaiting caregiver confirmation.', 'success');
      closeMarkDoneModal();
      loadVolunteerRequests();
    } else {
      alert(res.data?.message || 'Error marking task as done');
    }
  } catch (err) {
    console.error(err);
    alert('Network error marking task as done');
  } finally {
    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Mark as Done'; }
  }
};

// Open Modal Tab for Submitting Purchase Cost & Bill Proof (Step 4 & 5)
function openPurchaseCostModal(requestId) {
  const modal = document.getElementById('purchaseCostModal');
  const reqIdInput = document.getElementById('purchaseCostRequestId');
  const costInput = document.getElementById('purchaseCostInput');
  const proofFile = document.getElementById('purchaseProofFile');
  const notesInput = document.getElementById('purchaseNotesInput');
  const previewDiv = document.getElementById('purchaseProofPreview');
  const budgetBanner = document.getElementById('purchaseCostBudgetBanner');
  const budgetText = document.getElementById('purchaseCostBudgetText');

  const shopNameInput = document.getElementById('merchantShopNameInput');
  const upiIdInput = document.getElementById('merchantUpiIdInput');
  const qrFileInput = document.getElementById('merchantQrFile');
  const qrPreview = document.getElementById('merchantQrPreview');
  const paymentLinkInput = document.getElementById('merchantPaymentLinkInput');
  const orderNumberInput = document.getElementById('merchantOrderNumberInput');

  if (reqIdInput) reqIdInput.value = requestId || '';
  if (costInput) costInput.value = '';
  if (proofFile) proofFile.value = '';
  if (notesInput) notesInput.value = '';
  if (previewDiv) previewDiv.style.display = 'none';

  if (shopNameInput) shopNameInput.value = '';
  if (upiIdInput) upiIdInput.value = '';
  if (qrFileInput) qrFileInput.value = '';
  if (qrPreview) qrPreview.style.display = 'none';
  if (paymentLinkInput) paymentLinkInput.value = '';
  if (orderNumberInput) orderNumberInput.value = '';

  const offlineRadio = document.querySelector('input[name="merchantPaymentTypeRadio"][value="offline_qr"]');
  if (offlineRadio) offlineRadio.checked = true;
  toggleMerchantPaymentMethodUI('offline_qr');

  // Check if caregiver set an allowed budget estimate or existing merchant details
  const req = (window.allVolunteerRequestsMap && window.allVolunteerRequestsMap[requestId]);
  if (req) {
    if (req.allowedBudget !== undefined && req.allowedBudget !== null && Number(req.allowedBudget) > 0) {
      if (budgetText) budgetText.textContent = `₹${req.allowedBudget}`;
      if (budgetBanner) budgetBanner.style.display = 'block';
    } else {
      if (budgetBanner) budgetBanner.style.display = 'none';
    }
    if (req.merchantDetails) {
      if (shopNameInput && req.merchantDetails.shopName) shopNameInput.value = req.merchantDetails.shopName;
      if (upiIdInput && req.merchantDetails.upiId) upiIdInput.value = req.merchantDetails.upiId;
      if (paymentLinkInput && req.merchantDetails.paymentLink) paymentLinkInput.value = req.merchantDetails.paymentLink;
      if (orderNumberInput && req.merchantDetails.orderNumber) orderNumberInput.value = req.merchantDetails.orderNumber;
    }
  }

  togglePurchaseProofRequired('');

  if (modal) {
    modal.style.display = 'flex';
  } else {
    alert('Purchase cost modal template missing.');
  }
}

window.toggleMerchantPaymentMethodUI = function(method) {
  const offlineBox = document.getElementById('merchantOfflineFields');
  const onlineBox = document.getElementById('merchantOnlineFields');
  const linkInput = document.getElementById('merchantPaymentLinkInput');

  if (method === 'online_link') {
    if (offlineBox) offlineBox.style.display = 'none';
    if (onlineBox) onlineBox.style.display = 'block';
    if (linkInput) linkInput.required = true;
  } else {
    if (offlineBox) offlineBox.style.display = 'block';
    if (onlineBox) onlineBox.style.display = 'none';
    if (linkInput) linkInput.required = false;
  }
};

window.previewMerchantQrImage = function(input) {
  const previewDiv = document.getElementById('merchantQrPreview');
  const previewImg = document.getElementById('merchantQrPreviewImg');
  if (!previewDiv || !previewImg) return;

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    previewDiv.style.display = 'none';
    previewImg.src = '';
  }
};

window.togglePurchaseProofRequired = function(val) {
  const fileInput = document.getElementById('purchaseProofFile');
  const starEl = document.getElementById('purchaseProofRequiredStar');
  const optionalNote = document.getElementById('purchaseProofOptionalNote');

  if (fileInput) fileInput.required = false;
  if (starEl) starEl.style.display = 'none';
  if (optionalNote) optionalNote.textContent = ' (Optional if Store QR or UPI ID is provided)';
};

function closePurchaseCostModal() {
  const modal = document.getElementById('purchaseCostModal');
  if (modal) modal.style.display = 'none';
}

// Preview helper for Mark Done modal photo
window.markDonePhotoPreview = function(input) {
  const previewEl = document.getElementById('markDonePhotoPreview');
  if (!previewEl) return;
  if (input.files && input.files.length > 0) {
    previewEl.classList.remove('hidden');
    previewEl.querySelector('p').textContent = `${input.files.length} photo${input.files.length > 1 ? 's' : ''} selected ✓`;
  } else {
    previewEl.classList.add('hidden');
  }
};

function previewPurchaseProofImage(input) {
  const previewDiv = document.getElementById('purchaseProofPreview');
  if (!previewDiv) return;

  if (input.files && input.files.length > 0) {
    previewDiv.innerHTML = '';
    previewDiv.style.display = 'flex';
    previewDiv.style.flexWrap = 'wrap';
    previewDiv.style.gap = '8px';
    previewDiv.style.justifyContent = 'center';

    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Proof Preview';
        img.style.maxWidth = '140px';
        img.style.maxHeight = '140px';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid #ccc';
        img.style.objectFit = 'contain';
        previewDiv.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  } else {
    previewDiv.style.display = 'none';
    previewDiv.innerHTML = '';
  }
}

async function handlePurchaseCostSubmit(e) {
  e.preventDefault();

  const requestId = document.getElementById('purchaseCostRequestId')?.value;
  const costVal = document.getElementById('purchaseCostInput')?.value;
  const proofFile = document.getElementById('purchaseProofFile');
  const notesVal = document.getElementById('purchaseNotesInput')?.value;
  const btnSubmit = document.getElementById('btnSubmitPurchaseCost');

  const shopNameVal = document.getElementById('merchantShopNameInput')?.value;
  const paymentTypeVal = document.querySelector('input[name="merchantPaymentTypeRadio"]:checked')?.value || 'offline_qr';
  const qrFile = document.getElementById('merchantQrFile');
  const upiIdVal = document.getElementById('merchantUpiIdInput')?.value;
  const linkVal = document.getElementById('merchantPaymentLinkInput')?.value;
  const orderNumVal = document.getElementById('merchantOrderNumberInput')?.value;

  if (!requestId) {
    alert('Request ID missing');
    return;
  }

  const costNum = Number(costVal);
  if (isNaN(costNum) || costNum < 0) {
    alert('Please enter a valid purchase cost amount in ₹');
    return;
  }

  if (!shopNameVal || !shopNameVal.trim()) {
    alert('Please enter the Merchant / Shop Name');
    return;
  }

  const hasBillProof = Boolean(proofFile && proofFile.files && proofFile.files.length > 0);
  const hasQrPhoto = Boolean(qrFile && qrFile.files && qrFile.files.length > 0);
  const hasUpiId = Boolean(upiIdVal && upiIdVal.trim());
  const hasLink = Boolean(linkVal && linkVal.trim());

  if (costNum > 0 && !hasBillProof && !hasQrPhoto && !hasUpiId && !hasLink) {
    alert('Please provide store payment info (Store UPI QR photo, UPI ID, payment link, or bill photo)');
    return;
  }

  const formData = new FormData();
  formData.append('actualPurchaseCost', costNum);
  formData.append('purchaseNotes', notesVal ? notesVal.trim() : '');
  formData.append('shopName', shopNameVal.trim());
  formData.append('paymentType', paymentTypeVal);
  if (upiIdVal) formData.append('upiId', upiIdVal.trim());
  if (linkVal) formData.append('paymentLink', linkVal.trim());
  if (orderNumVal) formData.append('orderNumber', orderNumVal.trim());

  if (qrFile && qrFile.files && qrFile.files[0]) {
    formData.append('merchantQrFile', qrFile.files[0]);
  }

  if (proofFile && proofFile.files && proofFile.files.length > 0) {
    for (let i = 0; i < proofFile.files.length; i++) {
      formData.append('proofs', proofFile.files[i]);
    }
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting...';
  }

  try {
    const res = await apiCall(`/requests/${requestId}/submit-purchase-cost`, 'PUT', formData);
    if (res.ok && res.data.success) {
      showToast('Purchase cost & merchant payment details submitted! Waiting for caregiver direct payment to merchant.', 'success');
      closePurchaseCostModal();
      loadVolunteerRequests();
    } else {
      alert(res.data?.message || 'Error submitting purchase cost');
    }
  } catch (err) {
    console.error(err);
    alert('Network error submitting purchase cost');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit Purchase Cost & Proof';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VOLUNTEER PAY FOR PURCHASE (PRE-FUNDED ESCROW MOCK GATEWAY)
// ─────────────────────────────────────────────────────────────────────────────
window.togglePayDestinationFields = function(destType) {
  const fUpiId = document.getElementById('destFieldUpiId');
  const fUpiQr = document.getElementById('destFieldUpiQr');
  const fLink = document.getElementById('destFieldPaymentLink');
  const fOrder = document.getElementById('destFieldOnlineOrder');

  if (fUpiId) fUpiId.style.display = destType === 'upi_id' ? 'block' : 'none';
  if (fUpiQr) fUpiQr.style.display = destType === 'upi_qr' ? 'block' : 'none';
  if (fLink) fLink.style.display = destType === 'payment_link' ? 'block' : 'none';
  if (fOrder) fOrder.style.display = destType === 'online_order' ? 'block' : 'none';
};

window.togglePayProofOption = function(proofOption) {
  const uploadContainer = document.getElementById('payProofUploadContainer');
  const noReceiptContainer = document.getElementById('payNoReceiptReasonContainer');

  if (uploadContainer) uploadContainer.style.display = proofOption === 'has_receipt' ? 'block' : 'none';
  if (noReceiptContainer) noReceiptContainer.style.display = proofOption === 'no_receipt' ? 'block' : 'none';
};

window.updatePaymentSummaryLive = function(amountVal) {
  const reqId = document.getElementById('payPurchaseRequestId')?.value;
  const req = (window.allVolunteerRequestsMap && window.allVolunteerRequestsMap[reqId]);
  const authorized = Number(req?.allowedBudget || 0);
  let spent = 0;
  if (req?.merchantPurchases && req.merchantPurchases.length > 0) {
    spent = req.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  } else if (req?.fundingMode !== 'pre_fund' && req?.actualPurchaseCost) {
    spent = Number(req.actualPurchaseCost);
  }
  const remaining = authorized > 0 ? Math.max(0, authorized - spent) : 0;

  const costNum = Number(amountVal || 0);
  const remainingAfter = Math.max(0, remaining - costNum);

  const elPayAmt = document.getElementById('summaryPayAmount');
  const elPayRem = document.getElementById('summaryPayRemaining');
  const elPayAfter = document.getElementById('summaryPayRemainingAfter');
  const btnText = document.getElementById('btnPayMerchantText');

  if (elPayAmt) elPayAmt.textContent = `₹${costNum}`;
  if (elPayRem) elPayRem.textContent = `₹${remaining}`;
  if (elPayAfter) elPayAfter.textContent = `₹${remainingAfter}`;
  if (btnText) btnText.textContent = costNum > 0 ? `Pay Merchant ₹${costNum}` : 'Pay Merchant';
};

window.openVolunteerPayPurchaseModal = function(requestId) {
  const modal = document.getElementById('volunteerPayPurchaseModal');
  const reqIdInput = document.getElementById('payPurchaseRequestId');
  const merchantInput = document.getElementById('payPurchaseMerchantInput');
  const merchantTypeInput = document.getElementById('payPurchaseMerchantTypeInput');
  const locationInput = document.getElementById('payPurchaseMerchantLocationInput');
  const phoneInput = document.getElementById('payPurchaseMerchantPhoneInput');
  const upiIdInput = document.getElementById('payUpiIdInput');
  const qrFileInput = document.getElementById('payUpiQrFile');
  const linkInput = document.getElementById('payPaymentLinkInput');
  const orderInput = document.getElementById('payOrderLinkInput');
  const itemNameInput = document.getElementById('payItemNameInput');
  const quantityInput = document.getElementById('payQuantityInput');
  const amountInput = document.getElementById('payPurchaseAmountInput');
  const descInput = document.getElementById('payDescriptionInput');
  const proofFileInput = document.getElementById('payPurchaseProofFile');
  const noReceiptInput = document.getElementById('payNoReceiptReasonInput');

  const authEl = document.getElementById('modalPayAuthBudget');
  const spentEl = document.getElementById('modalPaySpentBudget');
  const remEl = document.getElementById('modalPayRemainingBudget');

  if (reqIdInput) reqIdInput.value = requestId || '';
  if (merchantInput) merchantInput.value = '';
  if (merchantTypeInput) merchantTypeInput.value = 'Pharmacy';
  if (locationInput) locationInput.value = '';
  if (phoneInput) phoneInput.value = '';
  if (upiIdInput) upiIdInput.value = '';
  if (qrFileInput) qrFileInput.value = '';
  if (linkInput) linkInput.value = '';
  if (orderInput) orderInput.value = '';
  if (quantityInput) quantityInput.value = '1';
  if (amountInput) amountInput.value = '';
  if (descInput) descInput.value = '';
  if (proofFileInput) proofFileInput.value = '';
  if (noReceiptInput) noReceiptInput.value = '';

  const req = (window.allVolunteerRequestsMap && window.allVolunteerRequestsMap[requestId]);
  if (itemNameInput) itemNameInput.value = req?.title || '';

  const authorized = Number(req?.allowedBudget || 0);
  let spent = 0;
  if (req?.merchantPurchases && req.merchantPurchases.length > 0) {
    spent = req.merchantPurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  } else if (req?.fundingMode !== 'pre_fund' && req?.actualPurchaseCost) {
    spent = Number(req.actualPurchaseCost);
  }
  const remaining = authorized > 0 ? Math.max(0, authorized - spent) : Infinity;

  if (authEl) authEl.textContent = `₹${authorized}`;
  if (spentEl) spentEl.textContent = `₹${spent}`;
  if (remEl) remEl.textContent = `₹${authorized > 0 ? remaining : 'No Limit'}`;

  if (amountInput && authorized > 0) {
    amountInput.max = remaining > 0 ? remaining : authorized;
  }

  // Set default radio selections
  const defaultDestRadio = document.querySelector('input[name="payDestinationType"][value="upi_id"]');
  if (defaultDestRadio) defaultDestRadio.checked = true;
  togglePayDestinationFields('upi_id');

  const defaultProofRadio = document.querySelector('input[name="payProofOption"][value="has_receipt"]');
  if (defaultProofRadio) defaultProofRadio.checked = true;
  togglePayProofOption('has_receipt');

  updatePaymentSummaryLive(0);

  if (modal) modal.style.display = 'flex';
};

window.closeVolunteerPayPurchaseModal = function() {
  const modal = document.getElementById('volunteerPayPurchaseModal');
  if (modal) modal.style.display = 'none';
};

window.handleVolunteerPayPurchaseSubmit = async function(e) {
  e.preventDefault();

  const requestId = document.getElementById('payPurchaseRequestId')?.value;
  const merchantVal = document.getElementById('payPurchaseMerchantInput')?.value;
  const merchantTypeVal = document.getElementById('payPurchaseMerchantTypeInput')?.value;
  const locationVal = document.getElementById('payPurchaseMerchantLocationInput')?.value;
  const phoneVal = document.getElementById('payPurchaseMerchantPhoneInput')?.value;

  const destTypeVal = document.querySelector('input[name="payDestinationType"]:checked')?.value || 'upi_id';
  const upiIdVal = document.getElementById('payUpiIdInput')?.value;
  const upiQrFile = document.getElementById('payUpiQrFile');
  const linkVal = document.getElementById('payPaymentLinkInput')?.value;
  const orderVal = document.getElementById('payOrderLinkInput')?.value;

  const itemNameVal = document.getElementById('payItemNameInput')?.value;
  const quantityVal = document.getElementById('payQuantityInput')?.value;
  const amountVal = document.getElementById('payPurchaseAmountInput')?.value;
  const descVal = document.getElementById('payDescriptionInput')?.value;

  const proofOptionVal = document.querySelector('input[name="payProofOption"]:checked')?.value || 'has_receipt';
  const proofFile = document.getElementById('payPurchaseProofFile');
  const noReceiptReasonVal = document.getElementById('payNoReceiptReasonInput')?.value;

  const btnSubmit = document.getElementById('btnSubmitVolunteerPayPurchase');

  if (!requestId) {
    showToast('Request ID missing', 'error');
    return;
  }

  const amountNum = Number(amountVal);
  if (isNaN(amountNum) || amountNum <= 0) {
    showToast('Please enter a valid purchase amount in ₹', 'warning');
    const amountInput = document.getElementById('payPurchaseAmountInput');
    if (amountInput) amountInput.focus();
    return;
  }

  const cleanMerchant = (merchantVal && merchantVal.trim()) ? merchantVal.trim() : 'Local Store / Pharmacy';

  // Destination Fallbacks & Smart Defaults
  let finalUpiId = upiIdVal ? upiIdVal.trim() : '';
  if (destTypeVal === 'upi_id' && !finalUpiId) {
    finalUpiId = `${cleanMerchant.toLowerCase().replace(/[^a-z0-9]/g, '') || 'store'}@upi`;
  }
  let finalLink = linkVal ? linkVal.trim() : '';
  if (destTypeVal === 'payment_link' && !finalLink) {
    finalLink = `https://payment.merchant/${encodeURIComponent(cleanMerchant)}`;
  }
  let finalOrder = orderVal ? orderVal.trim() : '';
  if (destTypeVal === 'online_order' && !finalOrder) {
    finalOrder = `https://store.online/order/${Date.now()}`;
  }

  let finalNoReceiptReason = noReceiptReasonVal ? noReceiptReasonVal.trim() : '';
  if (proofOptionVal === 'no_receipt' && !finalNoReceiptReason) {
    finalNoReceiptReason = 'No printed bill provided by merchant';
  }

  const formData = new FormData();
  formData.append('merchant', cleanMerchant);
  formData.append('merchantType', merchantTypeVal || 'Pharmacy');
  if (locationVal) formData.append('merchantLocation', locationVal.trim());
  if (phoneVal) formData.append('merchantPhone', phoneVal.trim());
  formData.append('paymentDestinationType', destTypeVal);

  if (finalUpiId) formData.append('upiId', finalUpiId);
  if (finalLink) formData.append('paymentLink', finalLink);
  if (finalOrder) formData.append('orderLink', finalOrder);
  if (upiQrFile && upiQrFile.files && upiQrFile.files[0]) {
    formData.append('proofs', upiQrFile.files[0]);
  }

  formData.append('itemName', (itemNameVal && itemNameVal.trim()) || 'Item');
  formData.append('quantity', (quantityVal && quantityVal.trim()) || '1');
  formData.append('amount', amountNum);
  if (descVal) formData.append('description', descVal.trim());

  formData.append('hasReceipt', proofOptionVal === 'has_receipt');
  if (finalNoReceiptReason) formData.append('noReceiptReason', finalNoReceiptReason);
  if (proofOptionVal === 'has_receipt' && proofFile && proofFile.files && proofFile.files[0]) {
    formData.append('proofs', proofFile.files[0]);
  }

  let origBtnHtml = '';
  if (btnSubmit) {
    origBtnHtml = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="animate-pulse">Processing Payment with Gateway...</span>`;
  }

  try {
    const res = await apiCall(`/requests/${requestId}/volunteer-pay-purchase`, 'POST', formData);
    if (res.ok && res.data.success) {
      const summary = res.data.budgetSummary || {};
      const txnId = res.data.payment?.transactionId || `TXN_${Date.now()}`;
      showToast(`Payment Successful! ₹${amountNum} paid to ${cleanMerchant} from Allocated Funds.`, 'success');
      closeVolunteerPayPurchaseModal();
      loadVolunteerRequests();
    } else {
      showToast(res.data?.message || 'Error processing merchant payment', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error processing merchant payment', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = origBtnHtml;
    }
  }
};

window.proofSliderData = window.proofSliderData || {};
window.proofSliderIndex = window.proofSliderIndex || {};

function renderProofSliderHtml(reqId, rawImages) {
  if (!rawImages || rawImages.length === 0) return '';

  const images = Array.from(new Set(
    rawImages
      .filter(Boolean)
      .map(normalizeDocUrl)
      .filter(img => img && img.length > 1)
  ));

  if (images.length === 0) return '';

  window.proofSliderData[reqId] = images;
  window.proofSliderIndex[reqId] = 0;

  const firstImg = images[0];
  const count = images.length;

  return `
    <div class="mt-2.5 p-3 bg-white/90 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 group/proof shadow-2xs">
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative rounded-xl overflow-hidden bg-amber-50 border border-amber-300 flex-shrink-0 cursor-pointer shadow-2xs group-hover/proof:scale-105 transition-transform" style="width:52px;height:52px;min-width:52px;" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(firstImg)}', '${reqId}'); return false;" title="Click to view image">
          <img src="${escapeHTML(firstImg)}" alt="Proof Thumbnail" class="w-full h-full object-cover">
          ${count > 1 ? `<span class="absolute bottom-0.5 right-0.5 bg-slate-900/85 text-white text-[9px] font-black px-1 rounded">+${count - 1}</span>` : ''}
        </div>
        <div class="min-w-0">
          <span class="text-[10px] font-extrabold text-amber-900/60 uppercase tracking-wider block">Uploaded Receipt</span>
          <span class="text-xs font-extrabold text-slate-900 truncate block">Purchase Bill Photo</span>
          <span class="text-[11px] text-slate-500 font-semibold block">${count} photo${count > 1 ? 's' : ''}</span>
        </div>
      </div>
      <button 
        type="button" 
        onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(firstImg)}', '${reqId}'); return false;" 
        class="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer active:scale-95"
      >
        <svg class="w-3.5 h-3.5 text-amber-800" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>View Photo</span>
      </button>
    </div>`;
}

window.navigateProofSlider = function(reqId, direction) {
  const images = window.proofSliderData ? window.proofSliderData[reqId] : null;
  if (!images || images.length <= 1) return;

  let currIdx = window.proofSliderIndex[reqId] || 0;
  currIdx = (currIdx + direction + images.length) % images.length;
  window.proofSliderIndex[reqId] = currIdx;

  const imgEl = document.getElementById(`sliderImg_${reqId}`);
  const counterEl = document.getElementById(`sliderCounter_${reqId}`);

  if (imgEl) {
    imgEl.src = images[currIdx];
  }
  if (counterEl) {
    counterEl.textContent = `${currIdx + 1} / ${images.length}`;
  }
};

// Modal Helper Functions for Tip Earned
function showTipEarnedModal(taskTitle, tipAmount, serviceFee) {
  const modal = document.getElementById('tipEarnedModal');
  const taskTitleEl = document.getElementById('tipTaskTitle');
  const amountEl = document.getElementById('tipModalAmount');
  const breakdownEl = document.getElementById('tipModalBreakdown');

  if (taskTitleEl) taskTitleEl.textContent = `"${taskTitle}"`;
  if (amountEl) amountEl.textContent = `+ ₹${tipAmount}`;
  if (breakdownEl) breakdownEl.textContent = `Base Service Fee: ₹${serviceFee} | Total Earned: ₹${Number(serviceFee) + Number(tipAmount)}`;

  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeTipEarnedModal() {
  const modal = document.getElementById('tipEarnedModal');
  if (modal) modal.style.display = 'none';
}

// ───────────────────────────────────────────────────────────────────────────
// VOLUNTEER EARNINGS WALLET
// ───────────────────────────────────────────────────────────────────────────

// Cached earnings data
let _earningsData = null;

// Animate a number counting up from 0 to target
function animateCounter(el, target, prefix = '₹', duration = 700) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = `${prefix}${current.toLocaleString('en-IN')}`;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Load earnings from API and render wallet card
async function loadVolunteerEarnings(silent = false) {
  try {
    const res = await apiCall('/volunteer/earnings', 'GET');
    if (!res.ok || !res.data.success) {
      console.warn('Could not load earnings:', res.data?.message);
      return;
    }

    _earningsData = res.data;
    const { wallet, monthly, transactions } = res.data;

    // Show the wallet card only if fully verified
    const card = document.getElementById('earningsWalletCard');
    const isFullyVerified = currentVolunteerUser && (currentVolunteerUser.verificationStatus === 'verified') && (currentVolunteerUser.isIdVerified === true || currentVolunteerUser.isIdVerified === 'true') && (currentVolunteerUser.isPoliceVerified === true || currentVolunteerUser.isPoliceVerified === 'true');
    if (card) card.style.display = isFullyVerified ? 'block' : 'none';

    // Update wallet numbers with animation (silent = no animation on background refresh)
    const totalEl = document.getElementById('walletTotalEarned');
    const availEl = document.getElementById('walletAvailable');
    const pendEl  = document.getElementById('walletPending');
    const quickWalletEl = document.getElementById('quickWalletBalance');

    if (silent) {
      // Silent refresh: just update text without animation
      if (totalEl) totalEl.textContent = `₹${wallet.totalEarned.toLocaleString('en-IN')}`;
      if (availEl) availEl.textContent = `₹${wallet.available.toLocaleString('en-IN')}`;
      if (pendEl)  pendEl.textContent  = `₹${wallet.pending.toLocaleString('en-IN')}`;
      if (quickWalletEl) quickWalletEl.textContent = `₹${wallet.available.toLocaleString('en-IN')}`;
    } else {
      animateCounter(totalEl, wallet.totalEarned);
      animateCounter(availEl, wallet.available);
      animateCounter(pendEl,  wallet.pending);
      animateCounter(quickWalletEl, wallet.available);
    }

    // Update withdraw button label
    const withdrawBtn = document.getElementById('btnConfirmWithdraw');
    if (withdrawBtn) withdrawBtn.textContent = `Withdraw ₹${wallet.available.toLocaleString('en-IN')}`;

    const withdrawAvailEl = document.getElementById('withdrawAvailableAmount');
    if (withdrawAvailEl) withdrawAvailEl.textContent = `₹${wallet.available.toLocaleString('en-IN')}`;

    // Update timestamp
    const lastUpdated = document.getElementById('walletLastUpdated');
    if (lastUpdated) {
      const now = new Date();
      lastUpdated.textContent = `Updated ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    }

  } catch (err) {
    console.error('loadVolunteerEarnings error:', err);
  }
}

// Open earnings history modal
function openEarningsModal() {
  const modal = document.getElementById('earningsModal');
  if (!modal) return;
  modal.style.display = 'flex';
  populateEarningsModal();
  switchEarningsTab('transactions'); // default tab
}

// Close earnings modal
function closeEarningsModal() {
  const modal = document.getElementById('earningsModal');
  if (modal) modal.style.display = 'none';
  // Reset withdrawal success state for next open
  const normalState = document.getElementById('withdrawNormalState');
  const successState = document.getElementById('withdrawSuccessState');
  if (normalState) normalState.style.display = 'block';
  if (successState) successState.style.display = 'none';
}

// Open the modal directly on the Withdraw tab
function openWithdrawPanel() {
  openEarningsModal();
  // Slight delay to let modal render first
  setTimeout(() => switchEarningsTab('withdraw'), 50);
}

// Switch between Transactions / Monthly / Withdraw tabs
function switchEarningsTab(tab) {
  const tabs = ['transactions', 'monthly', 'withdraw'];
  const tabLabels = { transactions: 'tabTransactions', monthly: 'tabMonthly', withdraw: 'tabWithdraw' };
  const paneIds  = { transactions: 'tabPaneTransactions', monthly: 'tabPaneMonthly', withdraw: 'tabPaneWithdraw' };

  tabs.forEach(t => {
    const btn  = document.getElementById(tabLabels[t]);
    const pane = document.getElementById(paneIds[t]);
    const isActive = (t === tab);
    if (btn) {
      btn.style.color = isActive ? '#2e7d32' : '#888';
      btn.style.borderBottom = isActive ? '3px solid #2e7d32' : '3px solid transparent';
    }
    if (pane) pane.style.display = isActive ? 'block' : 'none';
  });
}

// Populate modal summary strip + transaction list + monthly stats
function populateEarningsModal() {
  if (!_earningsData) return;
  const { wallet, monthly, transactions } = _earningsData;

  // ─ Summary strip ─
  const modalTotal = document.getElementById('modalTotalEarned');
  const modalAvail = document.getElementById('modalAvailable');
  const modalPend  = document.getElementById('modalPending');
  if (modalTotal) modalTotal.textContent = `₹${wallet.totalEarned.toLocaleString('en-IN')}`;
  if (modalAvail) modalAvail.textContent = `₹${wallet.available.toLocaleString('en-IN')}`;
  if (modalPend)  modalPend.textContent  = `₹${wallet.pending.toLocaleString('en-IN')}`;

  // ─ Withdraw tab amounts ─
  const wdAvail = document.getElementById('withdrawAvailableAmount');
  const wdBtn   = document.getElementById('btnConfirmWithdraw');
  if (wdAvail) wdAvail.textContent = `₹${wallet.available.toLocaleString('en-IN')}`;
  if (wdBtn)   wdBtn.textContent   = `Withdraw ₹${wallet.available.toLocaleString('en-IN')}`;

  // ─ Monthly stats ─
  const mTasks = document.getElementById('monthlyTasksCompleted');
  const mTotal = document.getElementById('monthlyTotalEarned');
  const mAvg   = document.getElementById('monthlyAvgPerTask');
  const mLabel = document.getElementById('monthlyPeriodLabel');
  if (mTasks) mTasks.textContent = monthly.tasksCompleted;
  if (mTotal) mTotal.textContent = `₹${monthly.totalEarned.toLocaleString('en-IN')}`;
  if (mAvg)   mAvg.textContent   = `₹${monthly.avgPerTask.toLocaleString('en-IN')}`;
  if (mLabel) mLabel.textContent = monthly.month;

  // ─ Transaction list ─
  const list   = document.getElementById('transactionsList');
  const noMsg  = document.getElementById('noTransactionsMsg');
  if (!list) return;

  list.innerHTML = '';

  const visibleTx = transactions.filter(t => t.amount > 0 || t.type === 'SERVICE_CHARGE');

  if (visibleTx.length === 0) {
    if (noMsg) noMsg.style.display = 'block';
    return;
  }
  if (noMsg) noMsg.style.display = 'none';

  visibleTx.forEach(tx => {
    const dateStr = tx.date
      ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    // Status badge
    const statusStyles = {
      RELEASED:  { bg: '#e8f5e9', color: '#1b5e20', label: 'Released' },
      PENDING:   { bg: '#fff8e1', color: '#f57f17', label: 'Pending'  },
      WITHDRAWN: { bg: '#f3e5f5', color: '#6a1b9a', label: 'Withdrawn' }
    };
    const s = statusStyles[tx.status] || statusStyles.PENDING;

    // Type badge
    const typeLabel = tx.type === 'TIP' ? 'Tip' : 'Service';
    const typeColor = tx.type === 'TIP' ? '#e65100' : '#1b5e20';

    const item = document.createElement('div');
    item.style.cssText = `
      display: flex; align-items: center; gap: 12px;
      background: #ffffff; border: 1.5px solid #e8f5e9;
      border-radius: 12px; padding: 12px 14px;
      transition: box-shadow 0.2s;
    `;
    item.onmouseover = () => { item.style.boxShadow = '0 4px 14px rgba(46,125,50,0.12)'; };
    item.onmouseout  = () => { item.style.boxShadow = 'none'; };

    item.innerHTML = `
      <div style="width: 42px; height: 42px; background: #e8f5e9; color: #1b5e20; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
        <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; color: #222; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(tx.taskTitle || 'Help Request')}</div>
        <div style="font-size: 0.8rem; color: #888; margin-top: 2px;">${dateStr} &nbsp;&bull;&nbsp; <span style="color: ${typeColor}; font-weight: 600;">${typeLabel}</span></div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div style="font-size: 1.1rem; font-weight: 900; color: #1b5e20;">+ ₹${tx.amount.toLocaleString('en-IN')}</div>
        <span style="font-size: 0.72rem; font-weight: 700; background: ${s.bg}; color: ${s.color}; padding: 2px 8px; border-radius: 8px; display: inline-block; margin-top: 3px;">
          ${s.label}
        </span>
      </div>
    `;
    list.appendChild(item);
  });
}

// Confirm and process withdrawal
async function confirmWithdrawal() {
  const available = _earningsData?.wallet?.available || 0;
  if (available <= 0) {
    showToast('₹0 available to withdraw. Complete more tasks first!', 'info');
    return;
  }

  const btn = document.getElementById('btnConfirmWithdraw');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing...';
  }

  try {
    const res = await apiCall('/volunteer/withdraw', 'POST');
    if (res.ok && res.data.success) {
      const { withdrawal } = res.data;

      // Show success state
      const normalState   = document.getElementById('withdrawNormalState');
      const successState  = document.getElementById('withdrawSuccessState');
      const successAmount = document.getElementById('withdrawSuccessAmount');
      const successTxId   = document.getElementById('withdrawSuccessTxId');

      if (successAmount) successAmount.textContent = `₹${withdrawal.amount.toLocaleString('en-IN')}`;
      if (successTxId)   successTxId.textContent   = withdrawal.transactionId;
      if (normalState)   normalState.style.display  = 'none';
      if (successState)  successState.style.display = 'block';

      // Refresh wallet card with new (zeroed) available balance
      await loadVolunteerEarnings(true);
      populateEarningsModal();

      showToast(`Withdrawal of ₹${withdrawal.amount} initiated! TX: ${withdrawal.transactionId}`, 'success');
    } else {
      showToast(res.data?.message || 'Withdrawal failed. Please try again.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = `Withdraw ₹${available.toLocaleString('en-IN')}`;
      }
    }
  } catch (err) {
    console.error('Withdrawal error:', err);
    showToast('Network error during withdrawal.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Withdraw ₹${available.toLocaleString('en-IN')}`;
    }
  }
}

// ─── Task Notification Dismiss Handlers ─────────────────────────────────────
window.dismissTaskNotification = function(requestId) {
  const userStr = localStorage.getItem('user');
  let currentUserId = '';
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      currentUserId = String(u._id || u.id || '');
    } catch (e) {
      console.error(e);
    }
  }
  if (!currentUserId) return;

  const key = `dismissed_notifications_${currentUserId}`;
  const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
  if (!dismissed.includes(requestId)) {
    dismissed.push(requestId);
    localStorage.setItem(key, JSON.stringify(dismissed));
  }
  loadVolunteerRequests(true); // silent refresh
};

window.clearAllTaskNotifications = function() {
  const userStr = localStorage.getItem('user');
  let currentUserId = '';
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      currentUserId = String(u._id || u.id || '');
    } catch (e) {
      console.error(e);
    }
  }
  if (!currentUserId) return;

  const key = `dismissed_notifications_${currentUserId}`;
  const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
  
  if (window.notifiedRequestIds && window.notifiedRequestIds.length > 0) {
    window.notifiedRequestIds.forEach(id => {
      if (!dismissed.includes(id)) dismissed.push(id);
    });
    localStorage.setItem(key, JSON.stringify(dismissed));
  }
  loadVolunteerRequests(true); // silent refresh
};

// Switch between Task dashboard tabs: Browse Requests, Active, Awaiting Approval, History
window.switchTaskTab = function(tab) {
  window.currentVolunteerTab = tab;
  const tabs = ['pending', 'active', 'awaiting', 'history'];
  const tabBtnIds = { pending: 'tabBtnPending', active: 'tabBtnActive', awaiting: 'tabBtnAwaiting', history: 'tabBtnHistory' };
  const paneIds = { pending: 'tabPanePending', active: 'tabPaneActive', awaiting: 'tabPaneAwaiting', history: 'tabPaneHistory' };
  const badgeIds = { pending: 'countPending', active: 'countActive', awaiting: 'countAwaiting', history: 'countHistory' };

  if (tab === 'pending') {
    const userStr = localStorage.getItem('user');
    let currentUserId = '';
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        currentUserId = String(u._id || u.id || '');
      } catch (e) {}
    }
    const seenKey = currentUserId ? `seen_pending_requests_${currentUserId}` : 'seen_pending_requests';
    let seenList = JSON.parse(localStorage.getItem(seenKey) || '[]');
    if (window.currentPendingRequests && window.currentPendingRequests.length > 0) {
      window.currentPendingRequests.forEach(r => {
        const idStr = String(r._id || '');
        if (idStr && !seenList.includes(idStr)) seenList.push(idStr);
      });
      localStorage.setItem(seenKey, JSON.stringify(seenList));
    }
    const countPendingEl = document.getElementById('countPending');
    if (countPendingEl) {
      countPendingEl.dataset.actionNeeded = "false";
      const cnt = parseInt(countPendingEl.textContent, 10) || 0;
      if (cnt > 0) {
        countPendingEl.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
      }
    }
  }

  tabs.forEach(t => {
    const btn = document.getElementById(tabBtnIds[t]);
    const pane = document.getElementById(paneIds[t]);
    const badge = document.getElementById(badgeIds[t]);
    const isActive = (t === tab);

    if (btn) {
      if (isActive) {
        btn.className = "w-full p-3.5 rounded-2xl transition-all duration-150 flex items-center justify-between gap-3 text-left cursor-pointer border-2 bg-brand-50/90 border-brand-500 shadow-xs ring-2 ring-brand-100/50";
        btn.setAttribute('aria-selected', 'true');
        const titleSpan = btn.querySelector('span.text-sm');
        if (titleSpan) {
          titleSpan.className = "text-sm font-extrabold text-brand-950 block leading-tight truncate";
        }
      } else {
        btn.className = "w-full p-3.5 rounded-2xl transition-all duration-150 flex items-center justify-between gap-3 text-left cursor-pointer border bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs";
        btn.setAttribute('aria-selected', 'false');
        const titleSpan = btn.querySelector('span.text-sm');
        if (titleSpan) {
          titleSpan.className = "text-sm font-bold text-slate-800 block leading-tight truncate";
        }
      }

      if (badge && t !== 'pending') {
        const isActionNeeded = badge.dataset.actionNeeded === "true";
        const isHistory = badge.dataset.isHistory === "true" || t === 'history';
        const count = parseInt(badge.textContent, 10) || 0;
        if (isHistory) {
          badge.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
        } else if (isActionNeeded && count > 0) {
          badge.className = "bg-brand-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-xs badge-blink-active flex-shrink-0";
        } else if (count > 0) {
          badge.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
        } else {
          badge.className = "bg-slate-100 text-slate-400 text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0";
        }
      }
    }
    if (pane) {
      pane.style.display = isActive ? 'block' : 'none';
    }
  });
};

