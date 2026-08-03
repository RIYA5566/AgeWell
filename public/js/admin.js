// AgeWell - Admin Panel Client Script

document.addEventListener('DOMContentLoaded', () => {
  // Validate authentication
  const auth = checkAuthAndRedirect('admin');
  if (!auth) return;

  // Personalize welcome bar
  const user = JSON.parse(localStorage.getItem('user'));
  const welcomeTitle = document.getElementById('welcomeTitle');
  if (welcomeTitle && user) {
    welcomeTitle.textContent = `Admin Panel — ${user.name}`;
  }

  // Load stats and tables
  loadAdminDashboard();
});

async function loadAdminDashboard() {
  await Promise.all([
    loadStats(),
    loadUsers(),
    loadAllRequests()
  ]);
}

// Fetch and Render System Stats
async function loadStats() {
  const res = await apiCall('/admin/stats', 'GET');
  if (res.ok && res.data.success) {
    const stats = res.data.stats;
    
    document.getElementById('statTotalUsers').textContent    = stats.users.total;
    document.getElementById('statSeniors').textContent       = stats.users.seniors;
    document.getElementById('statVolunteers').textContent    = stats.users.volunteers;
    const statFamily = document.getElementById('statFamily');
    if (statFamily) statFamily.textContent = stats.users.family || 0;
    
    document.getElementById('statTotalRequests').textContent    = stats.requests.total;
    document.getElementById('statPendingRequests').textContent  = stats.requests.pending;
    document.getElementById('statAcceptedRequests').textContent = stats.requests.accepted;
    document.getElementById('statCompletedRequests').textContent = stats.requests.completed;

    // Awaiting approval counter
    const statAwaiting = document.getElementById('statAwaitingApproval');
    if (statAwaiting) {
      statAwaiting.textContent = stats.requests.awaitingApproval || 0;
      if ((stats.requests.awaitingApproval || 0) > 0) {
        statAwaiting.parentElement.style.backgroundColor = '#fff3e0';
      }
    }

    // Handle SOS Indicator
    const sosContainer = document.getElementById('statSosAlerts');
    if (sosContainer) {
      sosContainer.textContent = stats.requests.emergency;
      if (stats.requests.emergency > 0) {
        sosContainer.parentElement.style.backgroundColor = '#ffebee';
        sosContainer.parentElement.style.borderColor = 'var(--color-emergency)';
        sosContainer.style.color = 'var(--color-emergency)';
      } else {
        sosContainer.parentElement.style.backgroundColor = 'var(--color-primary-light)';
        sosContainer.parentElement.style.borderColor = 'var(--color-primary)';
        sosContainer.style.color = 'var(--color-primary-dark)';
      }
    }
  }
}

// Fetch and Render Users Table
async function loadUsers() {
  const usersTableBody = document.getElementById('usersTableBody');
  if (!usersTableBody) return;

  usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Loading users list...</td></tr>`;

  const res = await apiCall('/admin/users', 'GET');
  if (res.ok && res.data.success) {
    const users = res.data.users;
    if (users.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No users registered yet.</td></tr>`;
      return;
    }

    const currentUserId = JSON.parse(localStorage.getItem('user')).id;

    usersTableBody.innerHTML = users.map(user => {
      let roleLabel = '';
      if (user.role === 'admin') {
        roleLabel = '<span class="badge" style="background-color: #e0f7fa; color: #006064;">Admin</span>';
      } else if (user.role === 'senior') {
        roleLabel = '<span class="badge" style="background-color: #f1f8e9; color: #33691e;">Senior</span>';
      } else if (user.role === 'volunteer') {
        roleLabel = '<span class="badge" style="background-color: #ede7f6; color: #4a148c;">Volunteer</span>';
      }

      let extraDetails = '';
      if (user.role === 'senior') {
        extraDetails = `<strong>Emergency:</strong> ${escapeHTML(user.emergencyContact || 'None')}`;
      } else if (user.role === 'volunteer') {
        extraDetails = `<strong>Skills:</strong> ${user.skills && user.skills.length > 0 ? escapeHTML(user.skills.join(', ')) : 'None'}`;
      }

      const isSelf = user._id === currentUserId;
      const actionButton = isSelf 
        ? '<span style="color: #888; font-style: italic;">Active Session</span>'
        : `<button class="btn btn-outline-danger" onclick="deleteUserAccount('${user._id}', '${escapeHTML(user.name)}')" style="padding: 6px 12px; font-size: 0.95rem; min-height: 40px; border-width: 2px;">🗑️ Delete User</button>`;

      return `
        <tr>
          <td><strong>${escapeHTML(user.name)}</strong></td>
          <td>${escapeHTML(user.email)}</td>
          <td><a href="tel:${user.phone}" style="color: var(--color-primary-dark); font-weight: 500;">${escapeHTML(user.phone)}</a></td>
          <td>${roleLabel}</td>
          <td>
            <div style="font-size: 0.95rem; max-width: 250px; white-space: normal;">
              <p>${escapeHTML(user.address)}</p>
              <p style="margin-top: 4px; font-size: 0.85rem; color: #555;">${extraDetails}</p>
            </div>
          </td>
          <td>${actionButton}</td>
        </tr>`;
    }).join('');
  } else {
    usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-emergency);">Error loading users list.</td></tr>`;
  }
}

// Fetch and Render Requests Table
async function loadAllRequests() {
  const requestsTableBody = document.getElementById('requestsTableBody');
  if (!requestsTableBody) return;

  requestsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Loading requests list...</td></tr>`;

  const res = await apiCall('/requests', 'GET');
  if (res.ok && res.data.success) {
    const requests = res.data.requests;
    if (requests.length === 0) {
      requestsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No help requests raised yet.</td></tr>`;
      return;
    }

    requestsTableBody.innerHTML = requests.map(req => {
      let statusBadge = '';
      if (req.status === 'pending') {
        statusBadge = `<span class="badge badge-pending">Pending</span>`;
      } else if (req.status === 'accepted') {
        statusBadge = `<span class="badge badge-accepted">Accepted</span>`;
      } else if (req.status === 'completed') {
        statusBadge = `<span class="badge badge-completed">Completed</span>`;
      }

      let urgencyLabel = req.urgency === 'emergency' ? '🚨 SOS' : req.urgency === 'high' ? 'High' : 'Normal';
      let urgencyBadge = `<span class="badge ${req.urgency === 'emergency' ? 'badge-urgency-emergency' : req.urgency === 'high' ? 'badge-urgency-high' : 'badge-urgency'}">${urgencyLabel}</span>`;

      const seniorName = req.senior ? req.senior.name : 'Unknown';
      const volunteerName = req.volunteer ? req.volunteer.name : '<span style="color:#888;">Unassigned</span>';

      const deleteBtn = `<button class="btn btn-outline-danger" onclick="deleteRequestByAdmin('${req._id}')" style="padding: 6px 12px; font-size: 0.95rem; min-height: 40px; border-width: 2px;">❌ Delete</button>`;

      return `
        <tr>
          <td><strong>${escapeHTML(req.title)}</strong></td>
          <td>${escapeHTML(req.category)}</td>
          <td>${urgencyBadge}</td>
          <td>${statusBadge}</td>
          <td>${escapeHTML(seniorName)}</td>
          <td>${volunteerName}</td>
          <td>${deleteBtn}</td>
        </tr>`;
    }).join('');
  } else {
    requestsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-emergency);">Error loading requests list.</td></tr>`;
  }
}

// Moderation Action: Delete User
async function deleteUserAccount(id, name) {
  if (confirm(`WARNING: Are you sure you want to permanently delete user "${name}"?\nThis will automatically cancel/cleanup all requests associated with this user.`)) {
    const res = await apiCall(`/admin/users/${id}`, 'DELETE');
    if (res.ok && res.data.success) {
      loadAdminDashboard();
    } else {
      alert(res.data.message || "Failed to delete user");
    }
  }
}

// Moderation Action: Delete Request
async function deleteRequestByAdmin(id) {
  if (confirm("Are you sure you want to delete/cancel this request from the platform?")) {
    const res = await apiCall(`/requests/${id}`, 'DELETE');
    if (res.ok) {
      loadAdminDashboard();
    } else {
      alert(res.data.message || "Failed to delete request");
    }
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
