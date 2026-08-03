// AgeWell - Volunteer Dashboard Client Script

let activeRequestIdForCompletion = null;

document.addEventListener('DOMContentLoaded', () => {
  // Validate authentication
  const auth = checkAuthAndRedirect('volunteer');
  if (!auth) return;

  // Personalize welcome bar
  const user = JSON.parse(localStorage.getItem('user'));
  const welcomeTitle = document.getElementById('welcomeTitle');
  if (welcomeTitle && user) {
    welcomeTitle.textContent = `Welcome, ${user.name}! 👋`;
  }

  // Load requests
  loadVolunteerRequests();

  // --- Modal Logic ---
  const completionModal = document.getElementById('completionModal');
  const modalClose = document.getElementById('modalClose');
  const btnCancelComplete = document.getElementById('btnCancelComplete');

  const closeCompletionModal = () => {
    completionModal.style.display = 'none';
    activeRequestIdForCompletion = null;
    const form = document.getElementById('completionForm');
    if (form) form.reset();
  };

  if (modalClose) modalClose.addEventListener('click', closeCompletionModal);
  if (btnCancelComplete) btnCancelComplete.addEventListener('click', closeCompletionModal);

  window.addEventListener('click', (e) => {
    if (e.target === completionModal) {
      closeCompletionModal();
    }
  });

  // --- Completion Form Submit ---
  const completionForm = document.getElementById('completionForm');
  if (completionForm) {
    completionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!activeRequestIdForCompletion) return;

      const resolutionNotes = document.getElementById('resolutionNotes').value.trim();

      const res = await apiCall(`/requests/${activeRequestIdForCompletion}/complete`, 'PUT', {
        resolutionNotes: resolutionNotes || 'Assistance successfully provided.'
      });

      if (res.ok && res.data.success) {
        closeCompletionModal();
        loadVolunteerRequests();
      } else {
        alert(res.data.message || 'Error completing request');
      }
    });
  }
});

// Fetch and Render requests for Volunteers
async function loadVolunteerRequests() {
  const pendingList  = document.getElementById('pendingList');
  const awaitingList = document.getElementById('awaitingList');
  const activeList   = document.getElementById('activeList');
  const historyList  = document.getElementById('historyList');

  const spinnerHtml = `<div class="loading-wrapper"><div class="spinner"></div><span>Loading...</span></div>`;
  if (pendingList)  pendingList.innerHTML  = spinnerHtml;
  if (awaitingList) awaitingList.innerHTML = spinnerHtml;
  if (activeList)   activeList.innerHTML   = spinnerHtml;
  if (historyList)  historyList.innerHTML  = spinnerHtml;

  const res = await apiCall('/requests', 'GET');

  if (res.ok && res.data.success) {
    const requests = res.data.requests;
    const userStr = localStorage.getItem('user');
    const currentUserId = userStr ? JSON.parse(userStr).id : '';

    // Split by status, each volunteer only sees their own non-pending
    const pendingRequests   = requests.filter(r => r.status === 'pending');
    const awaitingRequests  = requests.filter(r => r.status === 'awaiting_approval' && r.volunteer && (r.volunteer._id === currentUserId || r.volunteer === currentUserId));
    // Note: volunteer is populated as an object {_id, name, ...} from the API
    const activeRequests    = requests.filter(r => r.status === 'accepted'  && r.volunteer && (r.volunteer._id === currentUserId || r.volunteer === currentUserId));
    const completedRequests = requests.filter(r => r.status === 'completed' && r.volunteer && (r.volunteer._id === currentUserId || r.volunteer === currentUserId));

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

          return `
            <div class="request-card ${urgencyClass}">
              <div class="request-card-header">
                <div class="request-title">${escapeHTML(req.title)}</div>
                <div style="display: flex; gap: 8px;">
                  <span class="badge ${req.urgency === 'emergency' ? 'badge-urgency-emergency' : req.urgency === 'high' ? 'badge-urgency-high' : 'badge-urgency'}">${urgencyLabel}</span>
                  <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
                </div>
              </div>
              <div class="request-description">${escapeHTML(req.description)}</div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 0.9rem; color: #666;">Requested on: ${new Date(req.createdAt).toLocaleDateString()}</span>
                <button class="btn btn-primary" onclick="acceptHelpRequest('${req._id}')" style="padding: 10px 20px; font-size: 1rem; min-height: 48px;">
                  🤝 Accept Request
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
          <div style="padding: 1.2rem; text-align: center; border: 2px dashed #f57f17; border-radius: var(--border-radius); background: #fff8e1;">
            <p style="color: #e65100; font-weight: bold;">No requests awaiting approval right now.</p>
          </div>`;
      } else {
        awaitingList.innerHTML = awaitingRequests.map(req => {
          const seniorName = req.senior ? req.senior.name : 'Senior Citizen';
          return `
            <div class="request-card" style="border-left: 8px solid #f57f17; background: #fff8e1;">
              <div class="request-card-header">
                <div class="request-title">${escapeHTML(req.title)}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <span class="badge" style="background: #ffe082; color: #e65100;">⏳ Awaiting Family Approval</span>
                  <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
                </div>
              </div>
              <div class="request-description">${escapeHTML(req.description)}</div>
              <div class="request-details" style="background: #fff3e0; border-color: #ffcc02;">
                <p><strong>Senior Citizen:</strong> ${escapeHTML(seniorName)}</p>
                <p style="margin-top: 6px; font-size: 0.95rem; color: #6d4c00;">
                  🔒 The senior's family/caregiver is reviewing your profile.
                  Contact details will be revealed once approved. Please stand by.
                </p>
              </div>
              <div style="margin-top: 0.8rem; font-size: 0.9rem; color: #888;">
                You accepted this on: ${new Date(req.createdAt).toLocaleDateString()}
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Active Commitments (Accepted) ---
    if (activeList) {
      if (activeRequests.length === 0) {
        activeList.innerHTML = `
          <div style="padding: 1.5rem; background: var(--color-white); border-radius: var(--border-radius); text-align: center; border: 2px dashed var(--color-primary-light);">
            <p style="color: var(--color-primary-dark); font-weight: bold;">You have no active commitments.</p>
            <p style="font-size: 0.95rem; margin-top: 5px;">Accept a request above to make a difference in someone's life!</p>
          </div>`;
      } else {
        activeList.innerHTML = activeRequests.map(req => {
          const seniorName = req.senior ? req.senior.name : 'Senior Citizen';
          const seniorPhone = req.senior ? req.senior.phone : 'Not shared';
          const seniorAddress = req.senior ? req.senior.address : 'Not shared';
          const emergencyContact = req.senior ? req.senior.emergencyContact : 'Not shared';

          return `
            <div class="request-card" style="border-color: var(--color-primary);">
              <div class="request-card-header">
                <div class="request-title">${escapeHTML(req.title)}</div>
                <div>
                  <span class="badge badge-accepted">Active Commitment</span>
                  <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
                </div>
              </div>
              <div class="request-description">${escapeHTML(req.description)}</div>
              
              <div class="request-details" style="background-color: var(--color-bg-light); border: 2px solid var(--color-primary-light);">
                <p style="font-size: 1.1rem; border-bottom: 2px solid var(--color-primary-light); padding-bottom: 5px; margin-bottom: 8px;"><strong>Senior Citizen Information:</strong></p>
                <p><strong>Name:</strong> ${escapeHTML(seniorName)}</p>
                <p><strong>Phone:</strong> <a href="tel:${seniorPhone}" style="color: var(--color-primary-dark); font-weight: bold;">${escapeHTML(seniorPhone)}</a></p>
                <p><strong>Address:</strong> ${escapeHTML(seniorAddress)}</p>
                <p><strong>Emergency Contact:</strong> ${escapeHTML(emergencyContact)}</p>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 0.9rem; color: #666;">Accepted: ${new Date(req.acceptedAt || Date.now()).toLocaleDateString()}</span>
                <button class="btn btn-primary" onclick="openCompletionModal('${req._id}')" style="padding: 10px 20px; font-size: 1rem; min-height: 48px; background-color: var(--color-primary-dark);">
                  ✅ Complete Request
                </button>
              </div>
            </div>`;
        }).join('');
      }
    }

    // --- Render Service History (Completed) ---
    if (historyList) {
      if (completedRequests.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; color: #666; padding: 1rem;">No completed requests logged yet.</div>`;
      } else {
        historyList.innerHTML = completedRequests.map(req => {
          return `
            <div class="request-card" style="opacity: 0.85; border-color: #ddd;">
              <div class="request-card-header">
                <div class="request-title" style="color: #666;">${escapeHTML(req.title)}</div>
                <div>
                  <span class="badge badge-completed">Completed</span>
                  <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
                </div>
              </div>
              <div class="request-description">${escapeHTML(req.description)}</div>
              <div class="request-details">
                <p><strong>Senior Assisted:</strong> ${req.senior ? req.senior.name : 'Senior Citizen'}</p>
                <p><strong>Completion Notes:</strong> ${escapeHTML(req.resolutionNotes)}</p>
                <p><strong>Completed On:</strong> ${new Date(req.completedAt).toLocaleDateString()}</p>
              </div>
            </div>`;
        }).join('');
      }
    }

  } else {
    alert("Error loading requests data");
  }
}

// Volunteer claims a request
async function acceptHelpRequest(id) {
  if (confirm("Would you like to accept this task and commit to helping this Senior Citizen?")) {
    const res = await apiCall(`/requests/${id}/accept`, 'PUT');
    if (res.ok && res.data.success) {
      loadVolunteerRequests();
    } else {
      alert(res.data.message || "Failed to accept request");
    }
  }
}

// Open Completion Modal
function openCompletionModal(id) {
  activeRequestIdForCompletion = id;
  const modal = document.getElementById('completionModal');
  if (modal) modal.style.display = 'flex';
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
