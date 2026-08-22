let activeRejectVolunteerId = null;
let allUsersMap = {};
let allLoadedUsers = [];
let allLoadedRequests = [];
let currentUserFilter = 'all';
let currentRequestFilter = 'all';

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

  // Bind rejection modal
  const adminRejectModal = document.getElementById('adminRejectKycModal');
  const adminRejectClose = document.getElementById('adminRejectClose');
  const btnCancelAdminReject = document.getElementById('btnCancelAdminReject');
  const btnConfirmAdminReject = document.getElementById('btnConfirmAdminReject');

  const closeAdminRejectModal = () => {
    if (adminRejectModal) adminRejectModal.style.display = 'none';
    activeRejectVolunteerId = null;
    const input = document.getElementById('adminRejectReasonInput');
    if (input) input.value = '';
  };

  if (adminRejectClose) adminRejectClose.addEventListener('click', closeAdminRejectModal);
  if (btnCancelAdminReject) btnCancelAdminReject.addEventListener('click', closeAdminRejectModal);
  window.addEventListener('click', (e) => {
    if (e.target === adminRejectModal) closeAdminRejectModal();
  });

  if (btnConfirmAdminReject) {
    btnConfirmAdminReject.addEventListener('click', async () => {
      if (!activeRejectVolunteerId) return;
      const input = document.getElementById('adminRejectReasonInput');
      const reason = input ? input.value.trim() : '';

      if (!reason) {
        alert('Please type or select a reason for rejecting the volunteer verification.');
        if (input) input.focus();
        return;
      }

      btnConfirmAdminReject.disabled = true;
      btnConfirmAdminReject.classList.add('opacity-75', 'cursor-not-allowed');
      const originalText = btnConfirmAdminReject.innerHTML;
      btnConfirmAdminReject.innerHTML = `<span>Rejecting...</span>`;

      try {
        const res = await apiCall(`/admin/volunteers/${activeRejectVolunteerId}/verify`, 'PUT', {
          status: 'rejected',
          rejectionReason: reason
        });

        if (res.ok && res.data.success) {
          showToast('Volunteer verification rejected. Reason sent to volunteer.', 'info');
          closeAdminRejectModal();
          loadAdminDashboard();
        } else {
          alert(res.data?.message || 'Failed to reject verification');
        }
      } catch (err) {
        console.error(err);
        alert('Network error rejecting volunteer verification');
      } finally {
        btnConfirmAdminReject.disabled = false;
        btnConfirmAdminReject.classList.remove('opacity-75', 'cursor-not-allowed');
        btnConfirmAdminReject.innerHTML = originalText;
      }
    });
  }

  // Bind User Profile Modal
  const userProfileModal = document.getElementById('adminUserProfileModal');
  const adminProfileClose = document.getElementById('adminProfileClose');
  const btnCloseUserProfile = document.getElementById('btnCloseUserProfile');

  const closeUserProfileModal = () => {
    if (userProfileModal) userProfileModal.style.display = 'none';
  };

  if (adminProfileClose) adminProfileClose.addEventListener('click', closeUserProfileModal);
  if (btnCloseUserProfile) btnCloseUserProfile.addEventListener('click', closeUserProfileModal);
  window.addEventListener('click', (e) => {
    if (e.target === userProfileModal) closeUserProfileModal();
  });

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

// Expose filter functions globally
window.applyUserFilter = applyUserFilter;
window.applyRequestFilter = applyRequestFilter;
window.openUserProfileModal = openUserProfileModal;
window.approveVolunteerKyc = approveVolunteerKyc;
window.togglePoliceCheck = togglePoliceCheck;
window.openAdminRejectModal = openAdminRejectModal;
window.deleteUserAccount = deleteUserAccount;
window.deleteRequestByAdmin = deleteRequestByAdmin;

// Apply User Directory Filter
function applyUserFilter(filter) {
  currentUserFilter = filter;
  renderUsersTable();

  const chip = document.getElementById('usersFilterChip');
  const label = document.getElementById('usersFilterLabel');
  if (chip && label) {
    if (filter === 'all') {
      chip.classList.add('hidden');
    } else {
      chip.classList.remove('hidden');
      const filterNames = {
        senior: 'Senior Citizens',
        volunteer: 'Volunteers',
        family: 'Family Caregivers'
      };
      label.textContent = `Showing: ${filterNames[filter] || filter}`;
    }
  }

  const sec = document.getElementById('secUsers');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
}

// Apply Request Pipeline Filter
function applyRequestFilter(filter) {
  currentRequestFilter = filter;
  renderRequestsTable();

  const chip = document.getElementById('requestsFilterChip');
  const label = document.getElementById('requestsFilterLabel');
  if (chip && label) {
    if (filter === 'all') {
      chip.classList.add('hidden');
    } else {
      chip.classList.remove('hidden');
      const filterNames = {
        emergency: 'Active SOS Alerts',
        approval: 'Family Approvals',
        pending: 'Pending Requests',
        accepted: 'In-Progress / Accepted',
        completed: 'Completed Requests'
      };
      label.textContent = `Showing: ${filterNames[filter] || filter}`;
    }
  }

  const sec = document.getElementById('secRequests');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
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
    }

    // Handle SOS Indicator
    const sosContainer = document.getElementById('statSosAlerts');
    if (sosContainer) {
      sosContainer.textContent = stats.requests.emergency || 0;
    }
  }
}

// Fetch and Render Users & Volunteer KYC Tables
async function loadUsers() {
  const usersTableBody = document.getElementById('usersTableBody');
  const volunteerKycTableBody = document.getElementById('volunteerKycTableBody');

  if (usersTableBody) {
    usersTableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 font-semibold">Loading users list...</td></tr>`;
  }
  if (volunteerKycTableBody) {
    volunteerKycTableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-semibold">Loading volunteer KYC records...</td></tr>`;
  }

  const res = await apiCall('/admin/users', 'GET');
  if (res.ok && res.data.success) {
    const users = res.data.users;
    allLoadedUsers = users;

    // Cache users in lookup map for instant profile inspection
    allUsersMap = {};
    users.forEach(u => { allUsersMap[u._id] = u; });

    // --- Render Volunteer KYC & Police Verification Center ---
    if (volunteerKycTableBody) {
      const pendingVolunteers = users.filter(u => u.role === 'volunteer' && u.verificationStatus !== 'verified');
      if (pendingVolunteers.length === 0) {
        volunteerKycTableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-semibold">No pending volunteer KYC applications. All registered volunteers are verified.</td></tr>`;
      } else {
        volunteerKycTableBody.innerHTML = pendingVolunteers.map(vol => {
          const govtIdBtn = vol.govtIdCard
            ? `<a href="${escapeHTML(vol.govtIdCard)}" target="_blank" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-lg border border-brand-200 text-xs transition-colors shadow-2xs">
                <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                View ID
               </a>`
            : `<span class="inline-flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                <svg class="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Missing ID
               </span>`;

          const selfieBtn = vol.selfiePhoto
            ? `<a href="${escapeHTML(vol.selfiePhoto)}" target="_blank" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-lg border border-brand-200 text-xs transition-colors shadow-2xs">
                <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                View Photo
               </a>`
            : `<span class="inline-flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                <svg class="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Missing Photo
               </span>`;

          const phoneStatus = vol.isPhoneVerified 
            ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 font-bold text-[11px] border border-brand-200">
                <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                Phone Verified
               </span>` 
            : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                <svg class="w-3 h-3 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Phone Pending
               </span>`;
          
          const emailStatus = vol.isEmailVerified 
            ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 font-bold text-[11px] border border-brand-200">
                <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                Email Verified
               </span>` 
            : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                <svg class="w-3 h-3 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Email Pending
               </span>`;

          const policeCheckBtn = vol.isPoliceVerified
            ? `<button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 text-xs font-bold transition-all shadow-2xs" onclick="togglePoliceCheck('${vol._id}', false)">
                <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
                Verified (Revoke)
               </button>`
            : `<button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-bold transition-all shadow-2xs" onclick="togglePoliceCheck('${vol._id}', true)">
                <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
                Pending Clearance
               </button>`;

          let statusBadge = '';
          const st = vol.verificationStatus || 'unverified';
          if (st === 'verified') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-50 text-brand-700 border border-brand-200 font-extrabold text-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-600"></span>
              VERIFIED
            </span>`;
          } else if (st === 'pending') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 font-extrabold text-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              UNDER REVIEW
            </span>`;
          } else if (st === 'rejected') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
              REJECTED
            </span>`;
          } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 font-extrabold text-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              UNVERIFIED
            </span>`;
          }

          const approveBtn = `<button class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5" onclick="approveVolunteerKyc('${vol._id}')">
            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            Approve
          </button>`;
          const rejectBtn = `<button class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border-none" onclick="openAdminRejectModal('${vol._id}', '${escapeHTML(vol.name).replace(/'/g, "\\'")}', '${escapeHTML(vol.email || '').replace(/'/g, "\\'")}')">
            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            Reject
          </button>`;

          return `
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-3.5 px-4">
                <button onclick="openUserProfileModal('${vol._id}')" class="font-extrabold text-brand-700 hover:text-brand-900 hover:underline text-left cursor-pointer flex items-center gap-1">
                  ${escapeHTML(vol.name)}
                </button>
                <div class="text-xs text-slate-500 mt-0.5">${escapeHTML(vol.email)}</div>
                <div class="text-xs text-brand-600 font-semibold mt-0.5 flex items-center gap-1">
                  <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                  ${escapeHTML(vol.phone)}
                </div>
              </td>
              <td class="py-3.5 px-4 font-mono font-bold text-slate-800">${escapeHTML(vol.aadhaarNumber || 'Not Provided')}</td>
              <td class="py-3.5 px-4">
                <div class="flex flex-col gap-1.5">
                  ${govtIdBtn}
                  ${selfieBtn}
                </div>
              </td>
              <td class="py-3.5 px-4">
                <div class="flex flex-col gap-1">
                  ${phoneStatus}
                  ${emailStatus}
                </div>
              </td>
              <td class="py-3.5 px-4">${policeCheckBtn}</td>
              <td class="py-3.5 px-4">${statusBadge}</td>
              <td class="py-3.5 px-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  ${approveBtn}
                  ${rejectBtn}
                </div>
              </td>
            </tr>`;
        }).join('');
      }
    }

    // Render User Directory table with current filter
    renderUsersTable();
  } else {
    if (usersTableBody) usersTableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-600 font-bold">Error loading users list.</td></tr>`;
  }
}

// Render User Directory Table using allLoadedUsers & currentUserFilter
function renderUsersTable() {
  const usersTableBody = document.getElementById('usersTableBody');
  if (!usersTableBody) return;

  if (allLoadedUsers.length === 0) {
    usersTableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 font-semibold">No users registered yet.</td></tr>`;
    return;
  }

  let filteredUsers = allLoadedUsers;

  if (currentUserFilter === 'senior') {
    filteredUsers = allLoadedUsers.filter(u => u.role === 'senior');
  } else if (currentUserFilter === 'volunteer') {
    filteredUsers = allLoadedUsers.filter(u => u.role === 'volunteer');
  } else if (currentUserFilter === 'family') {
    filteredUsers = allLoadedUsers.filter(u => u.role === 'family');
  } else {
    // 'all' -> show active seniors, caregivers, admins, and verified volunteers
    filteredUsers = allLoadedUsers.filter(u => u.role !== 'volunteer' || u.verificationStatus === 'verified');
  }

  if (filteredUsers.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400 font-semibold">
          No users match the selected filter. 
          <button onclick="applyUserFilter('all')" class="text-brand-600 font-bold underline hover:text-brand-800 ml-1">Reset filter</button>
        </td>
      </tr>`;
    return;
  }

  const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;

  usersTableBody.innerHTML = filteredUsers.map(user => {
    let roleLabel = '';
    if (user.role === 'admin') {
      roleLabel = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs">
        <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
        Admin
      </span>`;
    } else if (user.role === 'senior') {
      roleLabel = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold text-xs">
        <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
        Senior${user.age ? ` (${user.age}y)` : ''}
      </span>`;
    } else if (user.role === 'volunteer') {
      const isV = user.verificationStatus === 'verified';
      roleLabel = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold text-xs">
        <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
        Volunteer (${isV ? 'Verified' : 'Pending'})
      </span>`;
    } else if (user.role === 'family') {
      roleLabel = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs">
        <svg class="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
        Caregiver
      </span>`;
    }

    let extraDetails = '';
    if (user.role === 'senior') {
      extraDetails = `<span class="text-slate-500 font-medium">Emergency: <strong class="text-slate-700">${escapeHTML(user.emergencyContact || 'None')}</strong></span>`;
    } else if (user.role === 'volunteer') {
      extraDetails = `<span class="text-slate-500 font-medium">Skills: <strong class="text-slate-700">${user.skills && user.skills.length > 0 ? escapeHTML(user.skills.join(', ')) : 'General'}</strong></span>`;
    } else if (user.role === 'family') {
      const sObj = (user.linkedSenior && typeof user.linkedSenior === 'object' && user.linkedSenior.name)
        ? user.linkedSenior
        : allUsersMap[user.linkedSenior];
      extraDetails = `<span class="text-slate-500 font-medium">Caring for: <strong class="text-purple-700">${sObj ? escapeHTML(sObj.name) : (user.relationship || 'Senior')}</strong></span>`;
    }

    const isSelf = user._id === currentUserId;
    const actionButton = isSelf 
      ? '<span class="text-xs font-semibold text-slate-400 italic">Current Admin Session</span>'
      : `<button class="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5" onclick="deleteUserAccount('${user._id}', '${escapeHTML(user.name)}')">
          <svg class="w-3.5 h-3.5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
          Delete
         </button>`;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3.5 px-4 font-bold text-slate-900">
          <button onclick="openUserProfileModal('${user._id}')" class="font-extrabold text-brand-700 hover:text-brand-900 hover:underline text-left cursor-pointer flex items-center gap-1.5">
            <span>${escapeHTML(user.name)}</span>
          </button>
        </td>
        <td class="py-3.5 px-4 text-slate-600 text-xs font-medium">${escapeHTML(user.email)}</td>
        <td class="py-3.5 px-4">
          <a href="tel:${user.phone}" class="text-brand-600 font-bold hover:underline text-xs inline-flex items-center gap-1">
            <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
            ${escapeHTML(user.phone)}
          </a>
        </td>
        <td class="py-3.5 px-4">${roleLabel}</td>
        <td class="py-3.5 px-4">
          <div class="max-w-xs text-xs">
            <p class="text-slate-700 truncate">${escapeHTML(user.address)}</p>
            <div class="mt-0.5">${extraDetails}</div>
          </div>
        </td>
        <td class="py-3.5 px-4 text-right">${actionButton}</td>
      </tr>`;
  }).join('');
}

// Open User Profile Modal Dialog
function openUserProfileModal(userId) {
  const user = allUsersMap[userId];
  if (!user) {
    alert("User details not found in session cache.");
    return;
  }

  const modal = document.getElementById('adminUserProfileModal');
  const title = document.getElementById('userProfileModalTitle');
  const roleBadge = document.getElementById('userProfileRoleBadge');
  const avatar = document.getElementById('userProfileAvatar');
  const joinedText = document.getElementById('userProfileJoinedText');
  const body = document.getElementById('userProfileModalBody');
  const footerActions = document.getElementById('userProfileFooterActions');

  if (!modal || !body) return;

  // Set avatar initials
  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  if (avatar) avatar.textContent = initials;

  // Title and Subtitle
  if (title) title.textContent = user.name;
  if (joinedText) {
    const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Registered Member';
    joinedText.textContent = `Member since ${dateStr}`;
  }

  // Role Badge
  let roleBadgeHtml = '';
  if (user.role === 'admin') {
    roleBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs">Admin</span>';
  } else if (user.role === 'senior') {
    roleBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold text-xs">Senior Citizen ${user.age ? `(${user.age}y)` : ''}</span>`;
  } else if (user.role === 'volunteer') {
    const isV = user.verificationStatus === 'verified';
    roleBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold text-xs">Volunteer (${isV ? 'Verified' : 'Pending'})</span>`;
  } else if (user.role === 'family') {
    roleBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs">Caregiver</span>';
  }
  if (roleBadge) roleBadge.innerHTML = roleBadgeHtml;

  // Build Profile Details Sections
  let roleSpecificHtml = '';

  if (user.role === 'senior') {
    const dobFormatted = user.dob ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not Provided';
    const idDocLink = user.seniorIdCard 
      ? `<a href="${escapeHTML(user.seniorIdCard)}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-lg border border-brand-200 text-xs transition-colors shadow-2xs">
          <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
          View ${escapeHTML(user.idDocType || 'Government ID')}
         </a>`
      : `<span class="text-slate-400 italic text-xs">No document uploaded</span>`;

    roleSpecificHtml = `
      <div class="bg-brand-50/40 border border-brand-100 rounded-2xl p-4 space-y-3">
        <h4 class="font-extrabold text-brand-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span>Senior Citizen Verification &amp; Profile</span>
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Date of Birth</span>
            <span class="font-bold text-slate-800 text-xs">${escapeHTML(dobFormatted)}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Verified Age</span>
            <span class="font-bold text-brand-700 text-xs">${user.age ? `${user.age} Years Old (60+ Validated)` : 'Not Recorded'}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Gender</span>
            <span class="font-bold text-slate-800 text-xs capitalize">${escapeHTML(user.gender || 'Not Specified')}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Emergency Contact</span>
            <span class="font-bold text-rose-600 text-xs">${escapeHTML(user.emergencyContact || 'None on file')}</span>
          </div>
        </div>
        <div class="pt-2 border-t border-brand-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-600">ID Proof: <strong>${escapeHTML(user.idDocType || 'Government ID')}</strong></span>
          ${idDocLink}
        </div>
      </div>`;
  } else if (user.role === 'volunteer') {
    const govtIdBtn = user.govtIdCard
      ? `<a href="${escapeHTML(user.govtIdCard)}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-lg border border-brand-200 text-xs transition-colors shadow-2xs">
          <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
          Govt ID
         </a>`
      : `<span class="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Missing ID</span>`;

    const selfieBtn = user.selfiePhoto
      ? `<a href="${escapeHTML(user.selfiePhoto)}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-lg border border-brand-200 text-xs transition-colors shadow-2xs">
          <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
          Live Photo
         </a>`
      : `<span class="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Missing Photo</span>`;

    const skillsBadges = user.skills && user.skills.length > 0
      ? user.skills.map(s => `<span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold">${escapeHTML(s)}</span>`).join(' ')
      : '<span class="text-slate-400 text-xs italic">General Assistant</span>';

    roleSpecificHtml = `
      <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
        <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Volunteer KYC &amp; Verification Details</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Aadhaar / ID Number</span>
            <span class="font-mono font-bold text-slate-800 text-xs">${escapeHTML(user.aadhaarNumber || 'Not Provided')}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Police Clearance</span>
            <span class="font-bold text-xs ${user.isPoliceVerified ? 'text-brand-700' : 'text-amber-700'}">${user.isPoliceVerified ? 'Clearance Approved' : 'Pending Verification'}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Phone Verification</span>
            <span class="font-bold text-xs ${user.isPhoneVerified ? 'text-brand-700' : 'text-rose-600'}">${user.isPhoneVerified ? 'Verified OTP' : 'Unverified'}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Email Verification</span>
            <span class="font-bold text-xs ${user.isEmailVerified ? 'text-brand-700' : 'text-rose-600'}">${user.isEmailVerified ? 'Verified OTP' : 'Unverified'}</span>
          </div>
        </div>
        <div>
          <span class="text-[11px] font-bold text-slate-400 block uppercase mb-1">Registered Skills</span>
          <div class="flex flex-wrap gap-1.5">${skillsBadges}</div>
        </div>
        <div class="pt-2 border-t border-slate-200 flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-600">Uploaded Documents:</span>
          <div class="flex items-center gap-2">${govtIdBtn} ${selfieBtn}</div>
        </div>
      </div>`;
  } else if (user.role === 'family') {
    let linkedSeniorDisplay = '<span class="text-slate-400 italic">No senior linked</span>';
    
    // Resolve senior object (either from populated field or from client cache allUsersMap)
    let seniorObj = null;
    if (user.linkedSenior) {
      if (typeof user.linkedSenior === 'object' && user.linkedSenior.name) {
        seniorObj = user.linkedSenior;
      } else {
        const seniorId = typeof user.linkedSenior === 'object' ? (user.linkedSenior._id || user.linkedSenior.id) : user.linkedSenior;
        seniorObj = allUsersMap[seniorId];
      }
    }

    if (seniorObj) {
      linkedSeniorDisplay = `
        <button onclick="openUserProfileModal('${seniorObj._id || seniorObj.id}')" class="font-extrabold text-brand-700 hover:text-brand-900 hover:underline text-left cursor-pointer inline-flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg border border-brand-200 transition-colors">
          <svg class="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
          <span>${escapeHTML(seniorObj.name)} (${escapeHTML(seniorObj.email)})</span>
        </button>
      `;
    } else if (user.familyMemberEmail) {
      linkedSeniorDisplay = `<span class="font-bold text-purple-800 text-xs">${escapeHTML(user.familyMemberEmail)}</span>`;
    }

    roleSpecificHtml = `
      <div class="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 space-y-3">
        <h4 class="font-extrabold text-purple-900 text-xs uppercase tracking-wider">Family Caregiver Linkage</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Linked Senior Citizen</span>
            <div class="mt-0.5 text-xs">${linkedSeniorDisplay}</div>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-400 block uppercase">Relationship</span>
            <span class="font-bold text-slate-800 text-xs capitalize">${escapeHTML(user.relationship || 'Caregiver')}</span>
          </div>
        </div>
      </div>`;
  }

  body.innerHTML = `
    <!-- Contact Information Box -->
    <div class="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
      <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Contact &amp; Account Details</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <span class="text-[11px] font-bold text-slate-400 block uppercase">Email Address</span>
          <a href="mailto:${escapeHTML(user.email)}" class="font-bold text-brand-600 hover:underline inline-flex items-center gap-1">
            <svg class="w-3 h-3 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
            ${escapeHTML(user.email)}
          </a>
        </div>
        <div>
          <span class="text-[11px] font-bold text-slate-400 block uppercase">Phone Number</span>
          <a href="tel:${escapeHTML(user.phone)}" class="font-bold text-brand-600 hover:underline inline-flex items-center gap-1">
            <svg class="w-3 h-3 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
            ${escapeHTML(user.phone)}
          </a>
        </div>
        <div class="sm:col-span-2">
          <span class="text-[11px] font-bold text-slate-400 block uppercase">Residential Address</span>
          <span class="font-medium text-slate-700">${escapeHTML(user.address || 'No address registered')}</span>
        </div>
      </div>
    </div>

    ${roleSpecificHtml}
  `;

  const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;
  const isSelf = user._id === currentUserId;

  if (footerActions) {
    footerActions.innerHTML = isSelf
      ? '<span class="text-xs text-slate-400 italic">Active Administrator Session</span>'
      : `<button onclick="deleteUserAccount('${user._id}', '${escapeHTML(user.name)}')" class="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
          Delete User Account
         </button>`;
  }

  modal.style.display = 'flex';
}

// Admin approves volunteer KYC & Police Verification
async function approveVolunteerKyc(id) {
  const res = await apiCall(`/admin/volunteers/${id}/verify`, 'PUT', {
    status: 'verified',
    isIdVerified: true,
    isPoliceVerified: true
  });

  if (res.ok && res.data.success) {
    showToast('Volunteer verified & police clearance approved.', 'success');
    loadAdminDashboard();
  } else {
    alert(res.data?.message || 'Failed to verify volunteer');
  }
}

// Admin toggles Police Check
async function togglePoliceCheck(id, value) {
  const res = await apiCall(`/admin/volunteers/${id}/verify`, 'PUT', {
    isPoliceVerified: value
  });

  if (res.ok && res.data.success) {
    showToast(`Police clearance ${value ? 'verified' : 'set to pending'}.`, 'info');
    loadAdminDashboard();
  } else {
    alert(res.data?.message || 'Failed to update police check');
  }
}

// Admin opens reject modal with volunteer info
function openAdminRejectModal(id, name = '', email = '') {
  activeRejectVolunteerId = id;
  const modal = document.getElementById('adminRejectKycModal');
  const nameEl = document.getElementById('adminRejectVolunteerName');
  const emailEl = document.getElementById('adminRejectVolunteerEmail');
  const input = document.getElementById('adminRejectReasonInput');

  if (nameEl) nameEl.textContent = name || 'Volunteer';
  if (emailEl) emailEl.textContent = email ? `(${email})` : '';
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 80);
  }

  if (modal) modal.style.display = 'flex';
}
window.openAdminRejectModal = openAdminRejectModal;

// Quick preset reason helper for Admin Rejection modal
window.applyRejectPreset = function(presetText) {
  const input = document.getElementById('adminRejectReasonInput');
  if (input) {
    input.value = presetText;
    input.focus();
  }
};

// Fetch and Render Requests Table
async function loadAllRequests() {
  const requestsTableBody = document.getElementById('requestsTableBody');
  if (!requestsTableBody) return;

  requestsTableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-semibold">Loading requests list...</td></tr>`;

  const res = await apiCall('/requests', 'GET');
  if (res.ok && res.data.success) {
    const requests = res.data.requests;
    allLoadedRequests = requests;
    renderRequestsTable();
  } else {
    requestsTableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-600 font-bold">Error loading requests list.</td></tr>`;
  }
}

// Render Requests Table using allLoadedRequests & currentRequestFilter
function renderRequestsTable() {
  const requestsTableBody = document.getElementById('requestsTableBody');
  if (!requestsTableBody) return;

  if (allLoadedRequests.length === 0) {
    requestsTableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-semibold">No help requests raised yet.</td></tr>`;
    return;
  }

  let filteredRequests = allLoadedRequests;

  if (currentRequestFilter === 'emergency') {
    filteredRequests = allLoadedRequests.filter(r => r.urgency === 'emergency' || r.urgency === 'high');
  } else if (currentRequestFilter === 'approval') {
    filteredRequests = allLoadedRequests.filter(r => r.status === 'awaiting_approval' || (r.status === 'pending' && r.urgency !== 'emergency'));
  } else if (currentRequestFilter === 'pending') {
    filteredRequests = allLoadedRequests.filter(r => r.status === 'pending');
  } else if (currentRequestFilter === 'accepted') {
    filteredRequests = allLoadedRequests.filter(r => r.status === 'accepted');
  } else if (currentRequestFilter === 'completed') {
    filteredRequests = allLoadedRequests.filter(r => r.status === 'completed');
  }

  if (filteredRequests.length === 0) {
    requestsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400 font-semibold">
          No requests match the selected filter. 
          <button onclick="applyRequestFilter('all')" class="text-brand-600 font-bold underline hover:text-brand-800 ml-1">Reset filter</button>
        </td>
      </tr>`;
    return;
  }

  requestsTableBody.innerHTML = filteredRequests.map(req => {
    let statusBadge = '';
    if (req.status === 'pending') {
      statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
        <svg class="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Pending
      </span>`;
    } else if (req.status === 'accepted') {
      statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold text-xs">
        <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Accepted
      </span>`;
    } else if (req.status === 'completed') {
      statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold text-xs">
        <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        Completed
      </span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs">${escapeHTML(req.status)}</span>`;
    }

    let urgencyBadge = '';
    if (req.urgency === 'emergency') {
      urgencyBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-xs animate-pulse">
        <svg class="w-3 h-3 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        Emergency SOS
      </span>`;
    } else if (req.urgency === 'high') {
      urgencyBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
        <svg class="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
        High
      </span>`;
    } else {
      urgencyBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs">Normal</span>`;
    }

    const seniorBtn = req.senior
      ? `<button onclick="openUserProfileModal('${req.senior._id || req.senior}')" class="font-semibold text-brand-700 hover:text-brand-900 hover:underline text-xs cursor-pointer">${escapeHTML(req.senior.name || 'Senior')}</button>`
      : '<span class="text-slate-400 italic text-xs">Unknown</span>';

    const volunteerBtn = req.volunteer
      ? `<button onclick="openUserProfileModal('${req.volunteer._id || req.volunteer}')" class="font-semibold text-brand-700 hover:text-brand-900 hover:underline text-xs cursor-pointer">${escapeHTML(req.volunteer.name || 'Volunteer')}</button>`
      : '<span class="text-slate-400 italic text-xs">Unassigned</span>';

    const deleteBtn = `<button class="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5" onclick="deleteRequestByAdmin('${req._id}')">
      <svg class="w-3.5 h-3.5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
      Delete
    </button>`;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3.5 px-4 font-bold text-slate-900">${escapeHTML(req.title)}</td>
        <td class="py-3.5 px-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs">${escapeHTML(req.category)}</span>
        </td>
        <td class="py-3.5 px-4">${urgencyBadge}</td>
        <td class="py-3.5 px-4">${statusBadge}</td>
        <td class="py-3.5 px-4">${seniorBtn}</td>
        <td class="py-3.5 px-4">${volunteerBtn}</td>
        <td class="py-3.5 px-4 text-right">${deleteBtn}</td>
      </tr>`;
  }).join('');
}

// Moderation Action: Delete User
async function deleteUserAccount(id, name) {
  const ok = await awConfirm({
    title: 'Delete User Account',
    message: `This will permanently remove <strong>${name}</strong> and automatically cancel all requests associated with this account. This action cannot be undone.`,
    confirmText: 'Yes, Delete',
    cancelText: 'Keep Account',
    danger: true
  });
  if (ok) {
    const res = await apiCall(`/admin/users/${id}`, 'DELETE');
    if (res.ok && res.data.success) {
      const modal = document.getElementById('adminUserProfileModal');
      if (modal) modal.style.display = 'none';
      loadAdminDashboard();
    } else {
      alert(res.data.message || "Failed to delete user");
    }
  }
}

// Moderation Action: Delete Request
async function deleteRequestByAdmin(id) {
  const ok = await awConfirm({
    title: 'Remove Request',
    message: 'This will permanently delete and cancel this request from the platform. The senior and volunteer will be notified.',
    confirmText: 'Remove Request',
    cancelText: 'Cancel',
    danger: true
  });
  if (ok) {
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
