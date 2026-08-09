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
    if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${user.name}!`;

    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    if (welcomeSubtitle && user.relationship) {
      welcomeSubtitle.textContent = `You are managing care as the ${user.relationship}. Review and approve volunteers below.`;
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

  // Separate new senior requests needing caregiver decision (familyApprovalStatus !== 'approved') from volunteer approvals
  const seniorRequests = requests.filter(r => (r.status === 'pending' || r.status === 'awaiting_approval') && r.familyApprovalStatus !== 'approved' && (!r.volunteerQuotes || r.volunteerQuotes.length === 0));
  const volunteerApprovals = requests.filter(r => (r.status === 'pending' || r.status === 'awaiting_approval') && r.volunteerQuotes && r.volunteerQuotes.length > 0);
  const completionVerifications = requests.filter(r => (r.status === 'purchase_cost_submitted' || r.status === 'awaiting_verification' || (r.status === 'completed' && r.completionVerified !== 'verified' && r.completionVerified !== 'rejected')));

  // Update notification badge specifically for Volunteer Approvals section
  updateApprovalBadge(volunteerApprovals.length);

  // Update document title for total pending actions
  const totalActions = seniorRequests.length + volunteerApprovals.length + completionVerifications.length;
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
        <p style="font-weight: bold; font-size: 1.1rem; color: #c62828;">Volunteer details loading or unavailable.</p>
        <p style="font-size: 0.9rem;">Please try refreshing the portal page.</p>
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
    : `<span style="color:#888; font-style:italic;">No specific skills listed</span>`;

  const memberSince = vol.createdAt ? new Date(vol.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Registered Volunteer';

  detailsEl.innerHTML = `
    <!-- Header Banner with Symmetrical Ratings Badges -->
    <div style="margin-bottom: 1.2rem; background: linear-gradient(135deg, #f1f8e9, #ffffff); padding: 1.2rem; border-radius: 14px; border: 2px solid #a5d6a7; box-shadow: 0 2px 8px rgba(46,125,50,0.08);">
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, #1b5e20, #43a047); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(46,125,50,0.2); margin-top: 2px;">
          🙋
        </div>
        <div style="flex: 1; min-width: 0;">
          <!-- Name & Overall Rating Badge -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #1b5e20; font-size: 1.3rem; font-weight: 700; line-height: 1.2;">${vName}</h3>
            <span style="font-weight: 700; color: #b45309; background: #fffdf5; border: 1.5px solid #fde68a; padding: 3px 12px; border-radius: 16px; font-size: 0.88rem; white-space: nowrap; box-shadow: 0 2px 5px rgba(245,158,11,0.12);">
              ⭐ ${stats.reviewsCount > 0 ? stats.overallRating.toFixed(1) : '0.0'} Overall Rating
            </span>
          </div>

          <!-- Symmetrical Badges Grid -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 0.88rem; color: #374151; margin-bottom: 8px;">
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">💰 Cost Utilization <strong style="color: #2e7d32;">${stats.costUtilization > 0 ? stats.costUtilization.toFixed(1) : '0'}/5</strong></span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">⏱️ Speed <strong style="color: #2e7d32;">${stats.speedTimeliness > 0 ? stats.speedTimeliness.toFixed(1) : '0'}/5</strong></span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">📞 Communication <strong style="color: #2e7d32;">${stats.communication > 0 ? stats.communication.toFixed(1) : '0'}/5</strong></span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">👍 <strong style="color: #2e7d32;">${stats.recommendationRate}%</strong> recommend</span>
            <span style="background: #ffffff; border: 1px solid #c8e6c9; padding: 3px 10px; border-radius: 12px; font-weight: 500;">✓ <strong style="color: #2e7d32;">${stats.tasksCompleted}</strong> tasks</span>
          </div>

          <!-- Verification Status & Member Date -->
          <div style="font-size: 0.86rem; color: #2e7d32; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>${isFullyVerified ? '🛡️ Multi-Level Verified Volunteer ✅' : '⏳ Background Clearance Pending'}</span>
            <span style="color: #a5d6a7;">•</span>
            <span style="color: #555; font-weight: 500;">Joined: ${memberSince}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Multi-Level Verification Clearances -->
    <div style="margin-bottom: 1.2rem; background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 1rem;">
      <h4 style="color: #1b5e20; margin-top: 0; margin-bottom: 10px; font-size: 1.05rem; display: flex; align-items: center; gap: 6px;">
        🛡️ Admin &amp; Police Verification Clearances:
      </h4>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <span class="skill-tag" style="background: ${isIdVerified ? '#e8f5e9' : '#ffebee'}; color: ${isIdVerified ? '#2e7d32' : '#c62828'}; border: 1px solid ${isIdVerified ? '#a5d6a7' : '#ef9a9a'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          📄 Govt Photo ID: ${isIdVerified ? 'Verified ✅' : 'Pending'}
        </span>
        <span class="skill-tag" style="background: ${isPoliceVerified ? '#e8f5e9' : '#fff3e0'}; color: ${isPoliceVerified ? '#2e7d32' : '#e65100'}; border: 1px solid ${isPoliceVerified ? '#a5d6a7' : '#ffe082'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          👮 Police Check: ${isPoliceVerified ? 'Clearance Approved ✅' : 'Pending Admin Clearance'}
        </span>
        <span class="skill-tag" style="background: ${isPhoneVerified ? '#e8f5e9' : '#ffebee'}; color: ${isPhoneVerified ? '#2e7d32' : '#c62828'}; border: 1px solid ${isPhoneVerified ? '#a5d6a7' : '#ef9a9a'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          📞 Phone: ${isPhoneVerified ? 'Verified ✅' : 'Unverified'}
        </span>
        <span class="skill-tag" style="background: ${isEmailVerified ? '#e8f5e9' : '#ffebee'}; color: ${isEmailVerified ? '#2e7d32' : '#c62828'}; border: 1px solid ${isEmailVerified ? '#a5d6a7' : '#ef9a9a'}; font-weight: bold; font-size: 0.88rem; padding: 6px 12px;">
          📧 Email: ${isEmailVerified ? 'Verified ✅' : 'Unverified'}
        </span>
      </div>
    </div>

    <!-- Contact Details -->
    <div style="margin-bottom: 1.2rem; background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 1rem;">
      <h4 style="color: #1565c0; margin-top: 0; margin-bottom: 10px; font-size: 1.05rem;">📞 Direct Contact Details:</h4>
      <p style="margin: 6px 0; font-size: 1rem;">
        <strong>Phone:</strong> <a href="tel:${vPhone}" style="color: #1565c0; font-weight: bold; text-decoration: none;">${vPhone}</a>
      </p>
      <p style="margin: 6px 0; font-size: 1rem;">
        <strong>Email:</strong> <a href="mailto:${vEmail}" style="color: #1565c0; text-decoration: none;">${vEmail}</a>
      </p>
    </div>

    <!-- Skills & Expertise -->
    <div style="background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 1rem;">
      <h4 style="color: #2e7d32; margin-top: 0; margin-bottom: 10px; font-size: 1.05rem;">🧰 Volunteer Skills &amp; Capabilities:</h4>
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

  if (banner) banner.style.display = 'flex';
  if (nameEl) nameEl.textContent = senior.name;
  if (phoneEl) phoneEl.textContent = `📞 ${senior.phone || 'Phone not available'}`;
  if (addressEl) addressEl.textContent = `🏠 ${senior.address || 'Address not available'}`;
  if (nameInlineEl) nameInlineEl.textContent = `${senior.name}'s`;
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

// ──────────────────────────────────────────────────────────
// RENDER SECTION 1: SENIOR HELP REQUESTS & FULFILLMENT DECISIONS
// ──────────────────────────────────────────────────────────
function renderSeniorHelpRequests(seniorRequests) {
  const container = document.getElementById('seniorRequestsList');
  const badge = document.getElementById('seniorReqBadge');
  if (!container) return;

  if (badge) {
    if (seniorRequests.length > 0) {
      badge.textContent = seniorRequests.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (seniorRequests.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; border: 3px dashed #e65100; border-radius: var(--border-radius); background: #fff8e1;">
        <p style="font-size: 1.2rem; color: #e65100; font-weight: bold;">✅ No new senior help requests requiring decision right now.</p>
        <p style="font-size: 0.95rem; color: #777; margin-top: 6px;">When your senior citizen submits a request, it will appear here for you to fulfill yourself, allot to volunteers, or reject.</p>
      </div>`;
    return;
  }

  container.innerHTML = seniorRequests.map(req => {
    const urgencyBadge = req.urgency === 'emergency'
      ? `<span class="badge badge-urgency-emergency">🚨 SOS Emergency</span>`
      : req.urgency === 'high'
        ? `<span class="badge badge-urgency-high">⚠️ High Priority</span>`
        : `<span class="badge badge-urgency">${req.urgency.charAt(0).toUpperCase() + req.urgency.slice(1)} Priority</span>`;

    return `
      <div class="approval-card" id="seniorCard-${req._id}" style="border-left: 5px solid #e65100;">
        <div class="approval-card-header">
          <div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #e65100;">📋 ${escapeHTML(req.title)}</div>
            <div style="font-size: 0.95rem; color: #777; margin-top: 4px;">
              Category: <strong>${escapeHTML(req.category)}</strong> · Raised: ${new Date(req.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${urgencyBadge}
            <span class="badge" style="background:#ffe082;color:#e65100;font-weight:bold;">⏳ Awaiting Fulfillment Decision</span>
          </div>
        </div>

        ${req.description ? `<p style="margin-bottom: 1.2rem; color: #444; font-size: 1.05rem;">${escapeHTML(req.description)}</p>` : ''}
        ${req.audioFile ? `<div class="request-audio-player"><label>🎙️ Senior's Spoken Voice Message:</label><audio controls src="${req.audioFile}"></audio></div>` : ''}
        ${req.shoppingPreference ? `
          <div style="margin-top: 10px; margin-bottom: 12px; padding: 10px 14px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 8px; font-size: 0.98rem; color: #0d47a1; font-weight: 600;">
            🛒 <strong>Shopping Preference:</strong> ${escapeHTML(req.shoppingPreference)}
          </div>` : ''}

        <!-- Fulfillment Decision Action Buttons -->
        <div class="approval-actions" style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 1.2rem;">
          <button
            class="btn"
            onclick="fulfillRequestSelf('${req._id}')"
            style="background-color: #2e7d32; color: #ffffff !important; font-weight: 700; flex: 1; min-width: 180px; padding: 14px; font-size: 1.05rem;"
            aria-label="Fulfill request yourself"
          >
            🙋 I will fulfill this myself
          </button>

          <button
            class="btn"
            onclick="approveVolunteer('${req._id}')"
            style="background-color: #1565c0; color: #ffffff !important; font-weight: 700; flex: 1; min-width: 180px; padding: 14px; font-size: 1.05rem;"
            aria-label="Allot to volunteers"
          >
            🤝 Allot to Volunteers
          </button>

          <button
            class="btn btn-reject"
            onclick="openRejectModal('${req._id}')"
            style="background-color: #c62828; color: #ffffff !important; font-weight: 700; flex: 1; min-width: 140px; padding: 14px; font-size: 1.05rem;"
            aria-label="Reject request"
          >
            ❌ Reject Request
          </button>
        </div>

        <p style="font-size: 0.9rem; color: #777; margin-top: 1rem; margin-bottom: 0;">
          🛡️ Choose whether you want to fulfill this request directly for your loved one, publish it to community volunteers, or reject it.
        </p>
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
      <div style="padding: 2rem; text-align: center; border: 3px dashed #1565c0; border-radius: var(--border-radius); background: #e3f2fd;">
        <p style="font-size: 1.2rem; color: #0d47a1; font-weight: bold;">✅ No volunteers waiting for approval right now.</p>
        <p style="font-size: 0.95rem; color: #555; margin-top: 6px;">When a community volunteer accepts an allotted request and quotes their service fee, their profile will appear here for your review.</p>
      </div>`;
    return;
  }

  approvalList.innerHTML = awaitingRequests.map(req => {
    const vol = req.volunteer;
    const volName = vol ? escapeHTML(vol.name) : 'Volunteer Assigned';
    const volPhone = vol ? escapeHTML(vol.phone || 'Not provided') : '—';
    const volEmail = vol ? escapeHTML(vol.email || 'Not provided') : '—';
    const volSkills = vol && vol.skills && vol.skills.length > 0
      ? vol.skills.map(s => `<span class="skill-tag">${escapeHTML(s)}</span>`).join('')
      : `<span class="skill-tag" style="background:#eee; color:#888;">No specific skills listed</span>`;

    const urgencyBadge = req.urgency === 'emergency'
      ? `<span class="badge badge-urgency-emergency">🚨 SOS Emergency</span>`
      : req.urgency === 'high'
        ? `<span class="badge badge-urgency-high">⚠️ High Priority</span>`
        : `<span class="badge badge-urgency">${req.urgency.charAt(0).toUpperCase() + req.urgency.slice(1)} Priority</span>`;

    return `
      <div class="approval-card" id="approvalCard-${req._id}" style="border-left: 5px solid #1565c0;">
        <div class="approval-card-header">
          <div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #1565c0;">📋 ${escapeHTML(req.title)}</div>
            <div style="font-size: 0.95rem; color: #777; margin-top: 4px;">
              Category: <strong>${escapeHTML(req.category)}</strong> · Raised: ${new Date(req.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${urgencyBadge}
            <span class="badge" style="background:#bbdefb;color:#0d47a1;font-weight:bold;">⏳ Volunteer Approval Needed</span>
          </div>
        </div>

        ${req.description ? `<p style="margin-bottom: 1.2rem; color: #444;">${escapeHTML(req.description)}</p>` : ''}
        ${req.audioFile ? `<div class="request-audio-player"><label>🎙️ Senior's Voice Message:</label><audio controls src="${req.audioFile}"></audio></div>` : ''}
        ${req.shoppingPreference ? `
          <div style="margin-top: 10px; margin-bottom: 12px; padding: 10px 14px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 8px; font-size: 0.98rem; color: #0d47a1; font-weight: 600;">
            🛒 <strong>Shopping Preference:</strong> ${escapeHTML(req.shoppingPreference)}
          </div>` : ''}

        <div style="margin-top: 1rem;">
          <h4 style="color: #1565c0; margin-bottom: 0.5rem; font-size: 1.1rem;">
            👥 Volunteers Who Accepted &amp; Quoted Service Fees (${(req.volunteerQuotes && req.volunteerQuotes.length) ? req.volunteerQuotes.length : 1}):
          </h4>
          
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
                ? volObj.skills.map(s => `<span class="skill-tag">${escapeHTML(s)}</span>`).join('')
                : `<span class="skill-tag" style="background:#eee; color:#888;">No specific skills listed</span>`;

              const feeText = (q.serviceFee !== undefined && q.serviceFee > 0) ? `₹${q.serviceFee}` : '₹0 (Voluntary / Free Service)';

              return `
                <div class="volunteer-profile-card" style="background: #ffffff; border: 2px solid #1565c0; border-radius: 12px; padding: 1.2rem; margin-top: 0.8rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
                    <div class="volunteer-avatar" aria-hidden="true" style="font-size: 2rem;">🙋</div>
                    <div class="volunteer-info" style="flex: 1; min-width: 200px;">
                      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
                        <h4 style="margin: 0; font-size: 1.25rem; color: var(--color-primary-dark);">${vName}</h4>
                        <button type="button" class="btn btn-secondary" onclick="viewVolunteerProfile('${vId}')" style="padding: 4px 12px; font-size: 0.88rem; border-radius: 16px; background: #e3f2fd; color: #1565c0; border: 1.5px solid #90caf9; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                          👤 View Volunteer Profile
                        </button>
                      </div>
                      <p style="margin: 4px 0;">📞 <a href="tel:${vPhone}" style="color: var(--color-primary-dark); font-weight: bold;">${vPhone}</a></p>
                      <p style="margin: 4px 0;">📧 ${vEmail}</p>
                      <div class="volunteer-skills" style="margin-top: 6px;">${vSkills}</div>
                    </div>

                    <div style="flex: 1; min-width: 250px;">
                      <div style="padding: 12px 16px; background-color: #e8f5e9; border: 3px solid #2e7d32; border-radius: 10px;">
                        <span style="font-size: 1.15rem; font-weight: 800; color: #1b5e20;">
                          💰 Quoted Service Charge: ${feeText}
                        </span>
                        <p style="color: #2e7d32; font-size: 0.9rem; margin-top: 4px; margin-bottom: 0;">
                          🛒 Extra purchase costs (receipts) added upon completion.
                        </p>
                        ${q.volunteerNotes ? `<p style="color: #333; font-size: 0.92rem; margin-top: 6px; margin-bottom: 0; font-style: italic; background: #fff; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #2e7d32;">💬 "${escapeHTML(q.volunteerNotes)}"</p>` : ''}
                      </div>

                      <div style="margin-top: 10px;">
                        <button
                          class="btn"
                          onclick="openSelectVolunteerConfirmModal('${req._id}', '${vId}', '${escapeHTML(vName).replace(/'/g, "\\'")}', '${escapeHTML(feeText).replace(/'/g, "\\'")}')"
                          style="background-color: #1565c0; color: #ffffff !important; font-weight: 700; width: 100%; padding: 12px; font-size: 1.05rem;"
                          aria-label="Select and approve this volunteer"
                        >
                          ✅ Select &amp; Approve ${vName} (${feeText})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>`;
            }).join('');
          })()}
        </div>

        <!-- Additional Actions: Caregiver Decision -->
        <div class="approval-actions" style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 1.2rem;">
          <button
            class="btn"
            onclick="fulfillRequestSelf('${req._id}')"
            style="background-color: #2e7d32; color: #ffffff !important; font-weight: 700; flex: 1; min-width: 180px; padding: 12px; font-size: 1rem;"
            aria-label="Fulfill request yourself"
          >
            🙋 Fulfill Myself Instead
          </button>

          <button
            class="btn btn-reject"
            onclick="openRejectModal('${req._id}')"
            style="background-color: #c62828; color: #ffffff !important; font-weight: 700; flex: 1; min-width: 140px; padding: 12px; font-size: 1rem;"
            aria-label="Reject volunteer requests"
          >
            ❌ Reject All Volunteer Quotes
          </button>
        </div>

        <p style="font-size: 0.9rem; color: #777; margin-top: 1rem; margin-bottom: 0;">
          🔒 Once you select a volunteer, the task will be assigned exclusively to them.
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

  if (badge) {
    if (pendingVerifications.length > 0) {
      badge.textContent = pendingVerifications.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (pendingVerifications.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.2rem; text-align: center; border: 2px dashed var(--color-primary-light); border-radius: var(--border-radius); background: #f1f8e9;">
        <p style="color: var(--color-primary-dark); font-weight: bold;">No pending delivery or receipt verifications at this time.</p>
        <p style="font-size: 0.95rem; margin-top: 5px;">When a volunteer submits purchase cost proof or uploads a store receipt, it will appear here for your review.</p>
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
        <button type="button" onclick="directReleaseServiceCharge('${req._id}', '${resolvedFee}', '${escapeHTML(volName).replace(/'/g, "\\'")}')" style="background-color: #2e7d32; color: #ffffff !important; padding: 12px 20px; font-size: 1.05rem; font-weight: 700; cursor: pointer; border-radius: 10px; border: none; display: flex; align-items: center; justify-content: center; text-align: center; gap: 8px; box-shadow: 0 4px 10px rgba(46,125,50,0.3); min-height: 52px; width: 340px; max-width: 95%;">
          ✅ Release Volunteer Service Charge (₹${resolvedFee})
        </button>` : `
        <button type="button" onclick="approvePurchaseFunding('${req._id}', '${req.actualPurchaseCost || 0}', '${resolvedFee}', '${escapeHTML(volName).replace(/'/g, "\\'")}')" style="background-color: #2e7d32; color: #ffffff !important; padding: 12px 20px; font-size: 1.05rem; font-weight: 700; cursor: pointer; border-radius: 10px; border: none; display: flex; align-items: center; justify-content: center; text-align: center; gap: 8px; box-shadow: 0 4px 10px rgba(46,125,50,0.3); min-height: 52px; width: 320px; max-width: 90%;">
          ✅ Approve Payment (₹${req.actualPurchaseCost || 0}) &amp; Release Funds
        </button>`;

      cardContent = `
        <div style="margin: 12px 0; padding: 16px 18px; background: #fff8e1; border-left: 5px solid #e65100; border-radius: 12px; font-size: 1rem; color: #bf360c;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; border-bottom: 1px dashed #ffe0b2; padding-bottom: 8px;">
            <span style="font-weight: 700; color: #e65100; font-size: 1.2rem;">💳 Volunteer Submitted Purchase Cost: <strong style="font-size: 1.3rem; color: #d84315;">₹${req.actualPurchaseCost || 0}</strong></span>
            ${req.purchaseNotes ? `<span style="font-size: 1rem; color: #444; font-style: italic; background: #fff3e0; padding: 4px 10px; border-radius: 6px;">Notes: "${escapeHTML(req.purchaseNotes)}"</span>` : ''}
          </div>
          <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 8px;">
            <div style="flex: 1; min-width: 280px;">${proofSlider}</div>
            <div style="flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 16px; justify-content: center; align-items: center; padding: 0 10px;">
              ${approveBtnHtml}
              <button type="button" onclick="openRejectRevisionModal('${req._id}', '${escapeHTML(req.title).replace(/'/g, "\\'")}', '${escapeHTML(req.category).replace(/'/g, "\\'")}')" style="background-color: #c62828; color: #ffffff !important; padding: 12px 20px; font-size: 1.05rem; font-weight: 700; cursor: pointer; border-radius: 10px; border: none; display: flex; align-items: center; justify-content: center; text-align: center; gap: 8px; box-shadow: 0 4px 10px rgba(198,40,40,0.3); min-height: 52px; width: 320px; max-width: 90%;">
                ❌ Reject / Request Revision &amp; Send Note
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
        <div style="margin: 1rem 0; background: #ffffff; padding: 12px; border-radius: 12px; border: 2px solid var(--color-primary-light);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-weight: bold; color: var(--color-primary-dark); font-size: 1rem;">📸 Uploaded Store Receipt / Delivery Photo Proof:</label>
          </div>
          ${proofSlider}
        </div>` : `<div style="margin: 10px 0; color: #888; font-style: italic;">No photo proof attached by volunteer.</div>`;

      cardContent = `
        <div style="font-size: 1rem; color: #444; margin-bottom: 10px;">
          <strong>Volunteer Completion Notes:</strong> "${escapeHTML(req.resolutionNotes || 'Assistance successfully provided.')}"
        </div>
        ${proofHtml}
        <div class="approval-actions" style="display: flex; gap: 12px; margin-top: 1rem;">
          <button
            class="btn btn-approve"
            onclick="verifyTaskCompletion('${req._id}', true)"
            style="background-color: #2e7d32; flex: 1; padding: 12px; font-size: 1.05rem;"
          >
            💳 Verify Proof &amp; Proceed to Payment
          </button>
          <button
            class="btn btn-reject"
            onclick="verifyTaskCompletion('${req._id}', false)"
            style="background-color: #c62828; color: #ffffff !important; flex: 1; padding: 12px; font-size: 1.05rem; font-weight: 700;"
          >
            ❌ Reject / Report Issue
          </button>
        </div>`;
    }

    return `
      <div class="approval-card" id="completionCard-${req._id}" style="border-color: var(--color-primary-dark); background: #f9fbe7; margin-bottom: 1.5rem;">
        <div class="approval-card-header">
          <div>
            <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
            <h3 style="color: var(--color-primary-dark); margin-top: 6px; font-size: 1.3rem;">${escapeHTML(req.title)}</h3>
          </div>
          <span class="badge" style="background-color: var(--color-primary-dark); color: #fff;">📸 Delivery &amp; Receipt Verification</span>
        </div>

        ${cardContent}

        <div class="volunteer-profile-card" style="margin-top: 12px;">
          <div class="volunteer-avatar">🤝</div>
          <div class="volunteer-info" style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <h4 style="margin: 0;">${escapeHTML(volName)}</h4>
              ${volId ? `<button type="button" class="btn btn-secondary" onclick="viewVolunteerProfile('${volId}')" style="padding: 4px 12px; font-size: 0.85rem; border-radius: 16px; background: #e3f2fd; color: #1565c0; border: 1.5px solid #90caf9; font-weight: bold; cursor: pointer;">👤 View Volunteer Profile</button>` : ''}
            </div>
            <p style="margin-top: 4px;">📞 Phone: ${escapeHTML(volPhone)}</p>
          </div>
        </div>
      </div>`;
  }).join('');
}

let currentFeedbackRequestId = null;

// Verification action endpoint for family caregivers
async function verifyTaskCompletion(requestId, approved) {
  if (approved) {
    try {
      const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
        approved: true
      });
      if (res.ok && res.data.success) {
        showToast('✅ Store receipt verified & service charge released!', 'success');
        currentFeedbackRequestId = requestId;
        let volName = 'Assigned Volunteer';
        if (res.data.request && res.data.request.volunteer) {
          volName = typeof res.data.request.volunteer === 'object' ? res.data.request.volunteer.name : 'Assigned Volunteer';
        }
        promptForVolunteerTip(requestId, volName, { actionType: 'direct' });
      } else {
        alert(res.data?.message || 'Error verifying completion receipt');
      }
    } catch (e) {
      console.error(e);
      alert('Network error verifying task receipt');
    }
    return;
  }

  const reason = prompt("Please enter the reason for rejecting or reporting an issue with this completion:") || 'Rejected by family caregiver';

  const res = await apiCall(`/requests/${requestId}/verify-completion-family`, 'PUT', {
    approved: false,
    rejectionReason: reason
  });

  if (res.ok && res.data.success) {
    showToast('Task completion marked as rejected.', 'error');
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

  const { requestId, itemsCost, serviceFee } = pendingTipContext;
  window.location.href = `/payment.html?requestId=${requestId}&type=tip&tipAmount=${tipAmount}&itemsCost=${itemsCost || 0}&serviceFee=${serviceFee || 0}`;
};

window.skipTipAndAskRatings = function() {
  const modal = document.getElementById('askTipModal');
  if (modal) modal.style.display = 'none';

  if (!pendingTipContext) return;

  if (pendingTipContext.actionType === 'purchase') {
    const { requestId, itemsCost, serviceFee } = pendingTipContext;
    window.location.href = `/payment.html?requestId=${requestId}&type=purchase&itemsCost=${itemsCost || 0}&serviceFee=${serviceFee || 0}`;
  } else {
    openFeedbackModal(pendingTipContext.volName);
  }
};

window.skipFeedbackAndGoHome = function() {
  const modal = document.getElementById('feedbackModal');
  if (modal) modal.style.display = 'none';
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
    scoreBadge.textContent = `${count} / 5 ⭐`;
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
    scoreBadge.textContent = `${count} / 5 ⭐`;
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
      scoreBadge.textContent = `${currentVal} / 5 ⭐`;
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
      showToast('⭐ Thank you! Your rating & review have been submitted.', 'success');
    } catch (err) {
      console.error('Error submitting volunteer feedback:', err);
    }
  }

  const modal = document.getElementById('feedbackModal');
  if (modal) modal.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = '⭐ Submit Rating & Finish ➔';
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
        ◀
      </button>

      <button type="button" onclick="event.stopPropagation(); navigateProofSlider('${reqId}', 1)" style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: #ffffff; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.3rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 3; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: all 0.15s ease;" onmouseover="this.style.background='rgba(0,0,0,0.9)'; this.style.transform='translateY(-50%) scale(1.1)'" onmouseleave="this.style.background='rgba(0,0,0,0.6)'; this.style.transform='translateY(-50%) scale(1)'">
        ▶
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
      showToast('✅ Volunteer service charge released!', 'success');
      currentFeedbackRequestId = requestId;
      let resolvedVolName = volName || 'Assigned Volunteer';
      if (res.data.request && res.data.request.volunteer) {
        resolvedVolName = typeof res.data.request.volunteer === 'object' ? res.data.request.volunteer.name : resolvedVolName;
      }
      promptForVolunteerTip(requestId, resolvedVolName, { serviceFee: feeAmount, actionType: 'direct' });
    } else {
      alert(res.data?.message || 'Error releasing service charge');
    }
  } catch (e) {
    console.error(e);
    alert('Network error releasing service charge');
  }
};

// Step 6-7: Caregiver proceeds to payment page for purchase cost + service charge approval
function approvePurchaseFunding(requestId, amount, serviceFee, volName) {
  if (Number(amount || 0) === 0) {
    directReleaseServiceCharge(requestId, serviceFee, volName);
    return;
  }
  promptForVolunteerTip(requestId, volName || 'Assigned Volunteer', {
    itemsCost: amount,
    serviceFee: serviceFee,
    actionType: 'purchase'
  });
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
      showToast('✉️ Revision note sent to volunteer! Task returned for updated cost/proof.', 'info');
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
    showToast('✅ Request marked as fulfilled by you! Your senior has been notified.', 'success');
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
    allRequestsList.innerHTML = `<div style="text-align: center; color: #666; padding: 2rem;">No help requests have been made yet.</div>`;
    return;
  }

  // Sort requests: Completed tasks FIRST (most recently fulfilled/verified at position #1), followed by remaining requests
  const completedStatuses = ['completed', 'fulfilled_by_family'];
  const getFulfillmentTimestamp = (r) => {
    if (r.completedAt) return new Date(r.completedAt).getTime();
    if (r.verifiedAt) return new Date(r.verifiedAt).getTime();
    if (r.serviceChargeReleasedAt) return new Date(r.serviceChargeReleasedAt).getTime();
    if (r.familyReviewedAt) return new Date(r.familyReviewedAt).getTime();
    if (r.updatedAt) return new Date(r.updatedAt).getTime();
    if (r.createdAt) return new Date(r.createdAt).getTime();
    if (r._id) return parseInt(String(r._id).substring(0, 8), 16) * 1000;
    return 0;
  };

  const sortedRequests = [...requests].sort((a, b) => {
    const aCompleted = completedStatuses.includes(a.status) || a.fulfilledByFamily;
    const bCompleted = completedStatuses.includes(b.status) || b.fulfilledByFamily;

    if (aCompleted && !bCompleted) return -1;
    if (!aCompleted && bCompleted) return 1;

    return getFulfillmentTimestamp(b) - getFulfillmentTimestamp(a);
  });

  allRequestsList.innerHTML = sortedRequests.map(req => {
    let statusBadge = '';
    let statusColor = 'var(--color-primary-dark)';

    const isFulfilledByFamily = req.status === 'fulfilled_by_family' || req.fulfilledByFamily;

    if (isFulfilledByFamily) {
      statusBadge = `<span class="badge" style="background:#e8f5e9;color:#1b5e20;border:2px solid #2e7d32;font-weight:bold;">🏡 Fulfilled by Family Caregiver</span>`;
      statusColor = '#2e7d32';
    } else if (req.status === 'pending') {
      statusBadge = `<span class="badge badge-pending">🔍 Allotted to Volunteers</span>`;
    } else if (req.status === 'awaiting_approval') {
      statusBadge = `<span class="badge" style="background:#ffe082;color:#e65100;">⏳ Awaiting Your Decision</span>`;
      statusColor = '#e65100';
    } else if (req.status === 'accepted') {
      statusBadge = `<span class="badge badge-accepted">✅ Volunteer Assigned</span>`;
    } else if (req.status === 'purchase_cost_submitted') {
      statusBadge = `<span class="badge" style="background:#fff3e0;color:#e65100;border:1.5px solid #ffe0b2;font-weight:bold;">💳 Purchase Cost (₹${req.actualPurchaseCost || 0}) Submitted</span>`;
      statusColor = '#e65100';
    } else if (req.status === 'purchase_funded') {
      statusBadge = `<span class="badge" style="background:#e8f5e9;color:#1b5e20;border:1.5px solid #a5d6a7;font-weight:bold;">✅ Purchase Funded (₹${req.actualPurchaseCost || 0})</span>`;
      statusColor = '#2e7d32';
    } else if (req.status === 'awaiting_verification') {
      statusBadge = `<span class="badge" style="background:#f3e5f5;color:#4a148c;border:1.5px solid #ce93d8;font-weight:bold;">🧾 Receipt Uploaded - Needs Verification</span>`;
      statusColor = '#7b1fa2';
    } else if (req.status === 'completed') {
      statusBadge = `<span class="badge badge-completed">🏆 Completed &amp; Service Charge Released</span>`;
    }

    // Status timeline: Submitted -> Volunteer Assigned -> Purchase Funded -> Service In Progress -> Delivered and Paid -> Completed
    const isVolAssigned = Boolean(req.volunteer) || req.status !== 'pending';
    const isPurchaseFunded = Boolean(req.purchasePaymentDetails || req.purchaseFunded || req.status === 'purchase_funded' || req.status === 'awaiting_verification' || req.status === 'completed');
    const isServiceInProgress = req.status === 'accepted' || req.status === 'purchase_cost_submitted' || isPurchaseFunded;
    const isDeliveredAndPaid = req.status === 'awaiting_verification' || req.status === 'completed' || req.serviceChargeReleased;
    const isCompleted = req.status === 'completed';

    const timeline = isFulfilledByFamily ? `
      <div class="request-timeline">
        <div class="timeline-step done">📝 Submitted</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step done">❤️ Family Decision</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step done" style="color:#2e7d32; font-weight:bold;">🏡 Fulfilled by You</div>
      </div>` : `
      <div class="request-timeline">
        <div class="timeline-step done">📝 Submitted</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${isVolAssigned ? 'done' : 'future'}">🙋 Volunteer Assigned</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${isPurchaseFunded ? 'done' : (req.status === 'purchase_cost_submitted' ? 'active' : 'future')}">💳 Purchase Funded</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${isServiceInProgress ? 'done' : 'future'}">🤝 Service In Progress</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${isDeliveredAndPaid ? 'done' : (req.status === 'awaiting_verification' ? 'active' : 'future')}">🚚 Delivered and Paid</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${isCompleted ? 'done' : 'future'}">✅ Completed</div>
      </div>`;

    let volunteerInfo = '';
    if (req.volunteer && (req.status === 'accepted' || req.status === 'completed' || req.status === 'awaiting_approval')) {
      const volObj = req.volunteer;
      const vName = typeof volObj === 'object' ? volObj.name : 'Volunteer';
      const vId = typeof volObj === 'object' ? (volObj._id || volObj.id) : volObj;
      const feeLabel = (req.serviceFee !== undefined && req.serviceFee > 0) ? `₹${req.serviceFee}` : '₹0 (Voluntary / Free Service)';

      volunteerInfo = `
        <div class="request-details" style="margin-top: 1rem; background: #f9f9f9; padding: 12px; border-radius: 8px; border-left: 4px solid var(--color-primary-dark);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <p style="margin: 0; font-size: 1.05rem;"><strong>Volunteer:</strong> <span style="color: var(--color-primary-dark); font-weight: bold;">${escapeHTML(vName)}</span></p>
            ${vId ? `<button type="button" class="btn btn-secondary" onclick="viewVolunteerProfile('${vId}')" style="padding: 4px 12px; font-size: 0.85rem; border-radius: 16px; background: #ffffff; color: #1565c0; border: 1.5px solid #90caf9; font-weight: bold; cursor: pointer;">👤 View Volunteer Profile</button>` : ''}
          </div>
          <p style="margin-top: 6px;"><strong>💰 Quoted Service Charge:</strong> <span style="color: #2e7d32; font-weight: bold;">${feeLabel}</span></p>
          ${req.status !== 'awaiting_approval' && typeof volObj === 'object' ? `<p style="margin-top: 4px;"><strong>Contact:</strong> ${escapeHTML(volObj.phone || '—')}</p>` : ''}
          ${req.volunteerNotes ? `<p style="margin-top: 4px; font-style: italic;"><strong>Volunteer Message:</strong> "${escapeHTML(req.volunteerNotes)}"</p>` : ''}
          ${req.status === 'completed' && req.resolutionNotes ? `<p style="margin-top: 6px;"><strong>Completion Notes:</strong> ${escapeHTML(req.resolutionNotes)}</p>` : ''}
          ${req.familyReviewedBy ? `<p style="margin-top: 4px; font-size: 0.9rem; color: #666;">Reviewed by caregiver on ${new Date(req.familyReviewedAt).toLocaleDateString()}</p>` : ''}
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

      const paidTotal = Number(req.paymentDetails ? req.paymentDetails.amountPaid : 0);

      let tipVal = Number(req.tipAmount || (req.paymentDetails ? req.paymentDetails.tipAmount : 0) || (req.tipPaymentDetails ? req.tipPaymentDetails.amountPaid : 0)) || 0;
      if (tipVal === 0 && paidTotal > (itemCostVal + serviceFeeVal)) {
        tipVal = paidTotal - (itemCostVal + serviceFeeVal);
      }

      const totalSpent = paidTotal > 0 ? paidTotal : (itemCostVal + serviceFeeVal + tipVal);

      const breakdownText = `Items Purchased ₹${itemCostVal} + Volunteer Charge ₹${serviceFeeVal}${tipVal > 0 ? ` + Tip ₹${tipVal}` : ''}`;

      totalSpentHtml = `
        <div style="margin-top: 12px; padding: 14px 18px; background: #e8f5e9; border: 2px solid #a5d6a7; border-left: 6px solid #2e7d32; border-radius: 12px; box-shadow: 0 2px 8px rgba(46,125,50,0.08);">
          <div style="font-size: 1.15rem; font-weight: 800; color: #1b5e20;">
            💵 Total Amount Spent: <strong style="font-size: 1.3rem; color: #2e7d32;">₹${totalSpent}</strong>
          </div>
          <div style="margin-top: 6px; font-size: 0.9rem; color: #388e3c; font-weight: 500;">
            Breakdown: ${breakdownText}
          </div>
        </div>`;
    }

    if (req.familyRejectionReason && req.familyApprovalStatus === 'rejected') {
      volunteerInfo += `
        <div style="margin-top: 8px; padding: 10px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #f57f17;">
          <p style="font-size: 0.9rem; color: #e65100;"><strong>Previous Rejection Reason:</strong> ${escapeHTML(req.familyRejectionReason)}</p>
        </div>`;
    }

    let stepActionHtml = '';

    let audioHtml = '';

    let finalImages = req.finalReceiptDocs && req.finalReceiptDocs.length > 0 
      ? req.finalReceiptDocs 
      : (req.completionProof ? [req.completionProof] : []);

    let proofSlider = renderProofSliderHtml(req._id, finalImages);

    let proofHtml = proofSlider ? `
      <div style="margin-top: 10px; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid var(--color-primary-light);">
        <div style="font-weight: bold; color: var(--color-primary-dark); font-size: 0.9rem; margin-bottom: 6px;">📸 Uploaded Store Receipt / Delivery Photo Proof:</div>
        ${proofSlider}
      </div>` : '';

    return `
      <div class="request-card">
        <div class="request-card-header">
          <div class="request-title" style="color: ${statusColor};">${escapeHTML(req.title)}</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${statusBadge}
            <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
          </div>
        </div>
        ${req.description ? `<div class="request-description">${escapeHTML(req.description)}</div>` : ''}
        ${req.shoppingPreference ? `
          <div style="margin-top: 6px; margin-bottom: 10px; padding: 8px 12px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 8px; font-size: 0.95rem; color: #0d47a1; font-weight: 600;">
            🛒 <strong>Caregiver Shopping Preference:</strong> ${escapeHTML(req.shoppingPreference)}
          </div>` : ''}
        ${audioHtml}
        ${proofHtml}
        ${stepActionHtml}
        ${timeline}
        ${volunteerInfo}
        ${totalSpentHtml}
        <div style="font-size: 0.85rem; color: #999; margin-top: 0.8rem;">
          Submitted: ${new Date(req.createdAt).toLocaleDateString()}
        </div>
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
    btnConfirm.textContent = `✅ Confirm & Assign ${escapeHTML(volName)}`;
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
    showToast(res.data.message || `✅ ${volName} approved and task assigned successfully!`, 'success');
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
    btnConfirm.textContent = volunteerId ? `✅ Confirm & Assign ${volName || 'Volunteer'}` : '🤝 Confirm & Allot Task';
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
  let origText = '';
  if (btnConfirm) {
    origText = btnConfirm.textContent;
    btnConfirm.textContent = 'Allotting...';
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
    btnConfirm.textContent = origText;
    btnConfirm.disabled = false;
  }

  if (res.ok && res.data.success) {
    showToast(res.data.message || '✅ Task allotted with shopping preferences!', 'success');
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
