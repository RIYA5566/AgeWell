// AgeWell — Family/Caregiver Dashboard Client Script

let activeRejectRequestId = null;
let pendingAllotRequestId = null;
let pendingAllotVolunteerId = null;
let pendingSelectVolunteerRequestId = null;
let pendingSelectVolunteerId = null;
let pendingSelectVolunteerName = '';
let pollInterval = null;
let currentVolunteersMap = {};

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
  if (!silent) {
    document.getElementById('approvalList').innerHTML = `
      <div class="loading-wrapper"><div class="spinner"></div><span>Loading...</span></div>`;
    document.getElementById('allRequestsList').innerHTML = `
      <div class="loading-wrapper"><div class="spinner"></div><span>Loading...</span></div>`;
  }

  const res = await apiCall('/family/dashboard', 'GET');

  if (!res.ok || !res.data.success) {
    const errMsg = res.data?.message || 'Could not load dashboard data.';
    document.getElementById('approvalList').innerHTML = showError(errMsg);
    return;
  }

  const { senior, requests, pendingApprovalCount } = res.data;

  // Build lookup map of volunteers for instant profile viewing
  currentVolunteersMap = {};
  if (requests && requests.length > 0) {
    requests.forEach(r => {
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

  // Separate active senior requests (pending decision, allotted, accepted, in-progress) from volunteer quote approvals & receipt verifications
  const seniorRequests = requests.filter(r => 
    ( (r.status === 'pending' || r.status === 'awaiting_approval') && (!r.volunteerQuotes || r.volunteerQuotes.length === 0) ) ||
    r.status === 'accepted' ||
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

  // Render Senior Help Requests & Fulfillment Decisions (Section 1)
  renderSeniorHelpRequests(seniorRequests);

  // Render Volunteer Approvals & Quoted Fees (Section 2)
  renderApprovalQueue(volunteerApprovals);

  // Render completion verification queue (Section 3)
  renderCompletionVerificationQueue(completionVerifications);

  // Render full request history (Section 4)
  renderAllRequests(requests);
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
    ? vol.skills.map(s => `<span class="skill-tag" style="background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; font-weight:600; font-size:0.9rem; padding:4px 12px; border-radius:15px;">${escapeHTML(s)}</span>`).join('')
    : `<span style="color:#888; font-style:italic;">${t('fd_no_skills_listed')}</span>`;

  const memberSince = vol.createdAt ? new Date(vol.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : t('fd_registered_volunteer');

  detailsEl.innerHTML = `
    <!-- Header Banner with Symmetrical Ratings Badges -->
    <div style="margin-bottom: 1.2rem; background: linear-gradient(135deg, #f1f8e9, #ffffff); padding: 1.2rem; border-radius: 14px; border: 2px solid #a5d6a7; box-shadow: 0 2px 8px rgba(46,125,50,0.08);">
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <div style="width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg, #1b5e20, #43a047); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(46,125,50,0.2); margin-top: 2px;">
          <svg style="width: 28px; height: 28px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
        </div>
        <div style="flex: 1; min-width: 0;">
          <!-- Name & Overall Rating Badge -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #1b5e20; font-size: 1.3rem; font-weight: 700; line-height: 1.2;">${vName}</h3>
            <span style="font-weight: 700; color: #b45309; background: #fffdf5; border: 1.5px solid #fde68a; padding: 3px 12px; border-radius: 16px; font-size: 0.88rem; white-space: nowrap; box-shadow: 0 2px 5px rgba(245,158,11,0.12);">
              Rating: ${stats.reviewsCount > 0 ? stats.overallRating.toFixed(1) : '0.0'} / 5.0
            </span>
          </div>

          <!-- Symmetrical Badges Grid -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 0.88rem; color: #374151; margin-bottom: 8px;">
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">Cost: <strong style="color: #2e7d32;">${stats.costUtilization > 0 ? stats.costUtilization.toFixed(1) : '0'}/5</strong></span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">Speed: <strong style="color: #2e7d32;">${stats.speedTimeliness > 0 ? stats.speedTimeliness.toFixed(1) : '0'}/5</strong></span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">Comm: <strong style="color: #2e7d32;">${stats.communication > 0 ? stats.communication.toFixed(1) : '0'}/5</strong></span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;"><strong style="color: #2e7d32;">${stats.recommendationRate}%</strong> Recommendation</span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;"><strong style="color: #2e7d32;">${stats.tasksCompleted}</strong> Tasks</span>
          </div>

          <!-- Verification Status & Member Date -->
          <div style="font-size: 0.86rem; color: #2e7d32; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>${isFullyVerified ? t('fd_fully_verified') : t('fd_background_clearance_pending')}</span>
            <span style="color: #a5d6a7;">•</span>
            <span style="color: #555; font-weight: 500;">Member since ${memberSince}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Multi-Level Verification Clearances -->
    <div style="margin-bottom: 1.2rem; background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 1rem;">
      <h4 style="color: #1b5e20; margin-top: 0; margin-bottom: 10px; font-size: 1.05rem; display: flex; align-items: center; gap: 6px;">
        Verification Clearances
      </h4>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <span class="skill-tag" style="background: ${isIdVerified ? '#e8f5e9' : '#ffebee'}; color: ${isIdVerified ? '#2e7d32' : '#c62828'}; border: 1px solid ${isIdVerified ? '#a5d6a7' : '#ef9a9a'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          Photo ID: ${isIdVerified ? 'Verified' : 'Pending'}
        </span>
        <span class="skill-tag" style="background: ${isPoliceVerified ? '#e8f5e9' : '#fff3e0'}; color: ${isPoliceVerified ? '#2e7d32' : '#e65100'}; border: 1px solid ${isPoliceVerified ? '#a5d6a7' : '#ffe082'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          Police Check: ${isPoliceVerified ? 'Approved' : 'Pending'}
        </span>
        <span class="skill-tag" style="background: ${isPhoneVerified ? '#e8f5e9' : '#ffebee'}; color: ${isPhoneVerified ? '#2e7d32' : '#c62828'}; border: 1px solid ${isPhoneVerified ? '#a5d6a7' : '#ef9a9a'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          Phone: ${isPhoneVerified ? 'Verified' : 'Unverified'}
        </span>
        <span class="skill-tag" style="background: ${isEmailVerified ? '#e8f5e9' : '#ffebee'}; color: ${isEmailVerified ? '#2e7d32' : '#c62828'}; border: 1px solid ${isEmailVerified ? '#a5d6a7' : '#ef9a9a'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          Email: ${isEmailVerified ? 'Verified' : 'Unverified'}
        </span>
      </div>
    </div>

    <!-- Contact Details -->
    <div style="margin-bottom: 1.2rem; background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 1rem;">
      <h4 style="color: #1565c0; margin-top: 0; margin-bottom: 10px; font-size: 1.05rem;">Direct Contact</h4>
      <p style="margin: 6px 0; font-size: 1rem;">
        <strong>Phone:</strong> <a href="tel:${vPhone}" style="color: #1565c0; font-weight: bold; text-decoration: none;">${vPhone}</a>
      </p>
      <p style="margin: 6px 0; font-size: 1rem;">
        <strong>Email:</strong> <a href="mailto:${vEmail}" style="color: #1565c0; text-decoration: none;">${vEmail}</a>
      </p>
    </div>

    <!-- Skills & Expertise -->
    <div style="background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 1rem;">
      <h4 style="color: #2e7d32; margin-top: 0; margin-bottom: 10px; font-size: 1.05rem;">Skills &amp; Expertise</h4>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
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

      const vol = req.volunteer;
      const volName = vol ? escapeHTML(vol.name || 'Volunteer') : 'Volunteer';
      const volPhone = vol ? escapeHTML(vol.phone || '') : '';
      const volEmail = vol ? escapeHTML(vol.email || '') : '';
      const volId = vol ? (typeof vol === 'object' ? (vol._id || vol.id) : vol) : '';

      actionAreaHtml = `
        <div class="mt-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
              </div>
              <span class="text-xs font-extrabold text-emerald-950">${t('fd_approved_volunteer')}: <strong class="font-extrabold text-emerald-800">${volName}</strong></span>
            </div>
            ${volPhone ? `<p class="text-xs text-slate-600 font-medium pl-8">Phone: <a href="tel:${volPhone}" class="text-emerald-700 font-bold hover:underline">${volPhone}</a></p>` : ''}
            ${volEmail ? `<p class="text-xs text-slate-500 font-medium pl-8">Email: ${volEmail}</p>` : ''}
          </div>
          ${volId ? `
            <button type="button" onclick="viewVolunteerProfile('${volId}')" class="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 self-start sm:self-auto">
              <svg class="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${t('btn_view_profile')}
            </button>` : ''}
        </div>`;

    } else if (req.status === 'purchase_funded') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-extrabold shadow-2xs">
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${t('fd_purchase_funded_progress')}
      </span>`;
      accentGradient = 'from-emerald-400 to-emerald-600';
      footerHelpText = t('fd_purchase_funded_progress');

      const vol = req.volunteer;
      const volName = vol ? escapeHTML(vol.name || 'Volunteer') : 'Volunteer';
      const volPhone = vol ? escapeHTML(vol.phone || '') : '';

      actionAreaHtml = `
        <div class="mt-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div class="text-xs font-bold text-emerald-950">${t('fd_funded_purchase_cost')}: <strong class="text-sm font-extrabold text-emerald-700">₹${req.actualPurchaseCost || 0}</strong></div>
            <div class="text-xs text-slate-600 mt-0.5">${t('fd_assisted_by')} <strong>${volName}</strong> ${volPhone ? `(<a href="tel:${volPhone}" class="text-emerald-700 font-bold hover:underline">${volPhone}</a>)` : ''}</div>
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
                        ${t('btn_select_approve_vol', { name: vName, fee: feeText })}
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
    if (req.serviceFee !== undefined && req.serviceFee !== null) {
      resolvedFee = Number(req.serviceFee);
    } else if (req.volunteerQuotes && req.volunteerQuotes.length > 0) {
      let matchQ = volId ? req.volunteerQuotes.find(q => q.volunteer && String(q.volunteer._id || q.volunteer.id || q.volunteer) === String(volId)) : null;
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
      const approveBtnHtml = isZeroPurchaseCost ? `
        <button type="button" onclick="directReleaseServiceCharge('${req._id}', '${resolvedFee}', '${escapeHTML(volName).replace(/'/g, "\\'")}')" class="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          ${t('btn_release_service_charge', { fee: resolvedFee })}
        </button>` : `
        <button type="button" onclick="approvePurchaseFunding('${req._id}', '${req.actualPurchaseCost || 0}', '${resolvedFee}', '${escapeHTML(volName).replace(/'/g, "\\'")}')" class="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v.375c0 .621.504 1.125 1.125 1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
          ${t('btn_approve_payment_release', { cost: req.actualPurchaseCost || 0 })}
        </button>`;

      cardContent = `
        <div class="my-3 p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-amber-200/60">
            <span class="text-sm font-extrabold text-amber-950">${t('fd_vol_submitted_purchase_cost') || 'Submitted Purchase Cost:'} <strong class="text-base text-amber-700">₹${req.actualPurchaseCost || 0}</strong></span>
            ${req.purchaseNotes ? `<span class="text-xs text-slate-700 italic bg-white px-2.5 py-1 rounded-lg border border-amber-200">${t('fd_notes')}: "${escapeHTML(req.purchaseNotes)}"</span>` : ''}
          </div>
          <div class="flex flex-col md:flex-row items-center gap-4">
            <div class="w-full md:w-auto flex-1">${proofSlider}</div>
            <div class="w-full md:w-auto flex flex-col gap-2.5 justify-center">
              ${approveBtnHtml}
              <button type="button" onclick="openRejectRevisionModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', '${escapeHTML(req.category).replace(/'/g, "\\'")}')" class="w-full sm:w-auto px-5 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
                ${t('btn_reject_request_revision')}
              </button>
            </div>
          </div>
        </div>`;
    } else {
      let finalImages = req.finalReceiptDocs && req.finalReceiptDocs.length > 0 
        ? req.finalReceiptDocs 
        : (req.completionProof ? [req.completionProof] : []);
      let proofSlider = renderProofSliderHtml(req._id, finalImages);

      let proofHtml = proofSlider ? `
        <div class="my-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">${t('fd_uploaded_proof')}</label>
          ${proofSlider}
        </div>` : `<div class="my-2 text-xs text-slate-400 italic">No photo proof attached by volunteer.</div>`;

      cardContent = `
        <div class="text-xs text-slate-700 font-medium mb-3">
          <strong>${t('fd_vol_completion_notes')}:</strong> "${escapeHTML(req.resolutionNotes || 'Task completed & store receipt uploaded.')}"
        </div>
        ${proofHtml}
        <div class="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl my-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="text-xs font-bold text-emerald-950">${t('fd_service_charge_release')}: <strong class="text-sm font-extrabold text-emerald-700">₹${resolvedFee > 0 ? resolvedFee : 0}</strong></div>
            <div class="text-[11px] text-emerald-700 mt-0.5">${t('fd_receipt_verify_help')}</div>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
          <button
            type="button"
            onclick="verifyTaskCompletion('${req._id}', true)"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95"
          >
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            ${t('btn_verify_receipt_release', { fee: resolvedFee > 0 ? resolvedFee : 0 })}
          </button>
          <button
            type="button"
            onclick="verifyTaskCompletion('${req._id}', false)"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95"
          >
            <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            ${t('btn_reject_report_issue')}
          </button>
        </div>`;
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

// Step 5: Caregiver verifies final receipt & releases volunteer service charge
async function verifyTaskCompletion(requestId, approved) {
  if (approved) {
    try {
      const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
        approved: true
      });
      if (res.ok && res.data.success) {
        showToast('✅ Receipt verified & service charge released!', 'success');
        currentFeedbackRequestId = requestId;
        let volName = 'Assigned Volunteer';
        let serviceFee = 0;
        if (res.data.request) {
          if (res.data.request.volunteer) {
            volName = typeof res.data.request.volunteer === 'object' ? res.data.request.volunteer.name : 'Assigned Volunteer';
          }
          serviceFee = Number(res.data.request.serviceFee || 0);
        }
        // Step 5a: Open TIP modal first. After tip decision → feedback modal.
        promptForVolunteerTip(requestId, volName, { serviceFee, itemsCost: 0, actionType: 'direct' });
      } else {
        alert(res.data?.message || 'Error verifying completion receipt');
      }
    } catch (e) {
      console.error(e);
      alert('Network error verifying task receipt');
    }
    return;
  }

  const reason = prompt('Please enter the reason for rejecting or reporting an issue with this completion:') || 'Rejected by family caregiver';

  const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
    approved: false,
    rejectionReason: reason
  });

  if (res.ok && res.data.success) {
    showToast('Receipt rejected. Volunteer notified to re-upload.', 'error');
    loadFamilyDashboard();
  } else {
    showToast(res.data?.message || 'Error updating completion verification.', 'error');
  }
}

// --- Volunteer Feedback Modal Handlers ---

window.openFeedbackModal = function(volName) {
  const modal = document.getElementById('feedbackModal');
  const nameEl = document.getElementById('feedbackVolunteerName');
  if (nameEl && volName) {
    nameEl.textContent = volName;
  }
  initStarRatings();
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

window.selectPill = function(labelEl, groupName, value) {
  const container = labelEl.parentElement;
  if (!container) return;
  container.querySelectorAll('.pill-option').forEach(p => {
    p.classList.remove('active');
    p.style.background = '#f9fafb';
    p.style.color = '#4b5563';
    p.style.borderColor = '#d1d5db';
  });
  labelEl.classList.add('active');
  labelEl.style.background = '#2e7d32';
  labelEl.style.color = '#ffffff';
  labelEl.style.borderColor = '#2e7d32';
  const radio = labelEl.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
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
  const taskCompletion = taskCompletionRadio ? taskCompletionRadio.value : 'Completely';
  const chooseAgainRadio = document.querySelector('input[name="chooseAgain"]:checked');
  const chooseAgain = chooseAgainRadio ? chooseAgainRadio.value : 'Yes';
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

window.proofSliderData = window.proofSliderData || {};
window.proofSliderIndex = window.proofSliderIndex || {};

function renderProofSliderHtml(reqId, rawImages) {
  if (!rawImages || rawImages.length === 0) return '';

  const images = Array.from(new Set(
    rawImages
      .filter(Boolean)
      .map(img => typeof img === 'string' ? (img.startsWith('/') ? img : '/' + img) : '')
      .filter(img => img.length > 1)
  ));

  if (images.length === 0) return '';

  window.proofSliderData[reqId] = images;
  window.proofSliderIndex[reqId] = 0;

  const firstImg = images[0];
  const count = images.length;

  if (count === 1) {
    return `
      <div style="position: relative; width: 440px; max-width: 100%; height: 320px; border-radius: 12px; overflow: hidden; border: 2px solid #ffe0b2; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.12); flex-shrink: 0;">
        <img src="${escapeHTML(firstImg)}" alt="Proof Image" onclick="event.stopPropagation(); openImageLightbox('${escapeHTML(firstImg)}', '${reqId}'); return false;" style="width: 100%; height: 100%; object-fit: contain; cursor: pointer; display: block;" title="Click to enlarge proof photo">
      </div>`;
  }

  return `
    <div style="position: relative; width: 440px; max-width: 100%; height: 320px; border-radius: 12px; overflow: hidden; border: 2px solid #ffe0b2; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.12); flex-shrink: 0; user-select: none;">
      <img id="sliderImg_${reqId}" src="${escapeHTML(firstImg)}" alt="Proof Image 1" onclick="event.stopPropagation(); openImageLightbox(this.src, '${reqId}'); return false;" style="width: 100%; height: 100%; object-fit: contain; cursor: pointer; display: block;" title="Click to enlarge proof photo">
      
      <div id="sliderCounter_${reqId}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.75); color: #ffffff; font-weight: 800; font-size: 0.88rem; padding: 4px 12px; border-radius: 16px; pointer-events: none; z-index: 2; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        1 / ${count}
      </div>

      <button type="button" onclick="event.stopPropagation(); navigateProofSlider('${reqId}', -1)" style="position: absolute; top: 50%; left: 8px; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: #ffffff; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.3rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 3; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: all 0.15s ease;" onmouseover="this.style.background='rgba(0,0,0,0.9)'; this.style.transform='translateY(-50%) scale(1.1)'" onmouseleave="this.style.background='rgba(0,0,0,0.6)'; this.style.transform='translateY(-50%) scale(1)'">
        &#9664;
      </button>

      <button type="button" onclick="event.stopPropagation(); navigateProofSlider('${reqId}', 1)" style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: #ffffff; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.3rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 3; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: all 0.15s ease;" onmouseover="this.style.background='rgba(0,0,0,0.9)'; this.style.transform='translateY(-50%) scale(1.1)'" onmouseleave="this.style.background='rgba(0,0,0,0.6)'; this.style.transform='translateY(-50%) scale(1)'">
        &#9654;
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
      showToast('Volunteer service charge released!', 'success');
      currentFeedbackRequestId = requestId;
      let resolvedVolName = volName || 'Assigned Volunteer';
      if (res.data.request && res.data.request.volunteer) {
        resolvedVolName = typeof res.data.request.volunteer === 'object' ? res.data.request.volunteer.name : resolvedVolName;
      }
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
function approvePurchaseFunding(requestId, amount, serviceFee, volName) {
  if (Number(amount || 0) === 0) {
    // If purchase cost is zero, just approve-purchase-funding on backend and move forward
    directApprovePurchaseFunding(requestId, serviceFee, volName);
    return;
  }
  // Redirect to payment page with purchase amount + service fee. Tip NOT included here.
  window.location.href = `/payment.html?requestId=${requestId}&type=purchase&itemsCost=${amount}&serviceFee=${serviceFee || 0}&volunteerName=${encodeURIComponent(volName || 'Assigned Volunteer')}`;
}

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

    const timeline = isFulfilledByFamily ? `
      <div class="request-timeline my-3">
        <div class="timeline-step done">${t('status_pending')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step done">${t('fd_awaiting_decision')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step done font-bold text-emerald-700">${t('btn_fulfill_myself')}</div>
      </div>` : `
      <div class="request-timeline my-3">
        <div class="timeline-step done">${t('status_pending')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step ${isVolAssigned ? 'done' : 'future'}">${t('fd_assigned_in_progress')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step ${isPurchaseFunded ? 'done' : (req.status === 'purchase_cost_submitted' ? 'active' : 'future')}">${t('fd_purchase_funded_progress')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step ${isServiceInProgress ? 'done' : 'future'}">${t('status_approved')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step ${isDeliveredAndPaid ? 'done' : (req.status === 'awaiting_verification' ? 'active' : 'future')}">${t('fd_proof_verifications_title')}</div>
        <span class="timeline-arrow text-slate-400">&rarr;</span>
        <div class="timeline-step ${isCompleted ? 'done' : 'future'}">${t('status_completed')}</div>
      </div>`;

    let volunteerInfo = '';
    if (req.volunteer && (req.status === 'accepted' || req.status === 'completed' || req.status === 'awaiting_approval')) {
      const volObj = req.volunteer;
      const vName = typeof volObj === 'object' ? volObj.name : 'Volunteer';
      const vId = typeof volObj === 'object' ? (volObj._id || volObj.id) : volObj;
      const feeLabel = (req.serviceFee !== undefined && req.serviceFee > 0) ? `₹${req.serviceFee}` : '₹0 (Voluntary)';

      volunteerInfo = `
        <div class="mt-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
          <div class="flex justify-between items-center flex-wrap gap-2">
            <span class="text-xs font-bold text-slate-900">${t('fd_approved_volunteer')}: <strong class="text-brand-800">${escapeHTML(vName)}</strong></span>
            ${vId ? `<button type="button" onclick="viewVolunteerProfile('${volId}')" class="px-2.5 py-0.5 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-[10px] font-bold transition-all">${t('btn_view_profile')}</button>` : ''}
          </div>
          <p class="text-xs text-slate-600 font-medium">${t('fd_quoted_service_charge') || 'Quoted Fee'}: <strong class="text-emerald-700">${feeLabel}</strong></p>
          ${req.status !== 'awaiting_approval' && typeof volObj === 'object' ? `<p class="text-xs text-slate-500 font-medium">Contact: ${escapeHTML(volObj.phone || '—')}</p>` : ''}
          ${req.volunteerNotes ? `<p class="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 mt-1">"${escapeHTML(req.volunteerNotes)}"</p>` : ''}
          ${req.status === 'completed' && req.resolutionNotes ? `<p class="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 mt-1">${escapeHTML(req.resolutionNotes)}</p>` : ''}
        </div>`;
    }

    let totalSpentHtml = '';
    if (req.status === 'completed') {
      const serviceFeeVal = Number((req.serviceFee !== undefined && req.serviceFee !== null)
        ? req.serviceFee
        : ((req.volunteerQuotes && req.volunteerQuotes[0] && req.volunteerQuotes[0].serviceFee !== undefined)
          ? req.volunteerQuotes[0].serviceFee
          : (req.paymentDetails ? req.paymentDetails.volunteerFee : 0))) || 0;

      const itemCostVal = Number((req.actualPurchaseCost !== undefined && req.actualPurchaseCost !== null)
        ? req.actualPurchaseCost
        : (req.purchasePaymentDetails ? req.purchasePaymentDetails.amountPaid : (req.paymentDetails ? req.paymentDetails.itemsCost : 0))) || 0;

      let tipVal = Number(req.tipAmount || (req.paymentDetails ? req.paymentDetails.tipAmount : 0) || (req.tipPaymentDetails ? req.tipPaymentDetails.amountPaid : 0)) || 0;
      const totalSpent = itemCostVal + serviceFeeVal + tipVal;

      const breakdownText = `Items ₹${itemCostVal} + Service Fee ₹${serviceFeeVal}${tipVal > 0 ? ` + Tip ₹${tipVal}` : ''}`;

      totalSpentHtml = `
        <div class="mt-3 p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="text-xs font-bold text-emerald-950">${t('fd_total_spent') || 'Total Spent'}: <strong class="text-sm font-extrabold text-emerald-700">₹${totalSpent}</strong></div>
            <div class="text-[11px] text-emerald-700 mt-0.5">${breakdownText}</div>
          </div>
        </div>`;
    }

    let finalImages = req.finalReceiptDocs && req.finalReceiptDocs.length > 0 
      ? req.finalReceiptDocs 
      : (req.completionProof ? [req.completionProof] : []);

    let proofSlider = renderProofSliderHtml(req._id, finalImages);
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

        ${proofHtml}
        ${timeline}
        ${volunteerInfo}
        ${totalSpentHtml}
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// SELECT VOLUNTEER CONFIRMATION POPUP MODAL
// ──────────────────────────────────────────────────────────
function openSelectVolunteerConfirmModal(requestId, volunteerId, volName, feeText) {
  pendingSelectVolunteerRequestId = requestId;
  pendingSelectVolunteerId = volunteerId;
  pendingSelectVolunteerName = volName || 'Volunteer';

  const modal = document.getElementById('selectVolunteerConfirmModal');
  const bodyEl = document.getElementById('selectVolunteerConfirmBody');
  const btnConfirm = document.getElementById('btnConfirmSelectVolunteer');

  if (bodyEl) {
    bodyEl.innerHTML = `Are you sure you want to select and approve <strong>${escapeHTML(volName)}</strong> (${escapeHTML(feeText)}) to fulfill this request for your senior citizen?`;
  }
  if (btnConfirm) {
    btnConfirm.textContent = `Confirm & Assign ${escapeHTML(volName)}`;
  }

  if (modal) modal.style.display = 'flex';
}

function closeSelectVolunteerConfirmModal() {
  const modal = document.getElementById('selectVolunteerConfirmModal');
  if (modal) modal.style.display = 'none';
  pendingSelectVolunteerRequestId = null;
  pendingSelectVolunteerId = null;
  pendingSelectVolunteerName = '';
}

async function confirmSelectVolunteerAssignment() {
  if (!pendingSelectVolunteerRequestId || !pendingSelectVolunteerId) return;

  const btnConfirm = document.getElementById('btnConfirmSelectVolunteer');
  let origText = '';
  if (btnConfirm) {
    origText = btnConfirm.textContent;
    btnConfirm.textContent = 'Assigning...';
    btnConfirm.disabled = true;
  }

  const volName = pendingSelectVolunteerName;
  const res = await apiCall(`/requests/${pendingSelectVolunteerRequestId}/family-approve`, 'PUT', {
    volunteerId: pendingSelectVolunteerId
  });

  if (btnConfirm) {
    btnConfirm.textContent = origText;
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
// ALLOT TO VOLUNTEERS WITH SHOPPING PREFERENCES
// ──────────────────────────────────────────────────────────
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

  // Reset checkboxes to default ("No Preference" checked, others unchecked)
  const checks = document.querySelectorAll('input[name="shoppingPrefCheck"]');
  checks.forEach(c => {
    c.checked = (c.value === 'No Preference');
  });

  if (otherContainer) otherContainer.style.display = 'none';
  if (customInput) customInput.value = '';

  if (subtitle) {
    if (volunteerId && volName) {
      subtitle.textContent = `Specify shopping preferences (select all that apply) before assigning this task to ${volName}:`;
    } else {
      subtitle.textContent = `Specify shopping preferences (select all that apply) before allotting this task to community volunteers:`;
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

async function confirmAndSubmitAllotment() {
  if (!pendingAllotRequestId) return;

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

  let finalPreference = preferenceList.length > 0 ? preferenceList.join(', ') : 'No Preference';

  const btnConfirm = document.getElementById('btnConfirmShoppingPref');
  let origHTML = '';
  if (btnConfirm) {
    origHTML = btnConfirm.innerHTML;
    btnConfirm.innerHTML = `<span class="animate-pulse">Submitting...</span>`;
    btnConfirm.disabled = true;
  }

  const payload = {
    shoppingPreference: finalPreference
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
    showToast(res.data.message || 'Task allotted with shopping preferences!', 'success');
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
}

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
// TOAST NOTIFICATION HELPER
// ──────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.getElementById('familyToast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: '#e8f5e9', border: 'var(--color-primary)', text: 'var(--color-primary-dark)' },
    error:   { bg: '#ffebee', border: 'var(--color-emergency)', text: 'var(--color-emergency)' },
    info:    { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' }
  };

  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.id = 'familyToast';
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: ${c.bg};
    border: 3px solid ${c.border};
    color: ${c.text};
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    z-index: 9999;
    max-width: 90vw;
    text-align: center;
    animation: fadeInUp 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
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
    images = reqIdOrImages;
  } else if (typeof reqIdOrImages === 'string' && window.proofSliderData && window.proofSliderData[reqIdOrImages]) {
    images = window.proofSliderData[reqIdOrImages];
  } else if (typeof imageUrl === 'string') {
    images = [imageUrl];
  }

  images = images.map(img => img.startsWith('/') ? img : '/' + img);
  currentLightboxImages = images;

  const cleanUrl = typeof imageUrl === 'string' ? (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl) : images[0];
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
