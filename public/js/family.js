// AgeWell — Family/Caregiver Dashboard Client Script

let activeRejectRequestId = null;
let pendingAllotRequestId = null;
let pendingAllotVolunteerId = null;
let pendingSelectVolunteerRequestId = null;
let pendingSelectVolunteerId = null;
let pendingSelectVolunteerName = '';
let pollInterval = null;
let currentVolunteersMap = {};
let currentRequestsMap = {};

// ─── UPI App Deep Link Helper ──────────────────────────────────────────────
/**
 * Opens the UPI deep link (upi://pay?...) to launch GPay/PhonePe/Paytm etc.
 * On desktop or browsers that don't support the scheme, falls back to copying
 * the UPI ID to clipboard and showing a user-friendly toast.
 */
function openInUpiApp(upiUrl, upiId) {
  if (!upiUrl) {
    showFamilyToast('No UPI link available.', 'error');
    return;
  }

  // Attempt to open the deep link — works natively on Android Chrome/mobile
  const start = Date.now();
  window.location.href = upiUrl;

  // After a short timeout, if we're still here (desktop / unsupported browser),
  // fall back to copying the UPI ID and showing instructions
  setTimeout(() => {
    const elapsed = Date.now() - start;
    // If less than ~1200ms have passed the browser likely didn't hand off to an app
    if (elapsed < 1500) {
      // Fallback: copy UPI ID and show toast
      copyUpiId(upiId);
      showFamilyToast(
        `Your browser doesn't support UPI deep links. UPI ID "${upiId}" copied — open GPay / PhonePe / Paytm and paste it to pay.`,
        'info',
        6000
      );
    }
  }, 1200);
}

/**
 * Copies the UPI ID to clipboard and shows a toast notification.
 */
function copyUpiId(upiId) {
  if (!upiId) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(upiId).then(() => {
        showFamilyToast(`UPI ID "${upiId}" copied to clipboard!`, 'success');
      }).catch(() => {
        _fallbackCopy(upiId);
      });
    } else {
      _fallbackCopy(upiId);
    }
  } catch (e) {
    _fallbackCopy(upiId);
  }
}

function _fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    document.execCommand('copy');
    showFamilyToast(`UPI ID "${text}" copied to clipboard!`, 'success');
  } catch (e) {
    showFamilyToast(`Copy failed — UPI ID: ${text}`, 'error');
  }
  document.body.removeChild(el);
}

/**
 * Show a small toast notification for family dashboard actions.
 * Tries to reuse an existing toast system; falls back to a custom overlay.
 */
function showFamilyToast(message, type = 'success', duration = 3500) {
  // Try to use the global showToast if available
  if (typeof showToast === 'function') {
    showToast(message, type, duration);
    return;
  }

  // Custom fallback toast
  let toast = document.getElementById('familyUpiToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'familyUpiToast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%) translateY(60px)',
      'z-index:99999', 'padding:12px 20px', 'border-radius:14px',
      'font-size:13px', 'font-weight:700', 'color:#fff',
      'box-shadow:0 4px 24px rgba(0,0,0,0.18)', 'transition:transform 0.3s ease, opacity 0.3s ease',
      'opacity:0', 'max-width:90vw', 'text-align:center', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(toast);
  }

  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
  toast.style.background = colors[type] || colors.success;
  toast.textContent = message;

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  // Animate out after duration
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(60px)';
  }, duration);
}
// ──────────────────────────────────────────────────────────────────────────────


function resolveRequestVolunteer(req) {
  if (!req) return { vol: null, volName: 'Volunteer', volPhone: '', volEmail: '', volId: '' };
  let vol = req.volunteer;
  if (typeof vol === 'string' && currentVolunteersMap && currentVolunteersMap[vol]) {
    vol = currentVolunteersMap[vol];
  }
  if ((!vol || typeof vol === 'string') && req.volunteerQuotes && req.volunteerQuotes.length > 0) {
    const targetId = typeof vol === 'string' ? vol : null;
    let match = null;
    if (targetId) {
      match = req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === String(targetId));
    }
    if (!match) match = req.volunteerQuotes[0];
    if (match && typeof match.volunteer === 'object') {
      vol = match.volunteer;
    }
  }
  const volName = vol && typeof vol === 'object' ? (vol.name || 'Volunteer') : (typeof vol === 'string' && currentVolunteersMap[vol]?.name ? currentVolunteersMap[vol].name : 'Volunteer');
  const volPhone = vol && typeof vol === 'object' ? (vol.phone || '') : (typeof vol === 'string' && currentVolunteersMap[vol]?.phone ? currentVolunteersMap[vol].phone : '');
  const volEmail = vol && typeof vol === 'object' ? (vol.email || '') : (typeof vol === 'string' && currentVolunteersMap[vol]?.email ? currentVolunteersMap[vol].email : '');
  const volId = vol ? (typeof vol === 'object' ? (vol._id || vol.id) : vol) : '';
  return { vol, volName, volPhone, volEmail, volId };
}

document.addEventListener('DOMContentLoaded', () => {
  // Validate auth — must be family role
  const auth = checkAuthAndRedirect('family');
  if (!auth) return;

  // Personalize header
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    const navUserName = document.getElementById('navUserName');
    if (navUserName) navUserName.textContent = `Hello, ${user.name} (${user.relationship || 'Caregiver'})`;

    const welcomeTitle = document.getElementById('welcomeTitle');
    if (welcomeTitle) welcomeTitle.textContent = `Welcome back, ${user.name}!`;

    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    if (welcomeSubtitle && user.relationship) {
      welcomeSubtitle.textContent = `Your personal portal for daily assistance, verified local volunteers, and caregiver care.`;
    }
  }


  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await apiCall('/auth/logout', 'POST');
      localStorage.removeItem('user');
      window.location.href = '/';
    });
  }

  // Rejection Modal
  const rejectModal = document.getElementById('rejectModal');
  const rejectModalClose = document.getElementById('rejectModalClose');
  const btnCancelReject = document.getElementById('btnCancelReject');
  const btnConfirmReject = document.getElementById('btnConfirmReject');

  const closeRejectModal = () => {
    rejectModal.style.display = 'none';
    activeRejectRequestId = null;
  };

  if (rejectModalClose) rejectModalClose.addEventListener('click', closeRejectModal);
  if (btnCancelReject) btnCancelReject.addEventListener('click', closeRejectModal);
  window.addEventListener('click', (e) => {
    if (e.target === rejectModal) closeRejectModal();
  });

  if (btnConfirmReject) {
    btnConfirmReject.addEventListener('click', async () => {
      if (!activeRejectRequestId) return;
      await doRejectVolunteer(activeRejectRequestId);
      closeRejectModal();
    });
  }

  // Lightbox Modal Bindings
  const lightboxClose = document.getElementById('lightboxClose');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');
  const lightboxModal = document.getElementById('imageLightboxModal');

  if (lightboxClose) lightboxClose.addEventListener('click', closeImageLightbox);
  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeImageLightbox);
  window.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeImageLightbox();
  });

  // Volunteer Profile Modal Bindings
  const volunteerProfileModal = document.getElementById('volunteerProfileModal');
  const volunteerProfileClose = document.getElementById('volunteerProfileClose');
  const btnCloseVolunteerProfile = document.getElementById('btnCloseVolunteerProfile');

  const closeVolunteerProfileModal = () => {
    if (volunteerProfileModal) volunteerProfileModal.style.display = 'none';
  };

  if (volunteerProfileClose) volunteerProfileClose.addEventListener('click', closeVolunteerProfileModal);
  if (btnCloseVolunteerProfile) btnCloseVolunteerProfile.addEventListener('click', closeVolunteerProfileModal);
  // Shopping Preference Checkboxes Bindings
  const shoppingPrefModal = document.getElementById('shoppingPrefModal');
  const shoppingPrefModalClose = document.getElementById('shoppingPrefModalClose');
  const btnCancelShoppingPref = document.getElementById('btnCancelShoppingPref');
  const btnConfirmShoppingPref = document.getElementById('btnConfirmShoppingPref');
  const shoppingPrefChecks = document.querySelectorAll('input[name="shoppingPrefCheck"]');
  const otherPrefTextContainer = document.getElementById('otherPrefTextContainer');
  const inputCustomOtherPref = document.getElementById('inputCustomOtherPref');
  const checkNoPref = document.getElementById('checkNoPref');
  const checkOtherPref = document.getElementById('checkOtherPref');

  shoppingPrefChecks.forEach(chk => {
    chk.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'No Preference' && e.target.checked) {
        // Uncheck all other checkboxes if "No Preference" is checked
        shoppingPrefChecks.forEach(c => {
          if (c.value !== 'No Preference') c.checked = false;
        });
        if (otherPrefTextContainer) otherPrefTextContainer.style.display = 'none';
      } else if (e.target.checked && val !== 'No Preference') {
        // If any specific preference is checked, uncheck "No Preference"
        if (checkNoPref) checkNoPref.checked = false;
      }

      // Check if "Other" is checked
      if (checkOtherPref && checkOtherPref.checked) {
        if (otherPrefTextContainer) otherPrefTextContainer.style.display = 'block';
        if (inputCustomOtherPref && document.activeElement !== inputCustomOtherPref) {
          inputCustomOtherPref.focus();
        }
      } else {
        if (otherPrefTextContainer) otherPrefTextContainer.style.display = 'none';
      }
    });
  });

  if (shoppingPrefModalClose) shoppingPrefModalClose.addEventListener('click', closeShoppingPrefModal);
  if (btnCancelShoppingPref) btnCancelShoppingPref.addEventListener('click', closeShoppingPrefModal);
  if (btnConfirmShoppingPref) btnConfirmShoppingPref.addEventListener('click', confirmAndSubmitAllotment);

  // Select Volunteer Confirmation Modal Bindings
  const selectVolunteerConfirmModal = document.getElementById('selectVolunteerConfirmModal');
  const selectVolunteerConfirmClose = document.getElementById('selectVolunteerConfirmClose');
  const btnCancelSelectVolunteer = document.getElementById('btnCancelSelectVolunteer');
  const btnConfirmSelectVolunteer = document.getElementById('btnConfirmSelectVolunteer');

  if (selectVolunteerConfirmClose) selectVolunteerConfirmClose.addEventListener('click', closeSelectVolunteerConfirmModal);
  if (btnCancelSelectVolunteer) btnCancelSelectVolunteer.addEventListener('click', closeSelectVolunteerConfirmModal);
  if (btnConfirmSelectVolunteer) btnConfirmSelectVolunteer.addEventListener('click', confirmSelectVolunteerAssignment);

  window.addEventListener('click', (e) => {
    if (e.target === rejectModal) closeRejectModal();
    if (e.target === shoppingPrefModal) closeShoppingPrefModal();
    if (e.target === selectVolunteerConfirmModal) closeSelectVolunteerConfirmModal();
  });

  // Initial load
  loadFamilyDashboard();

  // Listen for language change events to re-render the dashboard lists with updated translation templates
  window.addEventListener('languageChanged', () => {
    loadFamilyDashboard(true);
  });

  // Auto-refresh every 30 seconds
  pollInterval = setInterval(() => {
    loadFamilyDashboard(true); // silent refresh
  }, 30000);
});

// ──────────────────────────────────────────────────────────
// MAIN LOAD FUNCTION
// ──────────────────────────────────────────────────────────
async function loadFamilyDashboard(silent = false) {
  const elSenior = document.getElementById('seniorRequestsList');
  const elApproval = document.getElementById('approvalList');
  const elVerify = document.getElementById('completionVerificationList') || document.getElementById('verificationList');
  const elAll = document.getElementById('allRequestsList');

  if (!silent) {
    const spinnerHtml = `<div class="loading-wrapper"><div class="spinner"></div><span>Loading...</span></div>`;
    if (elSenior) elSenior.innerHTML = spinnerHtml;
    if (elApproval) elApproval.innerHTML = spinnerHtml;
    if (elVerify) elVerify.innerHTML = spinnerHtml;
    if (elAll) elAll.innerHTML = spinnerHtml;
  }

  const res = await apiCall('/family/dashboard', 'GET');

  if (!res.ok || !res.data.success) {
    const errMsg = res.data?.message || 'Could not load dashboard data.';
    if (elSenior) elSenior.innerHTML = showError(errMsg);
    if (elApproval) elApproval.innerHTML = showError(errMsg);
    if (elVerify) elVerify.innerHTML = showError(errMsg);
    if (elAll) elAll.innerHTML = showError(errMsg);
    return;
  }

  const { senior, requests, pendingApprovalCount } = res.data;

  // Build lookup maps of requests and volunteers for instant lookup
  currentVolunteersMap = {};
  currentRequestsMap = {};
  window.currentRequestsMap = currentRequestsMap;
  window.allRequestsMap = currentRequestsMap;
  if (requests && requests.length > 0) {
    requests.forEach(r => {
      const rId = String(r._id || r.id || '');
      if (rId) currentRequestsMap[rId] = r;

      if (r.volunteer && typeof r.volunteer === 'object') {
        const vId = String(r.volunteer._id || r.volunteer.id || '');
        if (vId) currentVolunteersMap[vId] = r.volunteer;
      }
      if (r.volunteerQuotes && r.volunteerQuotes.length > 0) {
        r.volunteerQuotes.forEach(q => {
          if (q.volunteer && typeof q.volunteer === 'object') {
            const vId = String(q.volunteer._id || q.volunteer.id || '');
            if (vId) currentVolunteersMap[vId] = q.volunteer;
          }
        });
      }
    });
  }

  // Show senior info banner
  populateSeniorBanner(senior);

  // Sync Caregiver Wallet Widget
  fetchAndRenderCaregiverWalletWidget();

  // Separate active senior requests (pending decision, allotted, accepted, in-progress) from volunteer quote approvals & receipt verifications
  const seniorRequests = requests.filter(r => 
    ( (r.status === 'pending' || r.status === 'awaiting_approval') && (!r.volunteerQuotes || r.volunteerQuotes.length === 0) ) ||
    r.status === 'accepted' ||
    r.status === 'purchase_cost_submitted' ||
    r.status === 'purchase_funded'
  );
  const volunteerApprovals = requests.filter(r => (r.status === 'pending' || r.status === 'awaiting_approval') && r.volunteerQuotes && r.volunteerQuotes.length > 0);
  const completionVerifications = requests.filter(r => (r.status === 'purchase_cost_submitted' || r.status === 'awaiting_verification' || (r.status === 'completed' && r.completionVerified !== 'verified' && r.completionVerified !== 'rejected')));

  // Caregiver action-required counts (badge only shown for these):
  // - New requests needing decision (pending/awaiting_approval with no quotes) = need to allot/fulfill/reject
  // - Volunteer quotes to approve (awaiting_approval with quotes)
  // - Purchase cost submitted (need to pay purchase amount + service fee)
  // - Receipt uploaded (need to verify & release service charge)
  const caregiverActionNeeded = requests.filter(r =>
    // New request: needs allot/fulfill/reject decision
    ( (r.status === 'pending' || r.status === 'awaiting_approval') && r.familyApprovalStatus !== 'approved' && (!r.volunteerQuotes || r.volunteerQuotes.length === 0) ) ||
    // Volunteer quoted: needs approval
    ( (r.status === 'pending' || r.status === 'awaiting_approval') && r.volunteerQuotes && r.volunteerQuotes.length > 0 ) ||
    // Volunteer submitted purchase cost: needs caregiver to pay
    r.status === 'purchase_cost_submitted' ||
    // Volunteer uploaded final receipt: needs caregiver to verify & release service charge
    r.status === 'awaiting_verification'
  );

  // Senior requests needing caregiver action/decision (undecided: not yet allotted/fulfilled/rejected)
  const seniorActionRequiredCount = seniorRequests.filter(r =>
    (r.status === 'pending' || r.status === 'awaiting_approval') &&
    r.familyApprovalStatus !== 'approved' &&
    r.familyApprovalStatus !== 'rejected' &&
    !r.fulfilledByFamily &&
    r.status !== 'fulfilled_by_family' &&
    r.status !== 'accepted' &&
    r.status !== 'purchase_funded' &&
    (!r.volunteerQuotes || r.volunteerQuotes.length === 0)
  ).length;

  const approvalsActionRequiredCount = volunteerApprovals.length;
  const verificationsActionRequiredCount = completionVerifications.filter(r =>
    r.status === 'purchase_cost_submitted' || r.status === 'awaiting_verification'
  ).length;

  // Helper to format tab counter badges based on section state & actionNeeded
  function updateFamilyNavBadge(el, count, actionNeeded = false, isHistory = false) {
    if (!el) return;
    el.textContent = count;
    el.dataset.actionNeeded = actionNeeded ? "true" : "false";
    el.dataset.isHistory = isHistory ? "true" : "false";
    if (isHistory) {
      el.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
    } else if (actionNeeded && count > 0) {
      // Blue and blinking animation ONLY when action is needed
      el.className = "bg-brand-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-xs badge-blink-active flex-shrink-0";
    } else if (count > 0) {
      // Once action has been taken (e.g. chosen among 3 options) -> neutral slate pill, NOT blue, NOT blinking
      el.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
    } else {
      el.className = "bg-slate-100 text-slate-400 text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0";
    }
  }

  // Update vertical navigation counts
  const elCountRequests = document.getElementById('countFamilyRequests');
  const elCountApprovals = document.getElementById('countFamilyApprovals');
  const elCountVerifications = document.getElementById('countFamilyVerifications');
  const elCountHistory = document.getElementById('countFamilyHistory');

  updateFamilyNavBadge(elCountRequests, seniorRequests.length, seniorActionRequiredCount > 0, false);
  updateFamilyNavBadge(elCountApprovals, volunteerApprovals.length, approvalsActionRequiredCount > 0, false);
  updateFamilyNavBadge(elCountVerifications, completionVerifications.length, verificationsActionRequiredCount > 0, false);
  updateFamilyNavBadge(elCountHistory, requests.length, false, true);

  // Update notification badge specifically for Volunteer Approvals section
  updateApprovalBadge(volunteerApprovals.length);

  // Update modular overview metric cards
  const statActionNeededEl = document.getElementById('statActionNeededCount');
  if (statActionNeededEl) statActionNeededEl.textContent = caregiverActionNeeded.length;

  const activeCount = requests.filter(r => r.status === 'accepted' || r.status === 'purchase_funded' || r.status === 'in_progress').length;
  const statActiveEl = document.getElementById('statActiveCount');
  if (statActiveEl) statActiveEl.textContent = activeCount;

  const completedCount = requests.filter(r => r.status === 'completed' || r.status === 'verified').length;
  const statCompletedEl = document.getElementById('statCompletedCount');
  if (statCompletedEl) statCompletedEl.textContent = completedCount;

  // Update document title for total pending CAREGIVER ACTIONS only
  const totalActions = caregiverActionNeeded.length;
  if (totalActions > 0) {
    document.title = `(${totalActions}) Action Needed – Family Portal | AgeWell`;
  } else {
    document.title = 'Family Caregiver Portal – AgeWell';
  }

  // Render senior release notifications banner
  renderSeniorReleaseNotifications(requests);

  // Render Senior Help Requests & Fulfillment Decisions (Section 1)
  renderSeniorHelpRequests(seniorRequests);

  // Render Volunteer Approvals & Quoted Fees (Section 2)
  renderApprovalQueue(volunteerApprovals);

  // Render completion verification queue (Section 3)
  renderCompletionVerificationQueue(completionVerifications);

  // Render full request history (Section 4)
  renderAllRequests(requests);

  // Maintain active tab (honors ?tab= URL param if returning from payment)
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab && ['requests', 'approvals', 'verifications', 'history'].includes(urlTab)) {
    window.currentFamilyTab = urlTab;
  }
  if (window.switchFamilyTab) {
    window.switchFamilyTab(window.currentFamilyTab || 'requests');
  }
}

// Global function to open volunteer profile card modal
async function viewVolunteerProfile(volId) {
  const vol = currentVolunteersMap[volId];
  const modal = document.getElementById('volunteerProfileModal');
  const detailsEl = document.getElementById('volunteerProfileDetails');
  if (!modal || !detailsEl) return;

  if (!vol) {
    detailsEl.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: #666;">
        <p style="font-weight: bold; font-size: 1.1rem; color: #c62828;">${t('fd_vol_details_unavail')}</p>
      </div>`;
    modal.style.display = 'flex';
    return;
  }

  const vName = escapeHTML(vol.name || 'Community Volunteer');
  const vPhone = escapeHTML(vol.phone || 'Not provided');
  const vEmail = escapeHTML(vol.email || 'Not provided');
  const isIdVerified = vol.isIdVerified === true || vol.isIdVerified === 'true';
  const isPoliceVerified = vol.isPoliceVerified === true || vol.isPoliceVerified === 'true';
  const isPhoneVerified = vol.isPhoneVerified === true || vol.isPhoneVerified === 'true';
  const isEmailVerified = vol.isEmailVerified === true || vol.isEmailVerified === 'true';
  const status = vol.verificationStatus || 'unverified';
  const isFullyVerified = status === 'verified' && isIdVerified && isPoliceVerified;

  // Fetch live calculated rating stats for this volunteer
  let stats = {
    reviewsCount: 0,
    tasksCompleted: 0,
    costUtilization: 0,
    speedTimeliness: 0,
    communication: 0,
    overallRating: 0,
    recommendationRate: 0
  };

  try {
    const statsRes = await apiCall(`/auth/volunteer-stats/${volId}`, 'GET');
    if (statsRes && statsRes.ok && statsRes.data && statsRes.data.stats) {
      stats = statsRes.data.stats;
    }
  } catch (err) {
    console.warn('Error fetching volunteer stats:', err);
  }

  const skillsHtml = (vol.skills && vol.skills.length > 0)
    ? vol.skills.map(s => `<span class="bg-brand-50 text-brand-700 border border-brand-200/80 font-bold text-xs px-3 py-1 rounded-xl shadow-2xs">${escapeHTML(s)}</span>`).join('')
    : `<span class="text-xs text-slate-400 italic">${t('fd_no_skills_listed')}</span>`;

  const memberSince = vol.createdAt ? new Date(vol.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : t('fd_registered_volunteer');
  const initials = (vName.split(' ').map(n => n[0]).join('').substring(0, 2) || 'V').toUpperCase();
  const ratingVal = stats.reviewsCount > 0 ? stats.overallRating.toFixed(1) : 'New';
  const ratingPill = stats.reviewsCount > 0
    ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-extrabold shadow-2xs">
         <span class="text-amber-500">★</span> ${ratingVal} / 5.0 <span class="text-slate-400 font-normal">(${stats.reviewsCount} reviews)</span>
       </span>`
    : `<span class="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 border border-brand-200 text-brand-700 rounded-full text-xs font-extrabold shadow-2xs">
         ★ New Volunteer
       </span>`;

  detailsEl.innerHTML = `
    <!-- Top Identity Card -->
    <div class="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-brand-50/40 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white flex items-center justify-center font-extrabold text-base shadow-sm flex-shrink-0">
          ${initials}
        </div>
        <div class="min-w-0">
          <h4 class="text-base font-extrabold text-slate-900 leading-tight truncate">${vName}</h4>
          <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
            <span class="inline-flex items-center gap-1 font-bold ${isFullyVerified ? 'text-emerald-700' : 'text-amber-700'}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
              ${isFullyVerified ? 'Verified Community Helper' : 'Verification In Progress'}
            </span>
            <span>&bull;</span>
            <span>Joined ${memberSince}</span>
          </div>
        </div>
      </div>
      <div>
        ${ratingPill}
      </div>
    </div>

    <!-- Performance Metrics Matrix -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <div class="p-3 bg-white rounded-xl border border-slate-200/80 text-center shadow-2xs">
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Tasks Done</span>
        <span class="text-base font-extrabold text-slate-900 block mt-0.5">${stats.tasksCompleted || 0}</span>
      </div>
      <div class="p-3 bg-white rounded-xl border border-slate-200/80 text-center shadow-2xs">
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Recommendation</span>
        <span class="text-base font-extrabold text-emerald-700 block mt-0.5">${stats.recommendationRate > 0 ? stats.recommendationRate + '%' : '100%'}</span>
      </div>
      <div class="p-3 bg-white rounded-xl border border-slate-200/80 text-center shadow-2xs">
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Speed &amp; Timeliness</span>
        <span class="text-base font-extrabold text-slate-900 block mt-0.5">${stats.speedTimeliness > 0 ? stats.speedTimeliness.toFixed(1) + ' / 5' : '5.0 / 5'}</span>
      </div>
      <div class="p-3 bg-white rounded-xl border border-slate-200/80 text-center shadow-2xs">
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Communication</span>
        <span class="text-base font-extrabold text-slate-900 block mt-0.5">${stats.communication > 0 ? stats.communication.toFixed(1) + ' / 5' : '5.0 / 5'}</span>
      </div>
    </div>

    <!-- Verification Checks Clearances -->
    <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5">
      <h5 class="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Verification Clearances
      </h5>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div class="flex items-center gap-2 p-2.5 rounded-xl ${isIdVerified ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80' : 'bg-slate-50 text-slate-600 border border-slate-200'} text-xs font-bold">
          <span class="${isIdVerified ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}">${isIdVerified ? '✓' : '•'}</span>
          <span>Government Photo ID: <strong>${isIdVerified ? 'Verified' : 'Pending'}</strong></span>
        </div>
        <div class="flex items-center gap-2 p-2.5 rounded-xl ${isPoliceVerified ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80' : 'bg-slate-50 text-slate-600 border border-slate-200'} text-xs font-bold">
          <span class="${isPoliceVerified ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}">${isPoliceVerified ? '✓' : '•'}</span>
          <span>Police Background: <strong>${isPoliceVerified ? 'Approved' : 'Pending'}</strong></span>
        </div>
        <div class="flex items-center gap-2 p-2.5 rounded-xl ${isPhoneVerified ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80' : 'bg-slate-50 text-slate-600 border border-slate-200'} text-xs font-bold">
          <span class="${isPhoneVerified ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}">${isPhoneVerified ? '✓' : '•'}</span>
          <span>Phone Verification: <strong>${isPhoneVerified ? 'Verified' : 'Unverified'}</strong></span>
        </div>
        <div class="flex items-center gap-2 p-2.5 rounded-xl ${isEmailVerified ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80' : 'bg-slate-50 text-slate-600 border border-slate-200'} text-xs font-bold">
          <span class="${isEmailVerified ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}">${isEmailVerified ? '✓' : '•'}</span>
          <span>Email Verification: <strong>${isEmailVerified ? 'Verified' : 'Unverified'}</strong></span>
        </div>
      </div>
    </div>

    <!-- Direct Contact Info -->
    <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5">
      <h5 class="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
        <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
        Direct Contact Details
      </h5>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</span>
            <span class="text-xs font-bold text-slate-900 block truncate">${vPhone}</span>
          </div>
          ${vol.phone ? `<a href="tel:${vPhone}" class="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex-shrink-0">Call</a>` : ''}
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
            <span class="text-xs font-bold text-slate-900 block truncate">${vEmail}</span>
          </div>
          ${vol.email ? `<a href="mailto:${vEmail}" class="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex-shrink-0">Email</a>` : ''}
        </div>
      </div>
    </div>

    <!-- Skills & Expertise -->
    <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
      <h5 class="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
        <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/></svg>
        Skills &amp; Service Areas
      </h5>
      <div class="flex gap-2 flex-wrap pt-0.5">
        ${skillsHtml}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

// ──────────────────────────────────────────────────────────
// SENIOR INFO BANNER
// ──────────────────────────────────────────────────────────
function populateSeniorBanner(senior) {
  if (!senior) return;

  const banner = document.getElementById('seniorInfoBanner');
  const nameEl = document.getElementById('linkedSeniorName');
  const phoneEl = document.getElementById('linkedSeniorPhone');
  const addressEl = document.getElementById('linkedSeniorAddress');
  const nameInlineEl = document.getElementById('seniorNameInline');
  const btnCallSenior = document.getElementById('btnCallSenior');

  if (banner) banner.style.display = 'block';
  if (nameEl) nameEl.textContent = senior.name;
  if (phoneEl) phoneEl.textContent = `Phone: ${senior.phone || 'Not available'}`;
  if (addressEl) addressEl.textContent = `Address: ${senior.address || 'Not available'}`;
  if (nameInlineEl) nameInlineEl.textContent = `${senior.name}'s`;
  if (btnCallSenior && senior.phone) {
    btnCallSenior.href = `tel:${senior.phone}`;
  }
}

// ──────────────────────────────────────────────────────────
// NOTIFICATION BADGE
// ──────────────────────────────────────────────────────────
function updateApprovalBadge(count) {
  const badge = document.getElementById('approvalBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function translateCategory(cat) {
  if (!cat) return '';
  const lower = cat.toLowerCase();
  if (lower.includes('grocery')) return t('skill_grocery');
  if (lower.includes('medical') || lower.includes('escort') || lower.includes('doctor')) return t('skill_medical');
  if (lower.includes('tech') || lower.includes('phone') || lower.includes('computer')) return t('skill_tech');
  if (lower.includes('house') || lower.includes('clean') || lower.includes('maid')) return t('skill_housekeeping');
  if (lower.includes('companion') || lower.includes('talk') || lower.includes('visit')) return t('skill_companionship');
  return t('skill_other');
}

function translateUrgency(urg) {
  if (!urg) return '';
  const lower = urg.toLowerCase();
  if (lower === 'low') return t('priority_low');
  if (lower === 'medium') return t('priority_medium');
  if (lower === 'high') return t('priority_high');
  if (lower === 'emergency' || lower === 'sos') return t('priority_emergency');
  return urg;
}

// ──────────────────────────────────────────────────────────
// RENDER SECTION 1: SENIOR HELP REQUESTS & FULFILLMENT DECISIONS
// ──────────────────────────────────────────────────────────
function renderSeniorHelpRequests(seniorRequests) {
  const container = document.getElementById('seniorRequestsList');
  const badge = document.getElementById('seniorReqBadge');
  if (!container) return;

  // Badge only counts requests where the caregiver MUST take action:
  // new undecided requests (not yet allotted/fulfilled/rejected)
  const actionRequiredCount = seniorRequests.filter(r =>
    (r.status === 'pending' || r.status === 'awaiting_approval') &&
    r.familyApprovalStatus !== 'approved' &&
    r.familyApprovalStatus !== 'rejected'
  ).length;

  if (badge) {
    if (actionRequiredCount > 0) {
      badge.textContent = actionRequiredCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (seniorRequests.length === 0) {
    container.innerHTML = `
      <div class="bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-3xl p-8 text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center shadow-xs">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <p class="text-base font-extrabold text-amber-900">${t('fd_no_requests')}</p>
        <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">${t('fd_no_requests_desc')}</p>
      </div>`;
    return;
  }

  container.innerHTML = seniorRequests.map(req => {
    const urgencyBadge = req.urgency === 'emergency'
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-extrabold tracking-wide shadow-2xs">
           <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
           Emergency: ${translateUrgency(req.urgency)}
         </span>`
      : req.urgency === 'high'
        ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold tracking-wide shadow-2xs">
             <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
             High Priority: ${translateUrgency(req.urgency)}
           </span>`
        : `<span class="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200/80 rounded-full text-xs font-bold shadow-2xs">
             ${translateUrgency(req.urgency)}
           </span>`;

    let statusBadge = '';
    let accentGradient = 'from-amber-400 to-amber-500';
    let actionAreaHtml = '';
    let footerHelpText = t('fd_action_footer_help');

    if (req.status === 'accepted') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        ${t('fd_assigned_in_progress')}
      </span>`;
      accentGradient = 'from-emerald-400 to-emerald-600';
      footerHelpText = t('fd_assigned_in_progress');

      const { vol, volName, volPhone, volEmail, volId } = resolveRequestVolunteer(req);

      actionAreaHtml = `
        <div class="mt-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
              </div>
              <span class="text-xs font-extrabold text-emerald-950">${t('fd_approved_volunteer')} <strong class="font-extrabold text-emerald-800">${escapeHTML(volName)}</strong></span>
            </div>
            ${volPhone ? `<p class="text-xs text-slate-600 font-medium pl-8">Phone: <a href="tel:${volPhone}" class="text-emerald-700 font-bold hover:underline">${volPhone}</a></p>` : ''}
            ${volEmail ? `<p class="text-xs text-slate-500 font-medium pl-8">Email: ${volEmail}</p>` : ''}
          </div>
          <div class="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button type="button" onclick="openShoppingPrefModal('${req._id}')" class="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
              <span>Edit Budget &amp; Pref</span>
            </button>
            ${volId ? `
              <button type="button" onclick="viewVolunteerProfile('${volId}')" class="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer">
                <svg class="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                ${t('btn_view_profile')}
              </button>` : ''}
          </div>
        </div>`;

    } else if (req.status === 'purchase_cost_submitted') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold shadow-2xs">
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        Store Payment Requested (₹${req.actualPurchaseCost || 0})
      </span>`;
      accentGradient = 'from-amber-400 to-amber-600';
      footerHelpText = 'Volunteer uploaded store payment info. Please pay the merchant directly or switch to Tab 3 for full receipt details.';

      const { vol, volName, volPhone, volEmail, volId } = resolveRequestVolunteer(req);
      const merchant = req.merchantDetails || {};
      const shopName = merchant.shopName || 'Merchant / Shop';

      actionAreaHtml = `
        <div class="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-3 shadow-2xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span class="text-xs font-extrabold text-amber-950 block">Pay Merchant: <strong>${escapeHTML(shopName)}</strong> (₹${req.actualPurchaseCost || 0})</span>
              <span class="text-xs text-slate-600 font-medium">Assisted by <strong>${escapeHTML(volName)}</strong> ${volPhone ? `(<a href="tel:${volPhone}" class="text-emerald-700 font-bold hover:underline">${volPhone}</a>)` : ''}</span>
            </div>
            <button
              type="button"
              onclick="directApprovePurchaseFunding('${req._id}', '${req.serviceFee || 0}', '${escapeHTML(volName).replace(/'/g, "\\'")}')"
              class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 border-none cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              <span>Confirm Merchant Paid ₹${req.actualPurchaseCost || 0}</span>
            </button>
          </div>
          ${merchant.upiQrImage ? `
            <div class="pt-2 border-t border-amber-200/60 flex items-center gap-3">
              <div class="relative cursor-pointer group flex-shrink-0" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(normalizeDocUrl(merchant.upiQrImage))}', '${req._id}'); return false;">
                <img src="${normalizeDocUrl(merchant.upiQrImage)}" alt="Store QR" class="w-20 h-20 object-contain rounded-xl border border-emerald-300 bg-white p-1 group-hover:scale-105 transition-transform shadow-2xs">
                <span class="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                  <svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"/></svg>
                  <span>Zoom</span>
                </span>
              </div>
              <div class="text-xs text-slate-700 font-medium">
                <span>Scan this QR with GPay / PhonePe / Paytm to pay <strong>₹${req.actualPurchaseCost || 0}</strong> directly to ${escapeHTML(shopName)}.</span>
                <div class="flex items-center gap-2 mt-1">
                  <button type="button" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(normalizeDocUrl(merchant.upiQrImage))}', '${req._id}'); return false;" class="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all">
                    <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>View Full Photo</span>
                  </button>
                  ${merchant.upiId ? `<span class="text-slate-900 font-bold">UPI ID: ${escapeHTML(merchant.upiId)}</span>` : ''}
                </div>
              </div>
            </div>` : (merchant.upiId ? `<div class="text-xs text-slate-800 font-bold">UPI ID: ${escapeHTML(merchant.upiId)}</div>` : '')}
        </div>`;

    } else if (req.status === 'purchase_funded') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${t('fd_purchase_funded_progress')}
      </span>`;
      accentGradient = 'from-emerald-400 to-emerald-600';
      footerHelpText = t('fd_purchase_funded_progress');

      const { vol, volName, volPhone, volEmail, volId } = resolveRequestVolunteer(req);

      const shopLabel = req.merchantDetails?.shopName ? ` to ${escapeHTML(req.merchantDetails.shopName)}` : '';
      actionAreaHtml = `
        <div class="mt-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div class="text-xs font-bold text-emerald-950">${t('fd_funded_purchase_cost')} <strong class="text-sm font-extrabold text-emerald-700">₹${req.actualPurchaseCost || 0}</strong><span class="text-slate-600 font-semibold text-[11px] ml-1.5">(Paid directly${shopLabel})</span></div>
            <div class="text-xs text-slate-600 mt-1">${t('fd_assisted_by')} <strong>${escapeHTML(volName)}</strong> ${volPhone ? `(<a href="tel:${volPhone}" class="text-emerald-700 font-bold hover:underline">${volPhone}</a>)` : ''} — Volunteer is now picking up items for delivery.</div>
          </div>
        </div>`;

    } else if (req.status === 'pending' && req.familyApprovalStatus === 'approved') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-brand-50 text-brand-700 border border-brand-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
        ${t('fd_seeking_help')}
      </span>`;
      accentGradient = 'from-brand-500 to-brand-600';
      footerHelpText = t('fd_seeking_help');
      actionAreaHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onclick="fulfillRequestSelf('${req._id}')"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            aria-label="Fulfill request yourself"
          >
            <svg class="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            <span class="whitespace-nowrap">${t('btn_fulfill_myself')}</span>
          </button>
          <button
            type="button"
            onclick="approveVolunteer('${req._id}')"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            aria-label="Update shopping preference"
          >
            <svg class="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>
            <span class="whitespace-nowrap">${t('btn_preference')}</span>
          </button>
          <button
            type="button"
            onclick="openRejectModal('${req._id}')"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            aria-label="Reject request"
          >
            <svg class="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            <span class="whitespace-nowrap">${t('fd_reject_request')}</span>
          </button>
        </div>`;

    } else {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        ${t('fd_awaiting_decision')}
      </span>`;
      accentGradient = 'from-amber-400 to-amber-600';
      actionAreaHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onclick="fulfillRequestSelf('${req._id}')"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            aria-label="Fulfill request yourself"
          >
            <svg class="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            <span class="whitespace-nowrap">${t('btn_fulfill_myself')}</span>
          </button>

          <button
            type="button"
            onclick="approveVolunteer('${req._id}')"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            aria-label="Allot to volunteers"
          >
            <svg class="w-4 h-4 text-white flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
            <span class="whitespace-nowrap">${t('btn_allot_volunteers')}</span>
          </button>

          <button
            type="button"
            onclick="openRejectModal('${req._id}')"
            class="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            aria-label="Reject request"
          >
            <svg class="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            <span class="whitespace-nowrap">${t('fd_reject_request')}</span>
          </button>
        </div>`;
    }

    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 mb-5 transition-all relative overflow-hidden group" id="seniorCard-${req._id}">
        <!-- Top accent gradient line -->
        <div class="h-1.5 bg-gradient-to-r ${accentGradient} -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

        <!-- Header: Title, Category & Metadata + Status Badges -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div class="space-y-1.5 flex-1 min-w-0">
            <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-brand-700 transition-colors">${escapeHTML(req.title)}</h3>
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
              <span class="inline-flex items-center gap-1.5 text-brand-700 font-bold bg-brand-50 border border-brand-200/60 px-2.5 py-1 rounded-xl">
                <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/></svg>
                <span>${translateCategory(req.category)}</span>
              </span>
              <span class="inline-flex items-center gap-1.5 text-slate-400 font-medium pl-1">
                <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>${new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </span>
            </div>
          </div>
          <div class="flex flex-col sm:items-end items-start gap-2 flex-shrink-0 sm:ml-auto">
            ${urgencyBadge}
            ${statusBadge}
          </div>
        </div>

        <!-- Description -->
        ${req.description && req.description !== req.title ? `
          <div class="text-sm font-medium text-slate-700 leading-relaxed mb-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100">
            ${escapeHTML(req.description)}
          </div>` : ''}

        <!-- Audio Player Callout: Studio Microphone Voice Note Design -->
        ${req.audioFile ? `
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
            <audio controls src="${req.audioFile}" class="h-10 w-full sm:w-72 max-w-full rounded-xl"></audio>
          </div>` : ''}

        <!-- Shopping Preference Callout -->
        ${req.shoppingPreference ? `
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.263-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <strong class="font-extrabold text-amber-950">${t('fd_shopping_preference') || 'Shopping Preference:'}</strong>
                <span class="text-amber-800 font-semibold">${escapeHTML(req.shoppingPreference)}</span>
              </div>
            </div>
          </div>` : ''}

        ${(req.allowedBudget !== undefined && req.allowedBudget !== null && Number(req.allowedBudget) > 0) ? `
          <div class="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs flex-wrap">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-extrabold text-xs">
                ₹
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <strong class="font-extrabold text-emerald-950">${t('fd_pref_allowed_budget') || 'Allowed Budget:'}</strong>
                <span class="text-emerald-700 font-extrabold text-sm">₹${req.allowedBudget}</span>
              </div>
            </div>
          </div>` : ''}

        <!-- Action Area -->
        ${actionAreaHtml}

        <!-- Footer Help Note -->
        <div class="text-[11px] font-semibold text-slate-400 mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
          <span>${footerHelpText}</span>
        </div>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// RENDER SECTION 2: VOLUNTEER APPROVALS & QUOTED FEES
// ──────────────────────────────────────────────────────────
function renderApprovalQueue(awaitingRequests) {
  const approvalList = document.getElementById('approvalList');
  if (!approvalList) return;

  if (awaitingRequests.length === 0) {
    approvalList.innerHTML = `
      <div class="bg-brand-50/50 border-2 border-dashed border-brand-200 rounded-3xl p-8 text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-brand-100/80 text-brand-700 flex items-center justify-center shadow-xs">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
        </div>
        <p class="text-base font-extrabold text-brand-950">${t('fd_no_volunteers')}</p>
        <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">${t('fd_no_volunteers_desc')}</p>
      </div>`;
    return;
  }

  approvalList.innerHTML = awaitingRequests.map(req => {
    const urgencyBadge = req.urgency === 'emergency'
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-extrabold tracking-wide shadow-2xs">
           <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
           Emergency: ${translateUrgency(req.urgency)}
         </span>`
      : req.urgency === 'high'
        ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold tracking-wide shadow-2xs">
             <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
             High Priority: ${translateUrgency(req.urgency)}
           </span>`
        : `<span class="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200/80 rounded-full text-xs font-bold shadow-2xs">
             ${translateUrgency(req.urgency)}
           </span>`;

    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 mb-5 transition-all relative overflow-hidden group" id="approvalCard-${req._id}">
        <!-- Top accent gradient line -->
        <div class="h-1 bg-gradient-to-r from-brand-600 to-brand-700 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

        <!-- Header: Title, Category & Metadata + Status Badges -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-brand-700 transition-colors">${escapeHTML(req.title)}</h3>
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
              <span class="inline-flex items-center gap-1.5 text-brand-700 font-bold bg-brand-50 border border-brand-200/60 px-2.5 py-0.5 rounded-lg">
                <svg class="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/></svg>
                ${translateCategory(req.category)}
              </span>
              <span>&bull;</span>
              <span class="inline-flex items-center gap-1 text-slate-500">
                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ${new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div class="flex flex-col sm:items-end items-start gap-2 flex-shrink-0 sm:ml-auto">
            ${urgencyBadge}
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              ${t('fd_pending_approval')}
            </span>
          </div>
        </div>

        <!-- Description -->
        ${req.description && req.description !== req.title ? `
          <div class="text-sm font-medium text-slate-700 leading-relaxed mb-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100">
            ${escapeHTML(req.description)}
          </div>` : ''}

        <!-- Audio Player Callout: Studio Microphone Voice Note Design -->
        ${req.audioFile ? `
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
            <audio controls src="${req.audioFile}" class="h-10 w-full sm:w-72 max-w-full rounded-xl"></audio>
          </div>` : ''}

        <!-- Shopping Preference Callout -->
        ${req.shoppingPreference ? `
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.263-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <strong class="font-extrabold text-amber-950">${t('fd_shopping_preference') || 'Shopping Preference:'}</strong>
                <span class="text-amber-800 font-semibold">${escapeHTML(req.shoppingPreference)}</span>
              </div>
            </div>
          </div>` : ''}

        ${(req.allowedBudget !== undefined && req.allowedBudget !== null && Number(req.allowedBudget) > 0) ? `
          <div class="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-extrabold text-xs">
                ₹
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <strong class="font-extrabold text-emerald-950">${t('fd_pref_allowed_budget') || 'Allowed Budget:'}</strong>
                <span class="text-emerald-700 font-extrabold text-sm">₹${req.allowedBudget}</span>
                <span class="text-[11px] text-emerald-800 font-medium">${t('fd_pref_allowed_budget_optional') || '(optional spend limit)'}</span>
              </div>
            </div>
          </div>` : ''}

        <!-- Quoted Volunteers Header -->
        <div class="mt-4 pt-4 border-t border-slate-100">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-extrabold uppercase tracking-wider text-brand-900 flex items-center gap-2">
              <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
              ${t('fd_volunteers_quoted_count', { count: (req.volunteerQuotes && req.volunteerQuotes.length) ? req.volunteerQuotes.length : 1 }) || 'Volunteers Quoted'}
            </span>
          </div>
          
          <div class="space-y-3">
            ${(() => {
              const quotes = (req.volunteerQuotes && req.volunteerQuotes.length > 0)
                ? req.volunteerQuotes
                : (req.volunteer ? [{ volunteer: req.volunteer, serviceFee: req.serviceFee || 0, volunteerNotes: req.volunteerNotes || '' }] : []);

              return quotes.map((q, idx) => {
                const volObj = q.volunteer;
                if (!volObj) return '';
                const vId = typeof volObj === 'object' ? (volObj._id || volObj.id) : volObj;
                const vName = typeof volObj === 'object' ? escapeHTML(volObj.name) : 'Volunteer ' + (idx + 1);
                const vPhone = typeof volObj === 'object' ? escapeHTML(volObj.phone || 'Not provided') : '—';
                const vEmail = typeof volObj === 'object' ? escapeHTML(volObj.email || 'Not provided') : '—';
                const vSkills = (typeof volObj === 'object' && volObj.skills && volObj.skills.length > 0)
                  ? volObj.skills.map(s => `<span class="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">${escapeHTML(s)}</span>`).join(' ')
                  : `<span class="text-[10px] text-slate-400 font-semibold">${t('fd_no_skills_listed')}</span>`;

                const feeText = (q.serviceFee !== undefined && q.serviceFee > 0) ? `₹${q.serviceFee}` : '₹0 (Voluntary)';
                const tasksCompleted = typeof volObj === 'object' ? (volObj.tasksCompleted || 0) : 0;
                
                let newVolunteerBadge = '';
                if (tasksCompleted === 0) {
                  newVolunteerBadge = `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md text-[10px] font-extrabold">
                      New Volunteer
                    </span>`;
                }

                return `
                  <div class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-white hover:border-brand-300 hover:shadow-xs">
                    <!-- Left: Volunteer details -->
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                      </div>
                      <div class="space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h4 class="text-sm font-extrabold text-slate-900">${vName}</h4>
                          ${newVolunteerBadge}
                          <button type="button" onclick="viewVolunteerProfile('${vId}')" class="px-2.5 py-0.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-[10px] font-bold transition-all">
                            ${t('btn_view_profile')}
                          </button>
                        </div>
                        <div class="text-xs text-slate-500 font-medium">Phone: <a href="tel:${vPhone}" class="text-brand-700 font-bold hover:underline">${vPhone}</a> &bull; Email: ${vEmail}</div>
                        <div class="pt-0.5 flex flex-wrap gap-1">${vSkills}</div>
                        ${q.volunteerNotes ? `<p class="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 mt-1.5">"${escapeHTML(q.volunteerNotes)}"</p>` : ''}
                      </div>
                    </div>

                    <!-- Right: Fee badge and Approval Button -->
                    <div class="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-2.5 flex-shrink-0">
                      <div class="px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-900">
                        ${t('fd_quoted_service_charge')} <strong class="text-sm font-extrabold text-emerald-700">${feeText}</strong>
                      </div>
                      <button
                        type="button"
                        onclick="openSelectVolunteerConfirmModal('${req._id}', '${vId}', '${escapeHTML(vName).replace(/'/g, "\\'")}', '${escapeHTML(feeText).replace(/'/g, "\\'")}', ${tasksCompleted === 0})"
                        class="w-full md:w-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        aria-label="Select and approve this volunteer"
                      >
                        <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        ${t('btn_select_approve_vol', { name: vName })}
                      </button>
                    </div>
                  </div>`;
              }).join('');
            })()}
          </div>
        </div>

        <!-- Additional Actions: Caregiver Decision -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onclick="fulfillRequestSelf('${req._id}')"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95"
            aria-label="Fulfill request yourself"
          >
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            ${t('btn_fulfill_myself')}
          </button>

          <button
            type="button"
            onclick="openRejectModal('${req._id}')"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95"
            aria-label="Reject volunteer requests"
          >
            <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            ${t('btn_reject_all_quotes')}
          </button>
        </div>

        <!-- Footer Help Note -->
        <p class="text-[11px] font-semibold text-slate-400 mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
          ${t('fd_select_vol_assigned_help')}
        </p>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// RENDER COMPLETION VERIFICATION QUEUE (RECEIPT & DELIVERY PHOTO)
// ──────────────────────────────────────────────────────────
function renderCompletionVerificationQueue(pendingVerifications) {
  const container = document.getElementById('completionVerificationList');
  const badge = document.getElementById('completionBadge');
  if (!container) return;

  // Badge only flashes for statuses where CAREGIVER must act:
  // - purchase_cost_submitted: caregiver needs to pay purchase amount + service fee
  // - awaiting_verification: caregiver needs to verify receipt & release service charge
  const actionNeededCount = pendingVerifications.filter(r =>
    r.status === 'purchase_cost_submitted' || r.status === 'awaiting_verification'
  ).length;

  if (badge) {
    if (actionNeededCount > 0) {
      badge.textContent = actionNeededCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (pendingVerifications.length === 0) {
    container.innerHTML = `
      <div class="bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-3xl p-8 text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shadow-xs">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p class="text-base font-extrabold text-emerald-950">${t('fd_no_verifications')}</p>
        <p class="text-xs font-semibold text-slate-500 max-w-md mx-auto">${t('fd_no_verifications_desc')}</p>
      </div>`;
    return;
  }

  container.innerHTML = pendingVerifications.map(req => {
    const vol = req.volunteer;
    const volName  = vol ? (typeof vol === 'object' ? vol.name : 'Assigned Volunteer') : 'Assigned Volunteer';
    const volId    = vol ? (typeof vol === 'object' ? (vol._id || vol.id) : vol) : '';
    const volPhone = vol ? (typeof vol === 'object' ? vol.phone || 'Phone not available' : '') : '';

    let resolvedFee = 0;
    // Prefer req.serviceFee only if it's a positive number (0 means "not set yet")
    if (req.serviceFee !== undefined && req.serviceFee !== null && Number(req.serviceFee) > 0) {
      resolvedFee = Number(req.serviceFee);
    } else if (req.volunteerQuotes && req.volunteerQuotes.length > 0) {
      // Find the accepted volunteer's quote, else fallback to first quote
      const volIdStr = volId ? String(volId) : '';
      let matchQ = volIdStr
        ? req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === volIdStr)
        : null;
      if (!matchQ) matchQ = req.volunteerQuotes[0];
      if (matchQ && matchQ.serviceFee) resolvedFee = Number(matchQ.serviceFee);
    }

    let cardContent = '';

    if (req.status === 'purchase_cost_submitted') {
      let proofImages = req.purchaseProofDocs && req.purchaseProofDocs.length > 0 
        ? req.purchaseProofDocs 
        : (req.purchaseProofDoc ? [req.purchaseProofDoc] : []);
      let proofSlider = renderProofSliderHtml(req._id, proofImages);

      const isZeroPurchaseCost = Number(req.actualPurchaseCost || 0) === 0;
      const merchant = req.merchantDetails || {};
      const shopName = merchant.shopName || 'Merchant / Shop';
      const isOnline = merchant.paymentType === 'online_link' || !!merchant.paymentLink;

      let merchantPaymentBlockHtml = '';
      if (isOnline && merchant.paymentLink) {
        merchantPaymentBlockHtml = `
          <!-- Online Merchant Payment Link Block -->
          <div class="p-4 bg-sky-50/90 border border-sky-200/90 rounded-2xl space-y-2.5">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-xs font-extrabold text-sky-950 flex items-center gap-1.5">
                <svg class="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
                Online Store Order / Checkout Link
              </span>
              ${merchant.orderNumber ? `<span class="text-[10px] font-black text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">Order #${escapeHTML(merchant.orderNumber)}</span>` : ''}
            </div>
            <p class="text-xs text-slate-700 font-medium">Click the button below to pay <strong>${escapeHTML(shopName)}</strong> directly on their online portal / app:</p>
            <div class="pt-1">
              <a href="${escapeHTML(merchant.paymentLink)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs no-underline transition-all active:scale-95">
                <span>Open &amp; Pay ${escapeHTML(shopName)} Online</span>
                <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
              </a>
            </div>
          </div>`;
      } else {
        // Offline Store with UPI QR / UPI ID
        const upiPayUrl = merchant.upiId ? `upi://pay?pa=${encodeURIComponent(merchant.upiId)}&pn=${encodeURIComponent(shopName)}&am=${req.actualPurchaseCost || 0}&cu=INR` : '';
        merchantPaymentBlockHtml = `
          <!-- Offline Merchant UPI QR Block -->
          <div class="p-4 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/></svg>
                Offline Shop UPI Payment Details (${escapeHTML(shopName)})
              </span>
              <span class="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">Scan &amp; Pay Merchant Directly</span>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-4">
              ${merchant.upiQrImage ? `
                <div class="p-2.5 bg-white rounded-2xl border border-emerald-300 shadow-2xs flex-shrink-0 text-center">
                  <div class="relative cursor-pointer group overflow-hidden rounded-xl" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(normalizeDocUrl(merchant.upiQrImage))}', '${req._id}'); return false;">
                    <img src="${normalizeDocUrl(merchant.upiQrImage)}" alt="Merchant UPI QR Code" class="w-36 h-36 object-contain rounded-xl mx-auto group-hover:scale-105 transition-transform">
                    <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <span class="text-white text-[11px] font-extrabold bg-black/80 backdrop-blur-xs px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                        <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"/></svg>
                        <span>Click to Enlarge</span>
                      </span>
                    </div>
                  </div>
                  <span class="text-[10px] font-black text-emerald-900 block mt-1">Merchant UPI QR</span>
                  <button type="button" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(normalizeDocUrl(merchant.upiQrImage))}', '${req._id}'); return false;" class="mt-2 w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-xl shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5 border-none cursor-pointer">
                    <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>View Full Photo</span>
                  </button>
                </div>` : ''}

              <div class="space-y-2 flex-1 text-left w-full">
                <p class="text-xs text-slate-700 font-medium">Scan this Merchant QR code using any UPI app (GPay / PhonePe / Paytm / BHIM) to pay <strong>₹${req.actualPurchaseCost || 0}</strong> directly to the shop.</p>
                ${merchant.upiId ? `
                  <div class="flex items-center gap-2 flex-wrap">
                    <button type="button"
                      onclick="copyUpiId('${escapeHTML(merchant.upiId)}')"
                      title="Click to copy UPI ID"
                      class="text-xs font-bold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5 group">
                      <span>UPI ID: <strong>${escapeHTML(merchant.upiId)}</strong></span>
                      <svg class="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
                    </button>
                    ${upiPayUrl ? `
                      <button type="button"
                        onclick="openInUpiApp('${upiPayUrl}', '${escapeHTML(merchant.upiId)}')"
                        class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 border-none cursor-pointer">
                        <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span>Open in UPI App</span>
                      </button>` : ''}
                  </div>` : ''}
              </div>
            </div>
          </div>`;
      }

      cardContent = `
        <div class="my-4 p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-4">
          <!-- Cost & Notes Strip -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-amber-200/70 shadow-2xs">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-100/90 border border-amber-300/80 text-amber-800 flex items-center justify-center flex-shrink-0 font-extrabold text-base">
                ₹
              </div>
              <div>
                <span class="text-[11px] font-bold text-amber-900/70 uppercase tracking-wider block">Pay to Merchant: ${escapeHTML(shopName)}</span>
                <span class="text-lg font-extrabold text-amber-950 leading-tight">₹${req.actualPurchaseCost || 0}</span>
              </div>
            </div>
            ${req.purchaseNotes ? `
              <div class="text-xs text-slate-600 italic sm:max-w-md bg-amber-50/50 px-3 py-1.5 rounded-lg border border-amber-100">
                <span class="font-bold text-amber-950 not-italic">Note:</span> "${escapeHTML(req.purchaseNotes)}"
              </div>` : ''}
          </div>

          <!-- Merchant Payment Details Box -->
          ${merchantPaymentBlockHtml}

          <!-- Photo Proof Section (Only displayed when separate bill/proof documents were uploaded) -->
          ${proofSlider ? `
          <div>
            <div class="text-xs font-bold text-amber-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
              <span>Uploaded Store Bill / Receipt</span>
            </div>
            ${proofSlider}
          </div>` : ''}

          <!-- Actions Bar -->
          <div class="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-amber-200/70 flex-wrap">
            <button 
              type="button" 
              onclick="openRejectRevisionModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', '${escapeHTML(req.category).replace(/'/g, "\\'")}')" 
              class="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
              <span>Request Revision</span>
            </button>
            
            <button 
              type="button" 
              onclick="directApprovePurchaseFunding('${req._id}', '${resolvedFee}', '${escapeHTML(volName).replace(/'/g, "\\'")}')" 
              class="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              <span>Confirm Merchant Paid ₹${req.actualPurchaseCost || 0}</span>
            </button>
          </div>
        </div>`;
    } else {
      // ── Proof-type-aware verification ────────────────────────────────────────
      const proofType = req.taskProofType || (
        req.category === 'Grocery Shopping' ? 'financial' :
        (req.category === 'Tech Support' || req.category === 'Housekeeping' || req.category === 'Companionship') ? 'service_only' : 'mixed'
      );
      const isServiceOnlyVerif = proofType === 'service_only' || (proofType === 'mixed' && !req.volunteerDeclaredPurchase);

      // Gather all merchant bills / receipts / QR codes that are already displayed in store/merchant sections
      const alreadyDisplayedDocs = new Set(
        (req.merchantPurchases || [])
          .map(p => p.receiptDoc ? normalizeDocUrl(p.receiptDoc) : null)
          .concat([
            req.merchantDetails?.upiQrImage ? normalizeDocUrl(req.merchantDetails.upiQrImage) : null,
            req.purchaseProofDoc ? normalizeDocUrl(req.purchaseProofDoc) : null
          ])
          .concat((req.purchaseProofDocs || []).map(normalizeDocUrl))
          .filter(Boolean)
      );

      let rawFinalImages = (req.deliveryProofDocs && req.deliveryProofDocs.length > 0)
        ? req.deliveryProofDocs
        : (req.finalReceiptDocs && req.finalReceiptDocs.length > 0
            ? req.finalReceiptDocs
            : (req.completionProof ? [req.completionProof] : []));

      // Only include explicit delivery photos that were not already shown as store receipts
      let finalImages = rawFinalImages
        .filter(Boolean)
        .map(normalizeDocUrl)
        .filter(img => img && img.length > 1 && !alreadyDisplayedDocs.has(img));

      let proofSlider = finalImages.length > 0 ? renderProofSliderHtml(req._id, finalImages, 'Delivery & Handover Photo') : '';

      if (isServiceOnlyVerif) {
        // ── SERVICE-ONLY: gate on whether service fee was pre-paid ──────────────
        const isPrePaid = !!req.serviceFeePrePaid;
        const volName = req.volunteer && typeof req.volunteer === 'object' ? req.volunteer.name : 'Assigned Volunteer';

        if (!isPrePaid && resolvedFee > 0) {
          // ── PAYMENT NOT YET MADE: show pay-now prompt ──────────────────────────
          cardContent = `
            <div class="my-4 p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-300/80 space-y-4">
              <!-- Warning banner -->
              <div class="flex items-start gap-3 p-3.5 bg-white rounded-xl border border-amber-200/70 shadow-2xs">
                <div class="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                </div>
                <div>
                  <span class="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">Service Fee Not Yet Paid</span>
                  <span class="text-lg font-extrabold text-slate-900 leading-tight">₹${resolvedFee} to ${escapeHTML(volName)}</span>
                  <p class="text-xs text-amber-800 mt-1">The volunteer has completed the task. Please pay the service fee to release their earnings.</p>
                </div>
              </div>

              <!-- Volunteer note -->
              ${req.resolutionNotes ? `
              <div class="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 font-medium">
                <span class="font-bold">Volunteer's note:</span> "${escapeHTML(req.resolutionNotes)}"
              </div>` : ''}

              ${proofSlider ? `
              <div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Photo submitted by volunteer</div>
                ${proofSlider}
              </div>` : ''}

              <!-- Actions -->
              <div class="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-amber-200/60">
                <button
                  type="button"
                  onclick="openReportIssueModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}');"
                  class="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                  <span>Service Not Performed</span>
                </button>

                <button
                  type="button"
                  onclick="window.location.href='/payment.html?requestId=${req._id}&type=service_fee_upfront&serviceFee=${resolvedFee}&volunteerName=${encodeURIComponent(volName)}';"
                  class="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
                  <span>Pay Service Fee ₹${resolvedFee} &amp; Release</span>
                </button>
              </div>
            </div>`;
        } else {
          // ── PAYMENT DONE: show task confirmation UI ────────────────────────────
          cardContent = `
            <div class="my-4 p-4 sm:p-5 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-4">
              <!-- Service confirmation banner -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-teal-200/70 shadow-2xs">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-teal-100/90 border border-teal-300/80 text-teal-700 flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div>
                    <span class="text-[11px] font-bold text-teal-900/70 uppercase tracking-wider block">Service Charge — Escrowed &amp; Ready</span>
                    <span class="text-lg font-extrabold text-slate-900 leading-tight">₹${resolvedFee > 0 ? resolvedFee : 0}</span>
                  </div>
                </div>
                ${req.resolutionNotes ? `
                <div class="text-xs text-slate-600 italic sm:max-w-md bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                  <span class="font-bold text-teal-700 not-italic">Volunteer's Completion Note:</span> "${escapeHTML(req.resolutionNotes)}"
                </div>` : ''}
              </div>

              <!-- Escrow badge -->
              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
                <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p><strong>₹${resolvedFee} is in escrow</strong> — confirm the service was performed to release it to the volunteer.</p>
              </div>

              ${proofSlider ? `
              <div>
                <div class="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                  <span>Photo Submitted by Volunteer</span>
                </div>
                ${proofSlider}
              </div>` : ''}

              <!-- Actions Bar -->
              <div class="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-teal-200/60">
                <button
                  type="button"
                  onclick="openReportIssueModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}');"
                  class="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                  <span>Service Not Performed</span>
                </button>

                <button
                  type="button"
                  onclick="verifyTaskCompletion('${req._id}', true);"
                  class="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  <span>Confirm Service Done &amp; Release ₹${resolvedFee > 0 ? resolvedFee : 0}</span>
                </button>
              </div>
            </div>`;
        }

      } else {
        // ── FINANCIAL: receipt verification UI ───────────────────────
        const authorizedBudget = Number(req.allowedBudget || 0);
        const purchases = req.merchantPurchases || [];
        let totalSpent = 0;
        if (purchases.length > 0) {
          totalSpent = purchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        } else if (req.actualPurchaseCost) {
          totalSpent = Number(req.actualPurchaseCost);
        }
        const unspentRefund = authorizedBudget > 0 ? Math.max(0, authorizedBudget - totalSpent) : 0;

        let purchasesHtml = '';
        if (purchases.length > 0) {
          purchasesHtml = `
            <div class="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-2xs space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
                  Itemized Merchant Purchases (${purchases.length})
                </span>
                <span class="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Total Spent: ₹${totalSpent}
                </span>
              </div>
              <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                ${purchases.map((p, idx) => `
                  <div class="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-[10px] flex-shrink-0">#${idx + 1}</span>
                      <div class="min-w-0">
                        <span class="font-extrabold text-slate-900 block truncate">${escapeHTML(p.merchant || 'Store')} — ₹${p.amount}</span>
                        <span class="text-[11px] text-slate-500 font-medium block truncate">${escapeHTML(p.itemName ? 'Item: ' + p.itemName : 'Paid from Escrow')}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      ${p.receiptDoc ? `
                        <button type="button" onclick="event.stopPropagation(); openImageLightbox('${normalizeDocUrl(p.receiptDoc)}'); return false;" class="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer border border-emerald-300 shadow-2xs flex items-center gap-1.5 active:scale-95">
                          <svg class="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span>View Bill</span>
                        </button>
                      ` : (p.noReceiptReason ? `
                        <span class="text-[10px] text-slate-500 font-semibold bg-slate-200/70 px-2 py-1 rounded-lg">No Bill (${escapeHTML(p.noReceiptReason)})</span>
                      ` : `<span class="text-[10px] text-slate-400 font-bold italic">No file needed</span>`)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        cardContent = `
          <div class="my-4 p-4 sm:p-5 rounded-3xl bg-slate-50/80 border border-slate-200/90 space-y-4 shadow-2xs">
            ${authorizedBudget > 0 ? `
              <!-- Escrow Financial Ledger -->
              <div class="grid grid-cols-3 gap-2 sm:gap-3 p-3.5 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80 text-center">
                <div class="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Allotted Fund</span>
                  <span class="text-sm sm:text-base font-black text-slate-900 block mt-0.5">₹${authorizedBudget}</span>
                </div>
                <div class="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Used in Stores</span>
                  <span class="text-sm sm:text-base font-black text-amber-700 block mt-0.5">₹${totalSpent}</span>
                </div>
                <div class="p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Unspent Balance</span>
                  <span class="text-sm sm:text-base font-black text-emerald-700 block mt-0.5">₹${unspentRefund}</span>
                </div>
              </div>
            ` : ''}

            <!-- Service Fee & Notes Strip -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center flex-shrink-0 font-extrabold text-lg shadow-2xs">
                  ₹
                </div>
                <div>
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Volunteer Service Charge to Release</span>
                  <span class="text-lg font-black text-slate-900 leading-tight">₹${resolvedFee > 0 ? resolvedFee : 0}</span>
                </div>
              </div>
              ${req.resolutionNotes ? `
                <div class="text-xs text-slate-600 sm:max-w-md bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span class="font-bold text-slate-800 block mb-0.5">Volunteer Notes:</span>
                  <span class="italic text-slate-700">"${escapeHTML(req.resolutionNotes)}"</span>
                </div>` : ''}
            </div>

            <!-- Itemized Purchases Breakdown (if present) -->
            ${purchasesHtml}

            <!-- Photo Proof Section -->
            ${proofSlider ? `
              <div>
                <div class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                  <span>Handover &amp; Delivery Photo Proof</span>
                </div>
                ${proofSlider}
              </div>
            ` : ''}

            <!-- Actions Bar -->
            <div class="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80">
              <button 
                type="button" 
                onclick="openReportIssueModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}')" 
                class="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                <span>Report Issue</span>
              </button>
              
              <button 
                type="button" 
                onclick="verifyTaskCompletion('${req._id}', true)" 
                class="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                <span>Verify &amp; Release Funds (₹${resolvedFee > 0 ? resolvedFee : 0})</span>
              </button>
            </div>
          </div>`;
      }
    }

    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 mb-5 transition-all relative overflow-hidden group" id="completionCard-${req._id}">
        <!-- Top accent gradient line -->
        <div class="h-1 bg-gradient-to-r from-emerald-500 to-emerald-600 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

        <!-- Header: Title, Category & Metadata + Status Badges -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-emerald-700 transition-colors">${escapeHTML(req.title)}</h3>
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
              <span class="inline-flex items-center gap-1.5 text-brand-700 font-bold bg-brand-50 border border-brand-200/60 px-2.5 py-0.5 rounded-lg">
                <svg class="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/></svg>
                ${translateCategory(req.category)}
              </span>
            </div>
          </div>
          <div class="flex flex-col sm:items-end items-start gap-2 flex-shrink-0 sm:ml-auto">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs whitespace-nowrap">
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ${t('fd_proof_verifications_title')}
            </span>
          </div>
        </div>

        ${cardContent}

        <!-- Volunteer Info Row -->
        <div class="mt-4 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
            </div>
            <div>
              <h4 class="text-xs font-extrabold text-slate-900">${escapeHTML(volName)}</h4>
              <p class="text-[11px] text-slate-500 font-medium">Phone: ${escapeHTML(volPhone)}</p>
            </div>
          </div>
          ${volId ? `
            <button type="button" onclick="viewVolunteerProfile('${volId}')" class="px-3 py-1.5 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold shadow-2xs transition-all">
              ${t('btn_view_profile')}
            </button>` : ''}
        </div>
      </div>`;
  }).join('');
}

let currentFeedbackRequestId = null;

// --- Report Issue Modal Handlers ---

window.openReportIssueModal = function(requestId, title) {
  const modal = document.getElementById('reportIssueModal');
  const reqIdInput = document.getElementById('reportIssueRequestId');
  const noteInput = document.getElementById('reportIssueNote');
  const titleEl = document.getElementById('reportIssueModalTitle');

  if (reqIdInput) reqIdInput.value = requestId;
  if (noteInput) noteInput.value = '';
  if (titleEl && title) {
    titleEl.textContent = `Report Issue: ${title}`;
  }

  // Reset preset button styling
  document.querySelectorAll('#reportIssuePresetChips button').forEach(b => {
    b.classList.remove('bg-rose-50', 'border-rose-300', 'text-rose-800');
    b.classList.add('bg-slate-50', 'border-slate-200', 'text-slate-700');
  });

  if (modal) {
    modal.style.display = 'flex';
  }
};

window.closeReportIssueModal = function() {
  const modal = document.getElementById('reportIssueModal');
  const reqIdInput = document.getElementById('reportIssueRequestId');
  const noteInput = document.getElementById('reportIssueNote');

  if (reqIdInput) reqIdInput.value = '';
  if (noteInput) noteInput.value = '';

  if (modal) {
    modal.style.display = 'none';
  }
};

window.setReportIssuePreset = function(presetText) {
  const noteInput = document.getElementById('reportIssueNote');
  if (noteInput) {
    if (noteInput.value.trim().length > 0) {
      noteInput.value = noteInput.value.trim() + '. ' + presetText;
    } else {
      noteInput.value = presetText;
    }
    noteInput.focus();
  }
};

window.handleReportIssueSubmit = async function(event) {
  if (event) event.preventDefault();

  const reqIdInput = document.getElementById('reportIssueRequestId');
  const noteInput = document.getElementById('reportIssueNote');
  const btnSubmit = document.getElementById('btnSubmitReportIssue');

  const requestId = reqIdInput ? reqIdInput.value : '';
  const reason = noteInput ? noteInput.value.trim() : '';

  if (!requestId) {
    showToast('Invalid request selection', 'error');
    return;
  }

  const finalReason = reason || 'Caregiver reported an issue with task completion.';

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting...';
  }

  try {
    const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
      approved: false,
      rejectionReason: finalReason
    });

    if (res.ok && res.data.success) {
      showToast('Issue reported. The volunteer has been notified to make corrections.', 'info');
      closeReportIssueModal();
      loadFamilyDashboard();
    } else {
      showToast(res.data?.message || 'Error updating completion status', 'error');
    }
  } catch (err) {
    console.error('Error reporting task completion issue:', err);
    showToast('Network error submitting issue report.', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        <span>Submit Issue &amp; Request Revision</span>
      `;
    }
  }
};

// Step 5: Caregiver verifies final receipt & releases volunteer service charge
// For service_only + serviceFeePrePaid tasks: service charge is already escrowed,
// so the API just flips it to RELEASED — no second payment needed.
async function verifyTaskCompletion(requestId, approved) {
  if (approved) {
    try {
      const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
        approved: true
      });
      if (res.ok && res.data.success) {
        currentFeedbackRequestId = requestId;
        let volName = 'Assigned Volunteer';
        let serviceFee = 0;
        let serviceFeePrePaid = false;
        let proofType = 'mixed';

        if (res.data.request) {
          if (res.data.request.volunteer) {
            volName = typeof res.data.request.volunteer === 'object' ? res.data.request.volunteer.name : 'Assigned Volunteer';
          }
          serviceFee = Number(res.data.request.serviceFee || 0);
          serviceFeePrePaid = !!res.data.request.serviceFeePrePaid;
          proofType = res.data.request.taskProofType || 'mixed';
        }

        // Check if unspent funds were returned as a refund
        const refundAmt = Number(res.data?.unspentRefund || 0);
        if (refundAmt > 0) {
          showToast(`💰 Unspent Task Refund: ₹${refundAmt.toLocaleString('en-IN')} has been returned to your AgeWell Wallet Available Balance!`, 'success');
        }

        if (serviceFeePrePaid || proofType === 'service_only') {
          // Service charge was pre-escrowed — no payment page needed
          showToast('Task confirmed & volunteer service charge released!', 'success');
          // Open feedback modal directly
          promptForVolunteerTip(requestId, volName, { serviceFee, itemsCost: 0, actionType: 'direct', skipTip: true });
        } else {
          showToast('Receipt verified & funds released successfully!', 'success');
          promptForVolunteerTip(requestId, volName, { serviceFee, itemsCost: 0, actionType: 'direct' });
        }
        await fetchAndRenderCaregiverWalletWidget();
      } else {
        alert(res.data?.message || 'Error verifying completion');
      }
    } catch (e) {
      console.error(e);
      alert('Network error verifying task');
    }
    return;
  }

  // If approved is false, open the report issue modal
  openReportIssueModal(requestId, 'Task Verification');
}

// --- Volunteer Feedback Modal Handlers ---

window.openFeedbackModal = function(volName) {
  const modal = document.getElementById('feedbackModal');
  const headingEl = document.getElementById('feedbackModalHeading');
  const nameEl = document.getElementById('feedbackVolunteerName');
  const cleanName = (volName && typeof volName === 'string' && volName.trim() && volName !== '{name}') 
    ? volName.trim() 
    : 'Assigned Volunteer';

  if (headingEl) {
    headingEl.innerHTML = `Feedback for <span id="feedbackVolunteerName" class="text-brand-600">${escapeHTML(cleanName)}</span>`;
  } else if (nameEl) {
    nameEl.textContent = cleanName;
  }
  initStarRatings();

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
  const note = document.getElementById('additionalFeedback');
  if (note) note.value = '';

  if (modal) {
    modal.style.display = 'flex';
  }
};

let pendingTipContext = null;

function promptForVolunteerTip(requestId, volName, options = {}) {
  pendingTipContext = {
    requestId,
    volName: volName || 'Assigned Volunteer',
    itemsCost: options.itemsCost || 0,
    serviceFee: options.serviceFee || 0,
    actionType: options.actionType || 'direct'
  };

  const modal = document.getElementById('askTipModal');
  const nameEl = document.getElementById('tipVolunteerName');
  if (nameEl) nameEl.textContent = pendingTipContext.volName;
  const inputEl = document.getElementById('customTipInput');
  if (inputEl) inputEl.value = 50;

  if (modal) {
    modal.style.display = 'flex';
  } else {
    skipTipAndAskRatings();
  }
}

window.selectTipPreset = function(amount, btnEl) {
  const inputEl = document.getElementById('customTipInput');
  if (inputEl) inputEl.value = amount;
  const btns = document.querySelectorAll('.btn-tip-preset');
  btns.forEach(b => {
    b.style.background = '#e8f5e9';
    b.style.color = '#2e7d32';
    b.style.borderColor = '#a5d6a7';
  });
  if (btnEl) {
    btnEl.style.background = '#2e7d32';
    btnEl.style.color = '#ffffff';
    btnEl.style.borderColor = '#2e7d32';
  }
};

window.onCustomTipInput = function(val) {
  const btns = document.querySelectorAll('.btn-tip-preset');
  btns.forEach(b => {
    b.style.background = '#e8f5e9';
    b.style.color = '#2e7d32';
    b.style.borderColor = '#a5d6a7';
  });
};

window.confirmTipAndRedirect = function() {
  const modal = document.getElementById('askTipModal');
  if (modal) modal.style.display = 'none';

  if (!pendingTipContext) return;
  const inputEl = document.getElementById('customTipInput');
  const tipAmount = Math.max(1, Number(inputEl ? inputEl.value : 50) || 50);

  const { requestId, itemsCost, serviceFee, volName } = pendingTipContext;
  pendingTipContext = null;

  // Proceed to payment page immediately for tip
  window.location.href = `/payment.html?requestId=${requestId}&type=tip&tipAmount=${tipAmount}&itemsCost=${itemsCost || 0}&serviceFee=${serviceFee || 0}&volunteerName=${encodeURIComponent(volName)}`;
};

window.skipTipAndAskRatings = function() {
  const modal = document.getElementById('askTipModal');
  if (modal) modal.style.display = 'none';

  // No tip chosen — show feedback/rating modal (once at the end)
  if (pendingTipContext) {
    const volName = pendingTipContext.volName;
    pendingTipContext = null;
    openFeedbackModal(volName);
  } else {
    loadFamilyDashboard();
  }
};

window.skipFeedbackAndGoHome = function() {
  const modal = document.getElementById('feedbackModal');
  if (modal) modal.style.display = 'none';

  pendingTipContext = null;
  loadFamilyDashboard();
};

window.setStarRating = function(metric, count) {
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
    scoreBadge.textContent = `${count} / 5`;
    scoreBadge.classList.remove('unrated');
  }
};

window.hoverStarRating = function(metric, count) {
  const ratingEl = document.querySelector(`.star-rating[data-metric="${metric}"]`);
  if (ratingEl) {
    const stars = ratingEl.querySelectorAll('.star');
    updateStars(stars, count);
  }
  const scoreBadge = document.getElementById(`${metric}Text`);
  if (scoreBadge) {
    scoreBadge.textContent = `${count} / 5`;
    scoreBadge.classList.remove('unrated');
  }
};

window.resetStarRating = function(metric) {
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
      scoreBadge.textContent = `${currentVal} / 5`;
      scoreBadge.classList.remove('unrated');
    } else {
      scoreBadge.textContent = 'Select Rating';
      scoreBadge.classList.add('unrated');
    }
  }
};

function initStarRatings() {
  ['costUtilization', 'speedTimeliness', 'communication'].forEach(metric => {
    resetStarRating(metric);
  });
}

function updateStars(stars, activeVal) {
  stars.forEach(s => {
    const val = parseInt(s.getAttribute('data-val'), 10);
    if (activeVal > 0 && val <= activeVal) {
      s.style.color = '#f59e0b';
    } else {
      s.style.color = '#d1d5db';
    }
  });
}

window.selectPill = function(btnOrLabel, groupName, value) {
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
};

window.handleFeedbackSubmit = async function(event) {
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
  const taskCompletion = taskCompletionRadio ? taskCompletionRadio.value : (document.getElementById('taskCompletionVal')?.value || 'Completely');
  const chooseAgainRadio = document.querySelector('input[name="chooseAgain"]:checked');
  const chooseAgain = chooseAgainRadio ? chooseAgainRadio.value : (document.getElementById('chooseAgainVal')?.value || 'Yes');
  const additionalFeedback = document.getElementById('additionalFeedback')?.value || '';

  if (currentFeedbackRequestId) {
    try {
      await apiCall(`/requests/${currentFeedbackRequestId}/feedback`, 'PUT', {
        costUtilization: Number(costUtilization),
        speedTimeliness: Number(speedTimeliness),
        taskCompletion,
        communication: Number(communication),
        chooseAgain,
        additionalFeedback
      });
      showToast('Thank you! Your rating and review have been submitted.', 'success');
    } catch (err) {
      console.error('Error submitting volunteer feedback:', err);
    }
  }

  const modal = document.getElementById('feedbackModal');
  if (modal) modal.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Submit Rating & Finish';
  }
  loadFamilyDashboard();
};

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

window.proofSliderData = window.proofSliderData || {};
window.proofSliderIndex = window.proofSliderIndex || {};

function renderProofSliderHtml(reqId, rawImages, titleLabel = 'Delivery & Handover Photo Proof') {
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
    <div class="p-3 sm:p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 group/proof transition-all hover:bg-slate-100/70">
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative rounded-xl overflow-hidden bg-slate-200 border border-slate-300 flex-shrink-0 cursor-pointer shadow-2xs group-hover/proof:scale-105 transition-transform" style="width:52px;height:52px;min-width:52px;" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(firstImg)}', '${reqId}'); return false;" title="Click to view image">
          <img src="${escapeHTML(firstImg)}" alt="Receipt Thumbnail" class="w-full h-full object-cover">
          ${count > 1 ? `<span class="absolute bottom-0.5 right-0.5 bg-slate-900/85 text-white text-[9px] font-black px-1 rounded shadow-xs">+${count - 1}</span>` : ''}
        </div>
        <div class="min-w-0">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Attached Photo Proof</span>
          <span class="text-xs sm:text-sm font-extrabold text-slate-800 truncate block">${escapeHTML(titleLabel)}</span>
          <span class="text-[11px] text-slate-500 font-semibold block">${count} photo${count > 1 ? 's' : ''} uploaded</span>
        </div>
      </div>
      <button 
        type="button" 
        onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(firstImg)}', '${reqId}'); return false;" 
        class="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer active:scale-95"
      >
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>View Image${count > 1 ? 's' : ''}</span>
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

window.directReleaseServiceCharge = async function(requestId, feeAmount, volName) {
  try {
    const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
      approved: true,
      paymentDetails: {
        amountPaid: Number(feeAmount || 0),
        itemsCost: 0,
        volunteerFee: Number(feeAmount || 0),
        platformFee: 0,
        transactionId: `TXN${Math.floor(10000000 + Math.random() * 90000000)}`,
        paymentMethod: 'Escrow Release'
      }
    });

    if (res.ok && res.data.success) {
      const refundAmt = Number(res.data?.unspentRefund || 0);
      if (refundAmt > 0) {
        showToast(`💰 Unspent Task Refund: ₹${refundAmt.toLocaleString('en-IN')} returned to your AgeWell Wallet Available Balance!`, 'success');
      }
      showToast('Volunteer service charge released!', 'success');
      currentFeedbackRequestId = requestId;
      let resolvedVolName = volName || 'Assigned Volunteer';
      if (res.data.request && res.data.request.volunteer) {
        resolvedVolName = typeof res.data.request.volunteer === 'object' ? res.data.request.volunteer.name : resolvedVolName;
      }
      await fetchAndRenderCaregiverWalletWidget();
      // Open TIP modal first. After tip decision → feedback modal (once at end).
      promptForVolunteerTip(requestId, resolvedVolName, { serviceFee: feeAmount, itemsCost: 0, actionType: 'direct' });
    } else {
      alert(res.data?.message || 'Error releasing service charge');
    }
  } catch (e) {
    console.error(e);
    alert('Network error releasing service charge');
  }
};

// Zero-cost purchase task: just call approve-purchase-funding API to mark as funded
window.directApprovePurchaseFunding = async function(requestId, serviceFee, volName) {
  try {
    const res = await apiCall(`/requests/${requestId}/approve-purchase-funding`, 'PUT', {
      paymentMethod: 'Escrow Release',
      transactionId: `TXN${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    if (res.ok && res.data.success) {
      showToast('Purchase approved! Volunteer can now complete the task.', 'success');
      loadFamilyDashboard();
    } else {
      alert(res.data?.message || 'Error approving purchase funding');
    }
  } catch (e) {
    console.error(e);
    alert('Network error approving purchase funding');
  }
};

// Step 2: Caregiver approves payment for actual purchase cost → sends to payment page
// Payment page charges: purchase amount + service fee only. No tip at this stage.
window.approvePurchaseFunding = function(requestId, amount, serviceFee, volName) {
  if (Number(amount || 0) === 0) {
    // If purchase cost is zero, just approve-purchase-funding on backend and move forward
    directApprovePurchaseFunding(requestId, serviceFee, volName);
    return;
  }
  // Redirect to payment page with purchase amount + service fee. Tip NOT included here.
  window.location.href = `/payment.html?requestId=${requestId}&type=purchase&itemsCost=${amount}&serviceFee=${serviceFee || 0}&volunteerName=${encodeURIComponent(volName || 'Assigned Volunteer')}`;
};

// Step 5: Caregiver verifies completion & pays volunteer service fee via Razorpay
window.redirectToCompletionPayment = function(requestId, serviceFee, volName) {
  window.location.href = `/payment.html?requestId=${requestId}&type=completion&serviceFee=${serviceFee || 0}&volunteerName=${encodeURIComponent(volName || 'Assigned Volunteer')}`;
};

window.directReleaseServiceCharge = function(requestId, serviceFee, volName) {
  window.redirectToCompletionPayment(requestId, serviceFee, volName);
};

// Open Custom Modal Tab for Requesting Purchase Cost Revision & Sending Bargain Note
window.openRejectRevisionModal = function(requestId, requestTitle, requestCategory) {
  console.log('openRejectRevisionModal called for requestId:', requestId, requestTitle);
  const modal = document.getElementById('rejectRevisionModal');
  const reqIdInput = document.getElementById('rejectRevisionRequestId');
  const noteInput = document.getElementById('revisionNoteInput');
  const subtitleEl = document.getElementById('rejectRevisionModalSubtitle');

  if (reqIdInput) reqIdInput.value = requestId;
  if (noteInput) noteInput.value = '';

  const cleanTitle = (requestTitle || 'this task').trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const lowerCat = (requestCategory || '').toLowerCase();

  let dynamicExample = '';
  if (lowerTitle.includes('tomato') || lowerTitle.includes('vegetable') || lowerTitle.includes('grocery') || lowerCat.includes('grocery')) {
    dynamicExample = `Please type your feedback or instructions for the volunteer (e.g. <em>"Please bargain for ₹60/kg for ${escapeHTML(cleanTitle)} at local market"</em> or <em>"Please select fresh organic quality items"</em>):`;
  } else if (lowerTitle.includes('medicine') || lowerTitle.includes('tablet') || lowerTitle.includes('crocin') || lowerCat.includes('medical')) {
    dynamicExample = `Please type your feedback or instructions for the volunteer (e.g. <em>"Please check if generic brand is available cheaper for ${escapeHTML(cleanTitle)}"</em> or <em>"Please buy from trusted pharmacy"</em>):`;
  } else {
    dynamicExample = `Please type your feedback or instructions for the volunteer (e.g. <em>"Please bargain for lower price on ${escapeHTML(cleanTitle)}"</em> or <em>"Please check item quality before purchasing"</em>):`;
  }

  if (subtitleEl) subtitleEl.innerHTML = dynamicExample;

  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error('rejectRevisionModal element not found in DOM!');
  }
};

window.closeRejectRevisionModal = function() {
  const modal = document.getElementById('rejectRevisionModal');
  if (modal) modal.style.display = 'none';
};

window.submitPurchaseCostRevision = async function() {
  const reqIdInput = document.getElementById('rejectRevisionRequestId');
  const noteInput = document.getElementById('revisionNoteInput');

  const requestId = reqIdInput ? reqIdInput.value : '';
  const reasonStr = noteInput ? noteInput.value.trim() : '';

  if (!requestId) {
    showToast('Invalid request selection', 'error');
    return;
  }

  const noteStr = reasonStr || 'Caregiver requested purchase price or item quality revision.';

  try {
    const res = await apiCall(`/requests/${requestId}/reject-purchase-cost`, 'PUT', {
      rejectionReason: noteStr
    });
    if (res.ok && res.data.success) {
      closeRejectRevisionModal();
      showToast('Revision note sent to volunteer! Task returned for updated cost/proof.', 'info');
      loadFamilyDashboard();
    } else {
      alert(res.data?.message || 'Error rejecting purchase cost');
    }
  } catch (e) {
    console.error(e);
    alert('Network error submitting feedback note');
  }
};

// ── Caregiver Wallet Live Synchronization Widget ─────────────────────────────
async function fetchAndRenderCaregiverWalletWidget() {
  try {
    const res = await apiCall('/wallet/caregiver', 'GET');
    if (res.ok && res.data && res.data.success && res.data.wallet) {
      const w = res.data.wallet;
      const avail = Number(w.availableBalance || 0);
      const resvd = Number(w.reservedBalance || 0);
      const total = Number(w.totalBalance || (avail + resvd));

      const headerEl = document.getElementById('headerWalletBal');
      if (headerEl) headerEl.textContent = `₹${avail.toLocaleString('en-IN')}`;

      const wAvail = document.getElementById('widgetAvailableBalance');
      const wResvd = document.getElementById('widgetReservedBalance');
      const wTotal = document.getElementById('widgetTotalBalance');

      if (wAvail) wAvail.textContent = `₹${avail.toLocaleString('en-IN')}`;
      if (wResvd) wResvd.textContent = `₹${resvd.toLocaleString('en-IN')}`;
      if (wTotal) wTotal.textContent = `₹${total.toLocaleString('en-IN')}`;

      window.caregiverAvailableWalletBalance = avail;
    }
  } catch (err) {
    console.warn('Wallet widget sync error:', err);
  }
}
window.fetchAndRenderCaregiverWalletWidget = fetchAndRenderCaregiverWalletWidget;

// Caregiver Fulfills Request Self Action
async function fulfillRequestSelf(requestId) {
  const res = await apiCall(`/requests/${requestId}/family-fulfill`, 'PUT');

  if (res.ok && res.data.success) {
    showToast('Request marked as fulfilled by you! Your senior has been notified.', 'success');
    loadFamilyDashboard();
  } else {
    showToast(res.data?.message || 'Error updating request fulfillment status.', 'error');
  }
}

function numberToWords(num) {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero Rupees Only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(val) {
    let str = '';
    if (val >= 100) {
      str += single[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += single[val] + ' ';
    }
    return str;
  }

  let result = '';
  if (n >= 10000000) {
    result += convertChunk(Math.floor(n / 10000000)) + 'Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    result += convertChunk(Math.floor(n / 100000)) + 'Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    result += convertChunk(Math.floor(n / 1000)) + 'Thousand ';
    n %= 1000;
  }
  if (n > 0) {
    result += convertChunk(n);
  }

  return result.trim() + ' Rupees Only';
}

// ──────────────────────────────────────────────────────────
// RENDER ALL REQUESTS HISTORY
// ──────────────────────────────────────────────────────────
function renderAllRequests(requests) {
  const allRequestsList = document.getElementById('allRequestsList');
  if (!allRequestsList) return;

  if (requests.length === 0) {
    allRequestsList.innerHTML = `<div style="text-align: center; color: #666; padding: 2rem;">${t('fd_no_history')}</div>`;
    return;
  }

  // Sort requests: Active tasks FIRST (most recently created active request at position #1), followed by completed/historical requests
  const completedStatuses = ['completed', 'fulfilled_by_family', 'rejected', 'cancelled'];

  const sortedRequests = [...requests].sort((a, b) => {
    const aDone = completedStatuses.includes(a.status) || a.fulfilledByFamily || a.familyApprovalStatus === 'rejected';
    const bDone = completedStatuses.includes(b.status) || b.fulfilledByFamily || b.familyApprovalStatus === 'rejected';

    // Active requests FIRST
    if (!aDone && bDone) return -1;
    if (aDone && !bDone) return 1;

    // Newer requests first
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  allRequestsList.innerHTML = sortedRequests.map(req => {
    let statusBadge = '';
    let accentGradient = 'from-slate-300 to-slate-400';

    const isFulfilledByFamily = req.status === 'fulfilled_by_family' || req.fulfilledByFamily;

    if (isFulfilledByFamily) {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        ${t('btn_fulfill_myself')}
      </span>`;
      accentGradient = 'from-emerald-400 to-emerald-600';
    } else if (req.status === 'cancelled') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        Cancelled by Senior
      </span>`;
      accentGradient = 'from-rose-400 to-rose-600';
    } else if (req.status === 'pending') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
        ${t('fd_seeking_help')}
      </span>`;
      accentGradient = 'from-brand-500 to-brand-600';
    } else if (req.status === 'awaiting_approval') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        ${t('fd_awaiting_decision')}
      </span>`;
      accentGradient = 'from-amber-400 to-amber-600';
    } else if (req.status === 'accepted') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        ${t('fd_assigned_in_progress')}
      </span>`;
      accentGradient = 'from-emerald-400 to-emerald-600';
    } else if (req.status === 'purchase_cost_submitted') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        ${t('fd_vol_submitted_purchase_cost') || 'Submitted Cost'} (₹${req.actualPurchaseCost || 0})
      </span>`;
      accentGradient = 'from-amber-400 to-amber-600';
    } else if (req.status === 'purchase_funded') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${t('fd_purchase_funded_progress')} (₹${req.actualPurchaseCost || 0})
      </span>`;
      accentGradient = 'from-emerald-400 to-emerald-600';
    } else if (req.status === 'awaiting_verification') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        ${t('fd_proof_verifications_title')}
      </span>`;
      accentGradient = 'from-purple-400 to-purple-600';
    } else if (req.status === 'completed') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${t('status_completed')}
      </span>`;
      accentGradient = 'from-emerald-500 to-emerald-600';
    }

    // Status timeline: Submitted -> Volunteer Assigned -> Purchase Funded -> Service In Progress -> Delivered and Paid -> Completed
    const isVolAssigned = Boolean(req.volunteer) || req.status !== 'pending';
    const isPurchaseFunded = Boolean(req.purchasePaymentDetails || req.purchaseFunded || req.status === 'purchase_funded' || req.status === 'awaiting_verification' || req.status === 'completed');
    const isServiceInProgress = req.status === 'accepted' || req.status === 'purchase_cost_submitted' || isPurchaseFunded;
    const isDeliveredAndPaid = req.status === 'awaiting_verification' || req.status === 'completed' || req.serviceChargeReleased;
    const isCompleted = req.status === 'completed';

    let timelineHtml = '';
    if (isFulfilledByFamily) {
      timelineHtml = `
        <div class="mt-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
          <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Fulfillment Progress</span>
          </div>
          <div class="flex items-center justify-between gap-1.5 text-xs">
            <div class="flex items-center gap-1.5 font-bold text-emerald-700">
              <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shadow-2xs">✓</span>
              <span>Requested</span>
            </div>
            <div class="h-0.5 flex-1 bg-emerald-300 mx-1"></div>
            <div class="flex items-center gap-1.5 font-bold text-emerald-700">
              <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shadow-2xs">✓</span>
              <span>Fulfilled Personally</span>
            </div>
            <div class="h-0.5 flex-1 bg-emerald-300 mx-1"></div>
            <div class="flex items-center gap-1.5 font-extrabold text-emerald-800">
              <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">✓</span>
              <span>Completed</span>
            </div>
          </div>
        </div>`;
    } else {
      const steps = [
        { label: 'Requested', done: true, current: false },
        { label: 'Assigned', done: isVolAssigned, current: req.status === 'awaiting_approval' },
        { label: 'Funded', done: isPurchaseFunded, current: req.status === 'purchase_cost_submitted' },
        { label: 'Delivered', done: isDeliveredAndPaid, current: req.status === 'awaiting_verification' },
        { label: 'Completed', done: isCompleted, current: false }
      ];

      const stepsHtml = steps.map((s, idx) => {
        let nodeClass = 'bg-slate-100 text-slate-400 border border-slate-200';
        let textClass = 'text-slate-400 font-medium';
        let icon = `${idx + 1}`;

        if (s.done) {
          nodeClass = 'bg-emerald-600 text-white shadow-2xs';
          textClass = 'text-emerald-800 font-bold';
          icon = '✓';
        } else if (s.current) {
          nodeClass = 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-2xs animate-pulse';
          textClass = 'text-amber-800 font-extrabold';
        }

        const connector = idx < steps.length - 1 ? `
          <div class="h-0.5 flex-1 mx-1 transition-colors ${s.done && steps[idx + 1].done ? 'bg-emerald-500' : (s.done ? 'bg-emerald-200' : 'bg-slate-200')}"></div>
        ` : '';

        return `
          <div class="flex items-center flex-1 last:flex-initial">
            <div class="flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${nodeClass}">
                ${icon}
              </span>
              <span class="text-[11px] sm:text-xs whitespace-nowrap ${textClass}">${s.label}</span>
            </div>
            ${connector}
          </div>
        `;
      }).join('');

      timelineHtml = `
        <div class="mt-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80">
          <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>
              Task Progress Lifecycle
            </span>
            <span class="text-slate-500 font-bold capitalize text-[11px]">${req.status.replace(/_/g, ' ')}</span>
          </div>
          <div class="flex items-center justify-between overflow-x-auto pt-1 pb-0.5 gap-1">
            ${stepsHtml}
          </div>
        </div>`;
    }

    let volunteerInfo = '';
    const volResolved = resolveRequestVolunteer(req);
    if (volResolved.vol && (req.status === 'accepted' || req.status === 'purchase_cost_submitted' || req.status === 'purchase_funded' || req.status === 'awaiting_verification' || req.status === 'completed' || req.status === 'awaiting_approval')) {
      const vName = volResolved.volName;
      const vId = volResolved.volId;
      const feeLabel = (req.serviceFee !== undefined && req.serviceFee > 0) ? `₹${req.serviceFee}` : '₹0 (Voluntary)';

      volunteerInfo = `
        <div class="mt-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
          <div class="flex justify-between items-center flex-wrap gap-2">
            <span class="text-xs font-bold text-slate-900">${t('fd_approved_volunteer')} <strong class="text-brand-800">${escapeHTML(vName)}</strong></span>
            ${vId ? `<button type="button" onclick="viewVolunteerProfile('${vId}')" class="px-2.5 py-0.5 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-[10px] font-bold transition-all">${t('btn_view_profile')}</button>` : ''}
          </div>
          <p class="text-xs text-slate-600 font-medium">${t('fd_quoted_service_charge') || 'Quoted Fee'}: <strong class="text-emerald-700">${feeLabel}</strong></p>
          ${req.status !== 'awaiting_approval' && volResolved.volPhone ? `<p class="text-xs text-slate-500 font-medium">Contact: ${escapeHTML(volResolved.volPhone)}</p>` : ''}
          ${req.volunteerNotes ? `<p class="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 mt-1">"${escapeHTML(req.volunteerNotes)}"</p>` : ''}
          ${req.status === 'completed' && req.resolutionNotes ? `<p class="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 mt-1">${escapeHTML(req.resolutionNotes)}</p>` : ''}
        </div>`;
    }

    let purchasesHistoryHtml = '';
    const purchases = req.merchantPurchases || [];
    if (purchases.length > 0) {
      purchasesHistoryHtml = `
        <div class="mt-3 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
              Merchant Store Purchases (${purchases.length})
            </span>
          </div>
          <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            ${purchases.map((p, idx) => `
              <div class="p-2.5 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div class="min-w-0">
                  <span class="font-extrabold text-slate-900 block truncate">${escapeHTML(p.merchant || 'Store')} — ₹${p.amount}</span>
                  <span class="text-[11px] text-slate-500 font-medium block truncate">${escapeHTML(p.itemName ? 'Item: ' + p.itemName : 'Paid from Escrow')}</span>
                </div>
                ${p.receiptDoc ? `
                  <button type="button" onclick="event.stopPropagation(); openImageLightbox('${normalizeDocUrl(p.receiptDoc)}'); return false;" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-lg transition-all border border-emerald-200 flex items-center gap-1 flex-shrink-0 cursor-pointer">
                    <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>Bill</span>
                  </button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let totalSpentHtml = '';
    if (req.status === 'completed') {
      const serviceFeeVal = Number((req.serviceFee !== undefined && req.serviceFee !== null)
        ? req.serviceFee
        : ((req.volunteerQuotes && req.volunteerQuotes[0] && req.volunteerQuotes[0].serviceFee !== undefined)
          ? req.volunteerQuotes[0].serviceFee
          : (req.paymentDetails ? req.paymentDetails.volunteerFee : 0))) || 0;

      let storePurchasesTotal = 0;
      if (purchases.length > 0) {
        storePurchasesTotal = purchases.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      }

      const itemCostVal = storePurchasesTotal > 0 ? storePurchasesTotal : Number((req.actualPurchaseCost !== undefined && req.actualPurchaseCost !== null)
        ? req.actualPurchaseCost
        : (req.purchasePaymentDetails ? req.purchasePaymentDetails.amountPaid : (req.paymentDetails ? req.paymentDetails.itemsCost : 0))) || 0;

      let tipVal = Number(req.tipAmount || (req.paymentDetails ? req.paymentDetails.tipAmount : 0) || (req.tipPaymentDetails ? req.tipPaymentDetails.amountPaid : 0)) || 0;
      const totalSpent = itemCostVal + serviceFeeVal + tipVal;

      const breakdownParts = [];
      if (serviceFeeVal > 0) breakdownParts.push(`Released Service Charge: ₹${serviceFeeVal}`);
      if (itemCostVal > 0) breakdownParts.push(`Store Purchases: ₹${itemCostVal}`);
      if (tipVal > 0) breakdownParts.push(`Tip: ₹${tipVal}`);
      const breakdownText = breakdownParts.length > 0 ? breakdownParts.join(' • ') : `Total Paid: ₹${totalSpent}`;

      const isSeniorVerified = (req.verifierRole === 'senior' || req.verifierRole === 'senior_voice_ivr');
      const releaseSourceText = isSeniorVerified ? 'Released by Senior Citizen ("Yes, Done!")' : 'Released to Volunteer';

      totalSpentHtml = `
        <!-- Released Service Charge & Financial Breakdown -->
        <div class="mt-3 p-3.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/80 border border-emerald-200/90 rounded-2xl space-y-2 shadow-2xs">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl ${isSeniorVerified ? 'bg-teal-600' : 'bg-emerald-600'} text-white flex items-center justify-center font-black text-xs shadow-2xs">
                ✓
              </div>
              <div>
                <span class="text-[10px] font-extrabold text-emerald-900/80 uppercase tracking-wider block">Service Charge Released</span>
                <span class="text-sm font-black text-slate-900">₹${serviceFeeVal} ${releaseSourceText}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">${t('fd_total_spent') || 'Total Spent'}</span>
              <span class="text-base font-black text-emerald-800">₹${totalSpent}</span>
            </div>
          </div>
          <div class="pt-2 border-t border-emerald-200/60 text-[11px] font-semibold text-emerald-800/90 flex items-center justify-between flex-wrap gap-1">
            <span>${breakdownText}</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${isSeniorVerified ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-100/90 px-2 py-0.5 rounded-md border border-teal-200">👤 Senior Verified</span>` : ''}
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                Payment Completed
              </span>
            </div>
          </div>
        </div>`;
    }

    const allReqAlreadyDisplayedDocs = new Set(
      (req.merchantPurchases || [])
        .map(p => p.receiptDoc ? normalizeDocUrl(p.receiptDoc) : null)
        .concat([
          req.merchantDetails?.upiQrImage ? normalizeDocUrl(req.merchantDetails.upiQrImage) : null,
          req.purchaseProofDoc ? normalizeDocUrl(req.purchaseProofDoc) : null
        ])
        .concat((req.purchaseProofDocs || []).map(normalizeDocUrl))
        .filter(Boolean)
    );

    let rawAllReqFinalImages = (req.deliveryProofDocs && req.deliveryProofDocs.length > 0)
      ? req.deliveryProofDocs
      : (req.finalReceiptDocs && req.finalReceiptDocs.length > 0
          ? req.finalReceiptDocs
          : (req.completionProof ? [req.completionProof] : []));

    let finalImages = rawAllReqFinalImages
      .filter(Boolean)
      .map(normalizeDocUrl)
      .filter(img => img && img.length > 1 && !allReqAlreadyDisplayedDocs.has(img));

    let proofSlider = finalImages.length > 0 ? renderProofSliderHtml(req._id, finalImages, 'Delivery & Handover Photo') : '';
    let proofHtml = proofSlider ? `
      <div class="mt-3 p-3 bg-slate-50 border border-slate-200/70 rounded-2xl">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">${t('fd_uploaded_proof')}</label>
        ${proofSlider}
      </div>` : '';

    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-premium hover:shadow-cardHover p-5 sm:p-6 mb-5 transition-all relative overflow-hidden group" id="allReqCard-${req._id}">
        <!-- Top accent line -->
        <div class="h-1 bg-gradient-to-r ${accentGradient} -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5"></div>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-brand-700 transition-colors">${escapeHTML(req.title)}</h3>
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
              <span class="inline-flex items-center gap-1.5 text-brand-700 font-bold bg-brand-50 border border-brand-200/60 px-2.5 py-0.5 rounded-lg">
                <svg class="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/></svg>
                ${translateCategory(req.category)}
              </span>
              <span>&bull;</span>
              <span class="inline-flex items-center gap-1 text-slate-500">
                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ${new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div class="flex flex-col sm:items-end items-start gap-2 flex-shrink-0 sm:ml-auto">
            ${statusBadge}
          </div>
        </div>

        ${req.description && req.description !== req.title ? `
          <div class="text-xs font-medium text-slate-700 leading-relaxed mb-3 bg-slate-50/70 rounded-xl p-3 border border-slate-100">
            ${escapeHTML(req.description)}
          </div>` : ''}

        ${req.shoppingPreference ? `
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 mb-3 flex items-center gap-2 text-xs font-semibold text-amber-900">
            <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
            <span><strong>Shopping Preference:</strong> ${escapeHTML(req.shoppingPreference)}</span>
          </div>` : ''}

        ${(req.status !== 'completed' && req.status !== 'cancelled' && req.allowedBudget !== undefined && req.allowedBudget !== null && Number(req.allowedBudget) > 0) ? `
          <div class="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2 mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-950">
            <div class="w-4 h-4 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-extrabold text-[10px]">₹</div>
            <span><strong>Allowed Budget:</strong> ₹${req.allowedBudget}</span>
          </div>` : ''}

        ${purchasesHistoryHtml}
        ${proofHtml}
        ${timelineHtml}
        ${volunteerInfo}
        ${totalSpentHtml}
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// SELECT VOLUNTEER CONFIRMATION POPUP MODAL
// ──────────────────────────────────────────────────────────
window.handleConfirmModalTaskTypeChange = function(type) {
  const purchaseContainer = document.getElementById('confirmModalPurchaseContainer');
  const serviceNotice = document.getElementById('confirmModalServiceOnlyNotice');
  const labelService = document.getElementById('labelConfirmTaskService');
  const labelPurchase = document.getElementById('labelConfirmTaskPurchase');

  if (type === 'service_only') {
    if (purchaseContainer) purchaseContainer.style.display = 'none';
    if (serviceNotice) serviceNotice.style.display = 'flex';
    if (labelService) labelService.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-brand-500 bg-brand-50/50 cursor-pointer transition-all";
    if (labelPurchase) labelPurchase.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition-all hover:bg-slate-50";
    updateConfirmModalWorkflowText('caregiver_direct');
  } else {
    if (purchaseContainer) purchaseContainer.style.display = 'block';
    if (serviceNotice) serviceNotice.style.display = 'none';
    if (labelService) labelService.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition-all hover:bg-slate-50";
    if (labelPurchase) labelPurchase.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 cursor-pointer transition-all";
    const mode = document.querySelector('input[name="confirmFundingMode"]:checked')?.value || 'pre_fund';
    updateConfirmModalWorkflowText(mode);
  }
};

window.updateConfirmModalWorkflowText = function(mode) {
  const labelPreFund = document.getElementById('labelWorkflowPreFund');
  const labelDirect = document.getElementById('labelWorkflowDirect');
  const btnConfirm = document.getElementById('btnConfirmSelectVolunteer');
  const volName = pendingSelectVolunteerName || 'Volunteer';
  const isServiceOnly = document.querySelector('input[name="confirmTaskTypeChoice"]:checked')?.value === 'service_only';

  if (isServiceOnly) {
    if (btnConfirm) {
      btnConfirm.innerHTML = `<span class="inline-flex items-center gap-1.5"><svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>Pay Fee &amp; Assign ${escapeHTML(volName)}</span></span>`;
    }
    return;
  }

  if (mode === 'pre_fund') {
    if (labelPreFund) {
      labelPreFund.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 cursor-pointer transition-all hover:bg-emerald-50";
    }
    if (labelDirect) {
      labelDirect.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition-all hover:bg-slate-50";
    }
    if (btnConfirm) {
      btnConfirm.innerHTML = `<span class="inline-flex items-center gap-1.5"><svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg><span>Pre-Fund &amp; Assign ${escapeHTML(volName)}</span></span>`;
    }
  } else {
    if (labelPreFund) {
      labelPreFund.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition-all hover:bg-slate-50";
    }
    if (labelDirect) {
      labelDirect.className = "flex items-start gap-3 p-3.5 rounded-2xl border-2 border-brand-500 bg-brand-50/50 cursor-pointer transition-all hover:bg-brand-50";
    }
    if (btnConfirm) {
      btnConfirm.innerHTML = `<span class="inline-flex items-center gap-1.5"><svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>Pay Fee &amp; Assign ${escapeHTML(volName)}</span></span>`;
    }
  }
};

let pendingSelectVolunteerFee = 0;

function openSelectVolunteerConfirmModal(requestId, volunteerId, volName, feeText) {
  pendingSelectVolunteerRequestId = requestId;
  pendingSelectVolunteerId = volunteerId;
  pendingSelectVolunteerName = volName || 'Volunteer';

  // Parse numeric fee from feeText (e.g. "Quoted Fee: ₹50" -> 50)
  let parsedFee = 0;
  if (feeText) {
    const num = parseInt(String(feeText).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) parsedFee = num;
  }
  const req = (currentRequestsMap && currentRequestsMap[requestId]) || (window.currentRequestsMap && window.currentRequestsMap[requestId]);
  if (req && req.volunteerQuotes && req.volunteerQuotes.length > 0) {
    const q = req.volunteerQuotes.find(x => String(x.volunteer?._id || x.volunteer?.id || x.volunteer) === String(volunteerId));
    if (q && q.serviceFee !== undefined && q.serviceFee !== null) {
      parsedFee = Number(q.serviceFee);
    }
  }
  pendingSelectVolunteerFee = parsedFee;

  const modal = document.getElementById('selectVolunteerConfirmModal');
  const bodyEl = document.getElementById('selectVolunteerConfirmBody');
  const budgetInput = document.getElementById('inputConfirmAllowedBudget');

  if (bodyEl) {
    bodyEl.innerHTML = `Are you sure you want to select and approve <strong>${escapeHTML(volName)}</strong> (${escapeHTML(feeText)}) to fulfill this request for your senior citizen?`;
  }

  // Pre-fill budget input if set
  if (budgetInput) {
    budgetInput.value = (req && req.allowedBudget !== undefined && req.allowedBudget !== null && !isNaN(req.allowedBudget)) ? req.allowedBudget : '';
  }

  // Determine initial selection: default to purchase if financial, medical escort, groceries, or if budget is already set
  const isExplicitServiceOnly = req?.taskProofType === 'service_only' && (!req?.allowedBudget || req?.allowedBudget <= 0) && !['Grocery Shopping', 'Medical Escort'].includes(req?.category);
  const initialTaskType = isExplicitServiceOnly ? 'service_only' : 'purchase';

  const radioChoice = document.querySelector(`input[name="confirmTaskTypeChoice"][value="${initialTaskType}"]`);
  if (radioChoice) radioChoice.checked = true;

  handleConfirmModalTaskTypeChange(initialTaskType);

  if (modal) modal.style.display = 'flex';
}

function closeSelectVolunteerConfirmModal() {
  const modal = document.getElementById('selectVolunteerConfirmModal');
  if (modal) modal.style.display = 'none';
  pendingSelectVolunteerRequestId = null;
  pendingSelectVolunteerId = null;
  pendingSelectVolunteerName = '';
  pendingSelectVolunteerFee = 0;
}

async function confirmSelectVolunteerAssignment() {
  if (!pendingSelectVolunteerRequestId || !pendingSelectVolunteerId) return;

  const btnConfirm = document.getElementById('btnConfirmSelectVolunteer');
  let origText = '';
  if (btnConfirm) {
    origText = btnConfirm.innerHTML;
    btnConfirm.textContent = 'Processing...';
    btnConfirm.disabled = true;
  }

  const volName = pendingSelectVolunteerName || 'Volunteer';
  const reqId = pendingSelectVolunteerRequestId;
  const volId = pendingSelectVolunteerId;
  const req = (currentRequestsMap && currentRequestsMap[reqId]) || (window.currentRequestsMap && window.currentRequestsMap[reqId]);

  let fee = pendingSelectVolunteerFee || 0;
  if (fee <= 0 && req && req.volunteerQuotes && req.volunteerQuotes.length > 0) {
    const q = req.volunteerQuotes.find(x => String(x.volunteer?._id || x.volunteer?.id || x.volunteer) === String(volId));
    if (q && q.serviceFee) fee = Number(q.serviceFee);
    else if (req.volunteerQuotes[0]?.serviceFee) fee = Number(req.volunteerQuotes[0].serviceFee);
  }

  const selectedTaskType = document.querySelector('input[name="confirmTaskTypeChoice"]:checked')?.value || 'purchase';

  // ── SERVICE-ONLY FLOW (Pure Service, no store shopping) ──
  if (selectedTaskType === 'service_only') {
    if (fee > 0) {
      showToast(`Redirecting to escrow service fee of ₹${fee}...`, 'info');
      closeSelectVolunteerConfirmModal();
      setTimeout(() => {
        window.location.href = `/payment.html?requestId=${reqId}&type=service_fee_upfront&volunteerId=${volId}&serviceFee=${fee}&itemsCost=0&volunteerName=${encodeURIComponent(volName)}`;
      }, 400);
      return;
    }

    // Voluntary / ₹0 fee: approve and assign immediately
    const payload = {
      volunteerId: volId,
      fundingMode: 'caregiver_direct',
      taskProofType: 'service_only'
    };

    const res = await apiCall(`/requests/${reqId}/family-approve`, 'PUT', payload);

    if (btnConfirm) {
      btnConfirm.innerHTML = origText;
      btnConfirm.disabled = false;
    }

    if (res.ok && res.data.success) {
      showToast(res.data.message || `${volName} approved and task assigned successfully!`, 'success');
      closeSelectVolunteerConfirmModal();
      loadFamilyDashboard();
    } else {
      showToast(res.data?.message || 'Error approving volunteer.', 'error');
    }
    return;
  }

  // ── PURCHASE TASK FLOW (Pre-Fund Escrow vs Caregiver Direct) ──
  const budgetInput = document.getElementById('inputConfirmAllowedBudget');
  const budgetVal = budgetInput ? Number(budgetInput.value) : Number(req?.allowedBudget || 0);

  if (!budgetVal || isNaN(budgetVal) || budgetVal <= 0) {
    showToast('Please enter an Allowed Budget Allocation (₹) for the purchase task.', 'warning');
    if (budgetInput) budgetInput.focus();
    if (btnConfirm) {
      btnConfirm.innerHTML = origText;
      btnConfirm.disabled = false;
    }
    return;
  }

  const chosenFundingMode = document.querySelector('input[name="confirmFundingMode"]:checked')?.value || 'pre_fund';

  // PRE-FUND: Check if caregiver has sufficient wallet balance or route through payment
  if (chosenFundingMode === 'pre_fund') {
    const totalDep = budgetVal + fee;

    // Check if caregiver wallet has sufficient balance for immediate allocation
    const currentAvail = Number(window.caregiverAvailableWalletBalance || 0);

    if (currentAvail >= budgetVal) {
      showToast(`Reserving ₹${budgetVal} from your AgeWell Wallet Available Balance...`, 'info');
      try {
        const payload = {
          volunteerId: volId,
          fundingMode: 'pre_fund',
          taskProofType: 'financial',
          allowedBudget: budgetVal
        };
        const res = await apiCall(`/requests/${reqId}/family-approve`, 'PUT', payload);
        if (res.ok && res.data.success) {
          closeSelectVolunteerConfirmModal();
          showToast(`✓ Task pre-funded! ₹${budgetVal} reserved from wallet. Volunteer assigned.`, 'success');
          await fetchAndRenderCaregiverWalletWidget();
          loadFamilyDashboard();
          return;
        } else if (res.data?.insufficientWalletBalance) {
          // Fallback to payment page
          window.location.href = `/payment.html?requestId=${reqId}&type=pre_fund&volunteerId=${volId}&itemsCost=${budgetVal}&serviceFee=${fee}&volunteerName=${encodeURIComponent(volName)}`;
          return;
        }
      } catch (fundErr) {
        console.warn('Wallet direct fund fallback:', fundErr);
      }
    }

    showToast(`Redirecting to pre-fund ₹${totalDep} (Budget: ₹${budgetVal} + Fee: ₹${fee})...`, 'info');
    closeSelectVolunteerConfirmModal();
    setTimeout(() => {
      window.location.href = `/payment.html?requestId=${reqId}&type=pre_fund&volunteerId=${volId}&itemsCost=${budgetVal}&serviceFee=${fee}&volunteerName=${encodeURIComponent(volName)}`;
    }, 400);
    return;
  }

  // CAREGIVER DIRECT: Pay volunteer service fee upfront into escrow, pay store on checkout
  if (fee > 0) {
    showToast(`Redirecting to pay volunteer fee of ₹${fee}...`, 'info');
    closeSelectVolunteerConfirmModal();
    setTimeout(() => {
      window.location.href = `/payment.html?requestId=${reqId}&type=service_fee_upfront&volunteerId=${volId}&serviceFee=${fee}&itemsCost=0&volunteerName=${encodeURIComponent(volName)}`;
    }, 400);
    return;
  }

  // If voluntary / ₹0 fee: approve and assign immediately
  const payload = {
    volunteerId: volId,
    fundingMode: 'caregiver_direct',
    taskProofType: 'financial',
    allowedBudget: budgetVal
  };

  const res = await apiCall(`/requests/${reqId}/family-approve`, 'PUT', payload);

  if (btnConfirm) {
    btnConfirm.innerHTML = origText;
    btnConfirm.disabled = false;
  }

  if (res.ok && res.data.success) {
    showToast(res.data.message || `${volName} approved and task assigned successfully!`, 'success');
    closeSelectVolunteerConfirmModal();
    loadFamilyDashboard();
  } else {
    showToast(res.data?.message || 'Error approving volunteer.', 'error');
  }
}

// ──────────────────────────────────────────────────────────
// ALLOT TO VOLUNTEERS WITH SHOPPING PREFERENCES & BUDGET
// ──────────────────────────────────────────────────────────
function handleTaskTypeChange(type) {
  const purchaseContainer = document.getElementById('purchaseDetailsContainer');
  const serviceNotice = document.getElementById('serviceOnlyNoticeContainer');
  const budgetInput = document.getElementById('inputAllowedBudget');

  if (type === 'service_only') {
    if (purchaseContainer) purchaseContainer.style.display = 'none';
    if (serviceNotice) serviceNotice.style.display = 'flex';
    if (budgetInput) budgetInput.required = false;
  } else {
    if (purchaseContainer) purchaseContainer.style.display = 'block';
    if (serviceNotice) serviceNotice.style.display = 'none';
    if (budgetInput) budgetInput.required = true;
  }
}
window.handleTaskTypeChange = handleTaskTypeChange;

function approveVolunteer(requestId) {
  openShoppingPrefModal(requestId);
}

function openShoppingPrefModal(requestId, volunteerId = null, volName = '') {
  pendingAllotRequestId = requestId;
  pendingAllotVolunteerId = volunteerId;

  const modal = document.getElementById('shoppingPrefModal');
  const subtitle = document.getElementById('shoppingPrefModalSubtitle');
  const btnConfirm = document.getElementById('btnConfirmShoppingPref');
  const otherContainer = document.getElementById('otherPrefTextContainer');
  const customInput = document.getElementById('inputCustomOtherPref');
  const budgetInput = document.getElementById('inputAllowedBudget');

  // Reset checkboxes to default ("No Preference" checked, others unchecked)
  const checks = document.querySelectorAll('input[name="shoppingPrefCheck"]');
  checks.forEach(c => {
    c.checked = (c.value === 'No Preference');
  });

  if (otherContainer) otherContainer.style.display = 'none';
  if (customInput) customInput.value = '';

  const req = currentRequestsMap[requestId];
  const isServiceOnly = req && (req.taskProofType === 'service_only');
  const defaultType = isServiceOnly ? 'service_only' : 'purchase';

  const typeRadio = document.querySelector(`input[name="caregiverTaskTypeChoice"][value="${defaultType}"]`);
  if (typeRadio) typeRadio.checked = true;
  handleTaskTypeChange(defaultType);

  // Pre-fill allowed budget if already set on this request
  if (budgetInput) {
    budgetInput.value = (req && req.allowedBudget !== undefined && req.allowedBudget !== null && !isNaN(req.allowedBudget)) ? req.allowedBudget : '';
  }

  if (subtitle) {
    if (volunteerId && volName) {
      subtitle.textContent = `Choose task type and specify budget/preferences before assigning this task to ${volName}:`;
    } else {
      subtitle.textContent = `Choose task type and specify budget/preferences before allotting this task to community volunteers:`;
    }
  }

  if (btnConfirm) {
    btnConfirm.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg><span>${volunteerId ? `Submit & Assign ${volName || 'Volunteer'}` : 'Submit Preferences'}</span>`;
  }

  if (modal) modal.style.display = 'flex';
}

function closeShoppingPrefModal() {
  const modal = document.getElementById('shoppingPrefModal');
  if (modal) modal.style.display = 'none';
  pendingAllotRequestId = null;
  pendingAllotVolunteerId = null;
}

let isSubmittingAllotment = false;
async function confirmAndSubmitAllotment() {
  if (isSubmittingAllotment) return;
  if (!pendingAllotRequestId) {
    showToast('No active request selected.', 'error');
    return;
  }
  isSubmittingAllotment = true;

  const selectedTaskType = document.querySelector('input[name="caregiverTaskTypeChoice"]:checked')?.value || 'purchase';
  const budgetVal = document.getElementById('inputAllowedBudget')?.value;

  if (selectedTaskType === 'purchase') {
    if (!budgetVal || isNaN(Number(budgetVal)) || Number(budgetVal) <= 0) {
      showToast('Please enter an Allowed Budget Allocation (₹) for the purchase task.', 'warning');
      const budgetInput = document.getElementById('inputAllowedBudget');
      if (budgetInput) budgetInput.focus();
      isSubmittingAllotment = false;
      return;
    }
  }

  const btnConfirm = document.getElementById('btnConfirmShoppingPref');
  let origHTML = '';
  if (btnConfirm) {
    origHTML = btnConfirm.innerHTML;
    btnConfirm.innerHTML = `<span class="animate-pulse">Submitting...</span>`;
    btnConfirm.disabled = true;
  }

  try {
    let finalPreference = '';
    let parsedBudget = null;

    if (selectedTaskType === 'purchase') {
      const checkedBoxes = Array.from(document.querySelectorAll('input[name="shoppingPrefCheck"]:checked'));
      const selectedValues = checkedBoxes.map(cb => cb.value);

      let preferenceList = [];

      selectedValues.forEach(val => {
        if (val === 'Other') {
          const customText = document.getElementById('inputCustomOtherPref') ? document.getElementById('inputCustomOtherPref').value.trim() : '';
          if (customText) {
            preferenceList.push(`Other (${customText})`);
          } else {
            preferenceList.push('Other');
          }
        } else {
          preferenceList.push(val);
        }
      });

      // Filter out "No Preference" if specific preference options are selected alongside it
      if (preferenceList.length > 1) {
        preferenceList = preferenceList.filter(p => p !== 'No Preference');
      }

      finalPreference = preferenceList.length > 0 ? preferenceList.join(', ') : 'No Preference';
      parsedBudget = Number(budgetVal.trim());
    }

    const payload = {
      taskProofType: selectedTaskType === 'service_only' ? 'service_only' : 'financial',
      shoppingPreference: finalPreference,
      fundingMode: 'caregiver_direct',
      allowedBudget: parsedBudget
    };

    if (pendingAllotVolunteerId) {
      payload.volunteerId = pendingAllotVolunteerId;
    }

    const res = await apiCall(`/requests/${pendingAllotRequestId}/family-approve`, 'PUT', payload);

    if (btnConfirm) {
      btnConfirm.innerHTML = origHTML;
      btnConfirm.disabled = false;
    }

    if (res.ok && res.data.success) {
      // ── If Pre-Fund selected: redirect to pre-fund deposit (budget + service fee)
      if (res.data.requiresPreFundPayment && res.data.request) {
        const reqData = res.data.request;
        const budget = res.data.allowedBudget || reqData.allowedBudget || 0;
        const fee = res.data.serviceFee || reqData.serviceFee || 0;
        const totalDep = res.data.totalPreFundDeposit || (budget + fee);
        const volNameStr = (typeof reqData.volunteer === 'object' ? reqData.volunteer?.name : '') || 'Assigned Volunteer';
        showToast(`Task assigned! Redirecting to pre-fund ₹${totalDep} (Budget: ₹${budget} + Fee: ₹${fee})...`, 'info');
        closeShoppingPrefModal();
        setTimeout(() => {
          window.location.href = `/payment.html?requestId=${reqData._id}&type=pre_fund&itemsCost=${budget}&serviceFee=${fee}&volunteerName=${encodeURIComponent(volNameStr)}`;
        }, 1200);
        return;
      }

      // ── If service_only task: redirect to pre-pay service fee ────────────────
      if (res.data.requiresServiceFeePayment && res.data.request) {
        const reqData = res.data.request;
        const fee = res.data.serviceFee || reqData.serviceFee || 0;
        const volNameStr = (typeof reqData.volunteer === 'object' ? reqData.volunteer?.name : '') || 'Assigned Volunteer';
        showToast(`Volunteer allotted! Redirecting to pay service fee of ₹${fee}...`, 'info');
        closeShoppingPrefModal();
        setTimeout(() => {
          window.location.href = `/payment.html?requestId=${reqData._id}&type=service_fee_upfront&serviceFee=${fee}&volunteerName=${encodeURIComponent(volNameStr)}`;
        }, 1200);
        return;
      }

      showToast(res.data.message || 'Task allotted successfully!', 'success');
      const reqId = pendingAllotRequestId;
      closeShoppingPrefModal();

      const card = document.getElementById(`seniorCard-${reqId}`) || document.getElementById(`approvalCard-${reqId}`);
      if (card) {
        card.style.transition = 'opacity 0.5s, transform 0.5s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => loadFamilyDashboard(), 500);
      } else {
        loadFamilyDashboard();
      }
    } else {
      showToast(res.data?.message || 'Error allotting task. Please try again.', 'error');
    }
  } catch (err) {
    console.error('Error submitting preferences:', err);
    if (btnConfirm) {
      btnConfirm.innerHTML = origHTML;
      btnConfirm.disabled = false;
    }
    showToast('Failed to submit preferences. Please try again.', 'error');
  } finally {
    setTimeout(() => {
      isSubmittingAllotment = false;
    }, 800);
  }
}

window.confirmAndSubmitAllotment = confirmAndSubmitAllotment;
window.openShoppingPrefModal = openShoppingPrefModal;
window.closeShoppingPrefModal = closeShoppingPrefModal;

// ──────────────────────────────────────────────────────────
// OPEN REJECT MODAL
// ──────────────────────────────────────────────────────────
function openRejectModal(requestId) {
  activeRejectRequestId = requestId;
  document.getElementById('rejectModal').style.display = 'flex';
}

// ──────────────────────────────────────────────────────────
// DO REJECT VOLUNTEER
// ──────────────────────────────────────────────────────────
async function doRejectVolunteer(requestId, reason) {
  const res = await apiCall(`/requests/${requestId}/family-reject`, 'PUT', {
    rejectionReason: reason || 'Rejected by family caregiver'
  });

  if (res.ok && res.data.success) {
    showToast(res.data?.message || 'Request rejected successfully.', 'info');
    loadFamilyDashboard();
  } else {
    showToast(res.data?.message || 'Error rejecting request. Please try again.', 'error');
  }
}

// ──────────────────────────────────────────────────────────
// UTILITY: escapeHTML (also available from api.js but included here for safety)
// ──────────────────────────────────────────────────────────
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showError(msg) {
  return `<div style="padding: 1.5rem; background: #ffebee; border: 3px solid var(--color-emergency); border-radius: var(--border-radius); color: var(--color-emergency);">
    <strong>Error:</strong> ${escapeHTML(msg)}
  </div>`;
}

let currentLightboxImages = [];
let currentLightboxIndex = 0;

function openImageLightbox(imageUrl, reqIdOrImages = null) {
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
}

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

// ──────────────────────────────────────────────────────────
// CAREGIVER DASHBOARD TAB SWITCHER
// ──────────────────────────────────────────────────────────
window.currentFamilyTab = 'requests';

window.switchFamilyTab = function(tab) {
  window.currentFamilyTab = tab;
  const tabs = ['requests', 'approvals', 'verifications', 'history'];
  const tabBtnIds = { requests: 'tabBtnRequests', approvals: 'tabBtnApprovals', verifications: 'tabBtnVerifications', history: 'tabBtnHistory' };
  const paneIds = { requests: 'tabPaneRequests', approvals: 'tabPaneApprovals', verifications: 'tabPaneVerifications', history: 'tabPaneHistory' };
  const badgeIds = { requests: 'countFamilyRequests', approvals: 'countFamilyApprovals', verifications: 'countFamilyVerifications', history: 'countFamilyHistory' };

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

      if (badge) {
        const count = parseInt(badge.textContent, 10) || 0;
        const actionNeeded = badge.dataset.actionNeeded === "true";
        const isHistory = badge.dataset.isHistory === "true" || t === 'history';

        if (isHistory) {
          badge.className = "bg-slate-100 text-slate-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/80 flex-shrink-0";
        } else if (actionNeeded && count > 0) {
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

// ─── Senior Citizen Service Charge Release Notifications ───────────────────────
window.notifiedSeniorReleasesSet = window.notifiedSeniorReleasesSet || new Set();

function renderSeniorReleaseNotifications(requests) {
  const container = document.getElementById('seniorReleaseNotifContainer');
  if (!container) return;

  const currentFamilyUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = currentFamilyUser._id || currentFamilyUser.id || 'caregiver';
  const dismissedKey = `dismissed_senior_releases_${userId}`;
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');

  // Find requests completed by senior citizen confirmation ("Yes, Done!")
  const seniorReleases = (requests || []).filter(r => {
    if (r.status !== 'completed' && r.status !== 'verified') return false;
    const isSeniorVerified = (r.verifierRole === 'senior' || r.verifierRole === 'senior_voice_ivr');
    return isSeniorVerified && !dismissed.includes(String(r._id));
  });

  if (seniorReleases.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  // Trigger live toast notification for newly loaded senior releases
  seniorReleases.forEach(r => {
    const notifKey = `senior_rel_${r._id}`;
    if (!window.notifiedSeniorReleasesSet.has(notifKey)) {
      window.notifiedSeniorReleasesSet.add(notifKey);
      const sName = r.senior?.name || 'Your senior citizen';
      const fee = Number(r.serviceFee || (r.volunteerQuotes && r.volunteerQuotes[0]?.serviceFee) || 0);
      showToast(`${sName} confirmed "Yes, Done!" for "${r.title}" — volunteer service charge of ₹${fee} released.`, 'info');
    }
  });

  container.style.display = 'block';
  container.innerHTML = seniorReleases.map(r => {
    const seniorName = r.senior?.name || 'Senior Citizen';
    const volName = r.volunteer?.name || 'Assigned Volunteer';
    const fee = Number(r.serviceFee || (r.volunteerQuotes && r.volunteerQuotes[0]?.serviceFee) || 0);
    const releaseTime = r.verifiedAt || r.serviceChargeReleasedAt || r.completedAt || Date.now();
    const timeStr = new Date(releaseTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="p-4 bg-gradient-to-r from-teal-50/95 via-emerald-50/90 to-teal-50/80 border-2 border-teal-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-premium animate-fade-in" id="seniorReleaseNotif_${r._id}">
        <div class="flex items-start gap-3.5 min-w-0">
          <div class="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          </div>
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-black text-teal-950 uppercase tracking-wider">Service Charge Released by Senior</span>
              <span class="text-[10px] font-extrabold bg-teal-100/90 text-teal-800 border border-teal-300 px-2.5 py-0.5 rounded-full">
                "Yes, Done!" Confirmed
              </span>
              <span class="text-[11px] text-slate-400 font-medium">${timeStr}</span>
            </div>
            <p class="text-xs text-slate-700 font-medium leading-relaxed">
              <strong>${escapeHTML(seniorName)}</strong> confirmed task completion for <strong>"${escapeHTML(r.title)}"</strong> and released the volunteer service charge of <strong class="text-teal-900 font-extrabold">₹${fee}</strong> to <strong>${escapeHTML(volName)}</strong>.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          <button 
            type="button" 
            onclick="dismissSeniorReleaseNotif('${r._id}')" 
            class="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.dismissSeniorReleaseNotif = function(requestId) {
  const currentFamilyUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = currentFamilyUser._id || currentFamilyUser.id || 'caregiver';
  const dismissedKey = `dismissed_senior_releases_${userId}`;
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');

  if (!dismissed.includes(String(requestId))) {
    dismissed.push(String(requestId));
    localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
  }

  const el = document.getElementById(`seniorReleaseNotif_${requestId}`);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    el.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      el.remove();
      const container = document.getElementById('seniorReleaseNotifContainer');
      if (container && container.children.length === 0) {
        container.style.display = 'none';
      }
    }, 250);
  }
};

