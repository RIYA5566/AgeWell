// AgeWell — Family/Caregiver Dashboard Client Script

let activeRejectRequestId = null;
let pollInterval = null;

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
    const input = document.getElementById('rejectionReasonInput');
    if (input) input.value = '';
  };

  if (rejectModalClose) rejectModalClose.addEventListener('click', closeRejectModal);
  if (btnCancelReject) btnCancelReject.addEventListener('click', closeRejectModal);
  window.addEventListener('click', (e) => {
    if (e.target === rejectModal) closeRejectModal();
  });

  if (btnConfirmReject) {
    btnConfirmReject.addEventListener('click', async () => {
      if (!activeRejectRequestId) return;
      const reason = document.getElementById('rejectionReasonInput').value.trim();
      await doRejectVolunteer(activeRejectRequestId, reason);
      closeRejectModal();
    });
  }

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

  // Show senior info banner
  populateSeniorBanner(senior);

  // Update notification badge
  updateApprovalBadge(pendingApprovalCount);

  // Render approval queue
  renderApprovalQueue(requests.filter(r => r.status === 'awaiting_approval'));

  // Render full request history
  renderAllRequests(requests);
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
    document.title = `(${count}) Action Needed – Family Portal | AgeWell`;
  } else {
    badge.style.display = 'none';
    document.title = 'Family Caregiver Portal – AgeWell';
  }
}

// ──────────────────────────────────────────────────────────
// RENDER APPROVAL QUEUE
// ──────────────────────────────────────────────────────────
function renderApprovalQueue(awaitingRequests) {
  const approvalList = document.getElementById('approvalList');
  if (!approvalList) return;

  if (awaitingRequests.length === 0) {
    approvalList.innerHTML = `
      <div style="padding: 2rem; text-align: center; border: 3px dashed #f57f17; border-radius: var(--border-radius); background: #fff8e1;">
        <p style="font-size: 1.3rem; color: #e65100;">✅ No volunteers waiting for approval right now.</p>
        <p style="font-size: 1rem; color: #888; margin-top: 8px;">When a volunteer accepts your senior's request, their profile will appear here for your review.</p>
      </div>`;
    return;
  }

  approvalList.innerHTML = awaitingRequests.map(req => {
    const vol = req.volunteer;
    const volName = vol ? escapeHTML(vol.name) : 'Unknown Volunteer';
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
      <div class="approval-card" id="approvalCard-${req._id}">
        <div class="approval-card-header">
          <div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #e65100;">📋 ${escapeHTML(req.title)}</div>
            <div style="font-size: 0.95rem; color: #777; margin-top: 4px;">
              Category: <strong>${escapeHTML(req.category)}</strong> · Raised: ${new Date(req.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${urgencyBadge}
            <span class="badge" style="background:#ffe082;color:#e65100;">⏳ Awaiting Your Approval</span>
          </div>
        </div>

        ${req.description ? `<p style="margin-bottom: 1.2rem; color: #444;">${escapeHTML(req.description)}</p>` : ''}
        ${req.audioFile ? `<div class="request-audio-player"><label>🎙️ Senior's Voice Message:</label><audio controls src="${req.audioFile}"></audio></div>` : ''}

        <!-- Volunteer Profile Card -->
        <div class="volunteer-profile-card">
          <div class="volunteer-avatar" aria-hidden="true">🙋</div>
          <div class="volunteer-info" style="flex: 1;">
            <h4>${volName}</h4>
            <p>📞 <a href="tel:${vol ? vol.phone : ''}" style="color: var(--color-primary-dark);">${volPhone}</a></p>
            <p>📧 ${volEmail}</p>
            <div class="volunteer-skills">${volSkills}</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="approval-actions">
          <button
            class="btn btn-approve"
            onclick="approveVolunteer('${req._id}')"
            aria-label="Approve ${volName} to assist with ${escapeHTML(req.title)}"
          >
            ✅ Approve Volunteer
          </button>
          <button
            class="btn btn-reject"
            onclick="openRejectModal('${req._id}')"
            aria-label="Reject ${volName}"
          >
            ❌ Reject &amp; Find Another
          </button>
        </div>

        <p style="font-size: 0.9rem; color: #888; margin-top: 1rem;">
          🔒 The volunteer's full contact details are only shared with your senior after your approval.
        </p>
      </div>`;
  }).join('');
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

  allRequestsList.innerHTML = requests.map(req => {
    let statusBadge = '';
    let statusColor = 'var(--color-primary-dark)';

    if (req.status === 'pending') {
      statusBadge = `<span class="badge badge-pending">🔍 Looking for Volunteer</span>`;
    } else if (req.status === 'awaiting_approval') {
      statusBadge = `<span class="badge" style="background:#ffe082;color:#e65100;">⏳ Awaiting Your Approval</span>`;
      statusColor = '#e65100';
    } else if (req.status === 'accepted') {
      statusBadge = `<span class="badge badge-accepted">✅ Volunteer Approved</span>`;
    } else if (req.status === 'completed') {
      statusBadge = `<span class="badge badge-completed">🏆 Completed</span>`;
    }

    // Status timeline
    const timeline = `
      <div class="request-timeline">
        <div class="timeline-step done">📝 Submitted</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${req.status !== 'pending' ? 'done' : 'future'}">🙋 Volunteer Found</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${req.status === 'awaiting_approval' ? 'active' : (req.status === 'accepted' || req.status === 'completed') ? 'done' : 'future'}">❤️ Your Approval</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${req.status === 'accepted' || req.status === 'completed' ? 'done' : 'future'}">🤝 In Progress</div>
        <span class="timeline-arrow">→</span>
        <div class="timeline-step ${req.status === 'completed' ? 'done' : 'future'}">✅ Completed</div>
      </div>`;

    let volunteerInfo = '';
    if (req.volunteer && (req.status === 'accepted' || req.status === 'completed' || req.status === 'awaiting_approval')) {
      volunteerInfo = `
        <div class="request-details" style="margin-top: 1rem;">
          <p><strong>Volunteer:</strong> ${escapeHTML(req.volunteer.name)}</p>
          ${req.status !== 'awaiting_approval' ? `<p><strong>Contact:</strong> ${escapeHTML(req.volunteer.phone || '—')}</p>` : ''}
          ${req.status === 'completed' && req.resolutionNotes ? `<p style="margin-top:6px;"><strong>Notes:</strong> ${escapeHTML(req.resolutionNotes)}</p>` : ''}
          ${req.familyReviewedBy ? `<p style="margin-top:4px; font-size: 0.9rem; color: #666;">Reviewed by you on ${new Date(req.familyReviewedAt).toLocaleDateString()}</p>` : ''}
        </div>`;
    }

    if (req.familyRejectionReason && req.familyApprovalStatus === 'rejected') {
      volunteerInfo += `
        <div style="margin-top: 8px; padding: 10px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #f57f17;">
          <p style="font-size: 0.9rem; color: #e65100;"><strong>Previous Rejection Reason:</strong> ${escapeHTML(req.familyRejectionReason)}</p>
        </div>`;
    }

    let audioHtml = req.audioFile ? `<div class="request-audio-player"><label>🎙️ Senior's Voice Message:</label><audio controls src="${req.audioFile}"></audio></div>` : '';

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
        ${audioHtml}
        ${timeline}
        ${volunteerInfo}
        <div style="font-size: 0.85rem; color: #999; margin-top: 0.8rem;">
          Submitted: ${new Date(req.createdAt).toLocaleDateString()}
        </div>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// APPROVE VOLUNTEER
// ──────────────────────────────────────────────────────────
async function approveVolunteer(requestId) {
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Approving...';
  btn.disabled = true;

  const res = await apiCall(`/requests/${requestId}/family-approve`, 'PUT');

  if (res.ok && res.data.success) {
    showToast('✅ Volunteer approved! They can now assist your senior.', 'success');
    // Animate card out
    const card = document.getElementById(`approvalCard-${requestId}`);
    if (card) {
      card.style.transition = 'opacity 0.5s, transform 0.5s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => loadFamilyDashboard(), 600);
    } else {
      loadFamilyDashboard();
    }
  } else {
    showToast(res.data?.message || 'Error approving volunteer. Please try again.', 'error');
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ──────────────────────────────────────────────────────────
// OPEN REJECT MODAL
// ──────────────────────────────────────────────────────────
function openRejectModal(requestId) {
  activeRejectRequestId = requestId;
  document.getElementById('rejectModal').style.display = 'flex';
  document.getElementById('rejectionReasonInput').focus();
}

// ──────────────────────────────────────────────────────────
// DO REJECT VOLUNTEER
// ──────────────────────────────────────────────────────────
async function doRejectVolunteer(requestId, reason) {
  const res = await apiCall(`/requests/${requestId}/family-reject`, 'PUT', {
    rejectionReason: reason || 'Rejected by family caregiver'
  });

  if (res.ok && res.data.success) {
    showToast('Volunteer rejected. The request is now available for other volunteers.', 'info');
    loadFamilyDashboard();
  } else {
    showToast(res.data?.message || 'Error rejecting volunteer. Please try again.', 'error');
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
