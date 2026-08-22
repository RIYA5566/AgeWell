/**
 * AgeWell — Caregiver Wallet & Task Funding System
 * Handles Available, Reserved, and Total Balance, Mock Top-ups,
 * Active Task Reserved Budgets, and Filterable Transaction Ledgers.
 */

let currentTransactions = [];
let activeFilter = 'ALL';
let reservedTasksMap = {};

document.addEventListener('DOMContentLoaded', () => {
  // Validate auth — must be family role
  const auth = checkAuthAndRedirect('family');
  if (!auth) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navUserName = document.getElementById('navUserName');
  if (navUserName && user.name) {
    navUserName.textContent = `Hello, ${user.name} (${user.relationship || 'Caregiver'})`;
  }

  loadWalletData();
  loadReservedTasks();
  loadTransactions('ALL');
});

// Helper for escaping HTML
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeDocUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return url.startsWith('/') ? url : '/' + url;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOAD WALLET BALANCES
// ─────────────────────────────────────────────────────────────────────────────
async function loadWalletData() {
  try {
    const res = await apiCall('/wallet/caregiver', 'GET');
    if (!res.ok || !res.data || !res.data.success) {
      throw new Error(res.data?.message || 'Failed to load wallet');
    }

    const w = res.data.wallet;
    const avail = Number(w.availableBalance || 0);
    const resvd = Number(w.reservedBalance || 0);
    const total = Number(w.totalBalance || (avail + resvd));

    document.getElementById('cardAvailableBalance').textContent = `₹${avail.toLocaleString('en-IN')}`;
    document.getElementById('cardReservedBalance').textContent = `₹${resvd.toLocaleString('en-IN')}`;
    document.getElementById('cardTotalBalance').textContent = `₹${total.toLocaleString('en-IN')}`;

    // Check if recent refund exists in recent transactions to show notification banner
    if (res.data.recentTransactions && res.data.recentTransactions.length > 0) {
      const recentRefund = res.data.recentTransactions.find(t => t.type === 'REFUND');
      if (recentRefund) {
        const diffHours = (Date.now() - new Date(recentRefund.createdAt).getTime()) / (1000 * 60 * 60);
        if (diffHours < 48) {
          showNotificationBanner(
            `💰 Unused Task Funds Returned: ₹${Number(recentRefund.amount).toLocaleString('en-IN')}`,
            recentRefund.description || `Unused task budget has been safely returned to your Available Balance.`
          );
        }
      }
    }
  } catch (err) {
    console.error('loadWalletData error:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOAD ACTIVE RESERVED TASKS
// ─────────────────────────────────────────────────────────────────────────────
let activeTaskFilter = 'ALL';

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOAD ACTIVE & HISTORICAL TASKS
// ─────────────────────────────────────────────────────────────────────────────
async function loadReservedTasks(filterType = 'ALL') {
  activeTaskFilter = filterType;
  const container = document.getElementById('reservedTasksContainer');
  const countBadge = document.getElementById('activeTasksCountBadge');

  try {
    const url = `/wallet/caregiver/reserved-tasks?statusFilter=${encodeURIComponent(filterType)}`;
    const res = await apiCall(url, 'GET');
    if (!res.ok || !res.data || !res.data.success) {
      throw new Error(res.data?.message || 'Failed to load tasks');
    }

    const tasks = res.data.tasks || [];
    if (countBadge) countBadge.textContent = `${tasks.length} Task${tasks.length === 1 ? '' : 's'}`;

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
          </div>
          <p class="text-sm font-black text-slate-900">No Tasks Found for this Filter</p>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Tasks funded through your AgeWell wallet will display their budgets, purchases, and refund ledgers here.</p>
        </div>`;
      return;
    }

    reservedTasksMap = {};
    tasks.forEach(t => { reservedTasksMap[t._id] = t; });

    container.innerHTML = tasks.map(t => {
      const vol = t.volunteer ? (typeof t.volunteer === 'object' ? t.volunteer.name : 'Assigned Volunteer') : 'Unassigned';
      const allocated = Number(t.authorizedAmount || 0);
      const spent = Number(t.spentAmount || 0);
      const isCompleted = t.status === 'completed';
      const remaining = isCompleted ? 0 : Number(t.remainingAmount || Math.max(0, allocated - spent));
      const unspentRefunded = Number(t.unspentRefundedAmount || Math.max(0, allocated - spent));
      const purchasesCount = (t.merchantPurchases || []).length;

      let statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">Active Task</span>`;
      let borderAccent = 'border-slate-200/90';
      if (isCompleted) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Completed &amp; Settled</span>`;
        borderAccent = 'border-emerald-200/80';
      } else if (t.status === 'awaiting_verification') {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">Awaiting Verification</span>`;
      } else if (t.status === 'purchase_funded') {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">Pre-Funded</span>`;
      }

      return `
        <div class="bg-white rounded-3xl p-5 sm:p-6 border ${borderAccent} shadow-premium hover:shadow-cardHover transition-all flex flex-col justify-between space-y-4 group">
          
          <div>
            <!-- Header: Title & Status -->
            <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Task #${t._id.slice(-6).toUpperCase()}</span>
                <h3 class="text-base font-black text-slate-900 group-hover:text-brand-700 transition-colors leading-tight">${escapeHTML(t.title)}</h3>
                <span class="text-xs text-slate-500 font-medium">Volunteer: <strong>${escapeHTML(vol)}</strong></span>
              </div>
              <div class="flex-shrink-0">
                ${statusBadge}
              </div>
            </div>

            <!-- Financial Ledger Strip -->
            <div class="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-center my-3.5">
              <div class="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Allocated</span>
                <span class="text-sm font-black text-slate-900 block mt-0.5">₹${allocated.toLocaleString('en-IN')}</span>
              </div>
              <div class="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Spent</span>
                <span class="text-sm font-black text-amber-700 block mt-0.5">₹${spent.toLocaleString('en-IN')}</span>
              </div>
              <div class="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">${isCompleted ? 'Refunded' : 'Remaining'}</span>
                <span class="text-sm font-black text-emerald-700 block mt-0.5">₹${(isCompleted ? unspentRefunded : remaining).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <!-- Summary Text -->
            <div class="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>${purchasesCount} merchant purchase${purchasesCount === 1 ? '' : 's'}</span>
              <span class="${isCompleted ? 'text-emerald-800' : 'text-emerald-700'} font-bold">
                ${isCompleted ? `✓ ₹${unspentRefunded.toLocaleString('en-IN')} returned to wallet` : `₹${remaining.toLocaleString('en-IN')} unspent refund pending`}
              </span>
            </div>
          </div>

          <!-- Action Button -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-end">
            <button type="button" onclick="openTaskFinanceModal('${t._id}')" class="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5 active:scale-95">
              <svg class="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>View Financial Details</span>
            </button>
          </div>

        </div>`;
    }).join('');
  } catch (err) {
    console.error('loadReservedTasks error:', err);
    container.innerHTML = `<div class="col-span-full p-6 text-center text-rose-600 text-xs font-bold">Failed to load tasks.</div>`;
  }
}

function filterTaskCards(type) {
  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-task-filter') === type) {
      btn.className = 'task-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-brand-500 bg-brand-50 text-brand-700 cursor-pointer shadow-2xs';
    } else {
      btn.className = 'task-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer';
    }
  });
  loadReservedTasks(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LOAD & FILTER TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────
async function loadTransactions(filterType = 'ALL') {
  activeFilter = filterType;
  const container = document.getElementById('transactionsContainer');

  try {
    const url = filterType === 'ALL'
      ? '/wallet/caregiver/transactions'
      : `/wallet/caregiver/transactions?type=${encodeURIComponent(filterType)}`;

    const res = await apiCall(url, 'GET');
    if (!res.ok || !res.data || !res.data.success) {
      throw new Error(res.data?.message || 'Failed to load transactions');
    }

    currentTransactions = res.data.transactions || [];

    if (currentTransactions.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-200/60 space-y-1">
          <p class="text-xs font-bold text-slate-600">No transactions found</p>
          <p class="text-[11px] text-slate-400">Transactions for top-ups, task funds, and merchant purchases will appear here.</p>
        </div>`;
      return;
    }

    container.innerHTML = currentTransactions.map(txn => {
      const isCredit = txn.direction === 'CREDIT';
      const amountPrefix = isCredit ? '+ ' : '- ';
      const amountColor = isCredit ? 'text-emerald-700' : 'text-slate-900';
      const badgeClass = isCredit ? 'badge-credit' : 'badge-debit';
      
      const dateStr = new Date(txn.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const reqTitle = txn.request ? (typeof txn.request === 'object' ? txn.request.title : 'Task') : null;
      const receiptDoc = txn.metadata?.receiptDoc;

      return `
        <div class="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-premium transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <!-- Left: Icon, Description & Details -->
          <div class="flex items-start gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl ${isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'} flex items-center justify-center flex-shrink-0 font-extrabold text-sm shadow-2xs">
              ${isCredit ? '↓' : '↑'}
            </div>
            <div class="min-w-0 space-y-0.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-black text-slate-900 block truncate">${escapeHTML(txn.description)}</span>
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${badgeClass}">${txn.type.replace('_', ' ')}</span>
              </div>
              <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                <span>${dateStr}</span>
                <span>&bull;</span>
                <span class="font-mono text-[10px] text-slate-400">ID: ${escapeHTML(txn.transactionId)}</span>
                ${reqTitle ? `<span>&bull;</span><span class="text-brand-700 font-bold truncate">Task: ${escapeHTML(reqTitle)}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Right: Amount & Receipt Button -->
          <div class="flex items-center sm:items-end justify-between sm:justify-end gap-3 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <div class="text-left sm:text-right">
              <span class="text-base sm:text-lg font-black ${amountColor} block leading-tight">
                ${amountPrefix}₹${Number(txn.amount).toLocaleString('en-IN')}
              </span>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status: SUCCESS</span>
            </div>

            ${receiptDoc ? `
              <button type="button" onclick="openImageLightbox('${normalizeDocUrl(receiptDoc)}')" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>Bill</span>
              </button>
            ` : ''}
          </div>

        </div>`;
    }).join('');
  } catch (err) {
    console.error('loadTransactions error:', err);
    container.innerHTML = `<div class="p-6 text-center text-rose-600 text-xs font-bold">Failed to load transaction history.</div>`;
  }
}

function filterTransactions(type) {
  document.querySelectorAll('.txn-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === type) {
      btn.className = 'txn-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-brand-500 bg-brand-50 text-brand-700 cursor-pointer shadow-2xs';
    } else {
      btn.className = 'txn-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer';
    }
  });
  loadTransactions(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TOP-UP MODAL (Simulated Mock Gateway)
// ─────────────────────────────────────────────────────────────────────────────
function openTopUpModal() {
  const modal = document.getElementById('topUpModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('topUpAmountInput').focus();
  }
}

function closeTopUpModal() {
  const modal = document.getElementById('topUpModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function setTopUpAmount(amt) {
  document.getElementById('topUpAmountInput').value = amt;
}

async function executeTopUp() {
  const amountInput = document.getElementById('topUpAmountInput');
  const btn = document.getElementById('btnConfirmTopUp');
  const amount = Number(amountInput.value);

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid top-up amount greater than ₹0.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<svg class="w-4 h-4 animate-spin text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Processing...</span>`;

  try {
    const res = await apiCall('/wallet/caregiver/topup', 'POST', {
      amount,
      paymentMethod: 'UPI_MOCK'
    });

    if (!res.ok || !res.data || !res.data.success) {
      throw new Error(res.data?.message || 'Top-up failed');
    }

    closeTopUpModal();
    showNotificationBanner('Wallet Top-up Successful', `₹${amount.toLocaleString('en-IN')} has been added to your Available Balance.`);
    
    // Refresh balances and transaction history
    await loadWalletData();
    await loadTransactions(activeFilter);
  } catch (err) {
    console.error('executeTopUp error:', err);
    alert(err.message || 'Top-up failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> <span>Confirm &amp; Add Money</span>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TASK FINANCIAL DETAILS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function openTaskFinanceModal(taskId) {
  const task = reservedTasksMap[taskId];
  if (!task) return;

  const modal = document.getElementById('taskFinanceModal');
  const titleEl = document.getElementById('tfModalTitle');
  const bodyEl = document.getElementById('tfModalBody');

  titleEl.textContent = `Task Financial Ledger — ${task.title}`;

  const allocated = Number(task.authorizedAmount || 0);
  const spent = Number(task.spentAmount || 0);
  const remaining = Number(task.remainingAmount || Math.max(0, allocated - spent));
  const purchases = task.merchantPurchases || [];
  const volName = task.volunteer ? (typeof task.volunteer === 'object' ? task.volunteer.name : 'Assigned Volunteer') : 'Unassigned';

  bodyEl.innerHTML = `
    <!-- Top Stats -->
    <div class="grid grid-cols-3 gap-2 p-3.5 bg-gradient-to-r from-slate-50 to-amber-50/50 rounded-2xl border border-slate-200 text-center">
      <div class="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Allocated</span>
        <span class="text-base font-black text-slate-900 block mt-0.5">₹${allocated.toLocaleString('en-IN')}</span>
      </div>
      <div class="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Spent in Stores</span>
        <span class="text-base font-black text-amber-700 block mt-0.5">₹${spent.toLocaleString('en-IN')}</span>
      </div>
      <div class="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Unspent Balance</span>
        <span class="text-base font-black text-emerald-700 block mt-0.5">₹${remaining.toLocaleString('en-IN')}</span>
      </div>
    </div>

    <!-- Details -->
    <div class="space-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
      <div class="flex justify-between py-1 border-b border-slate-200/60">
        <span class="font-bold text-slate-500">Volunteer:</span>
        <span class="font-black text-slate-900">${escapeHTML(volName)}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-slate-200/60">
        <span class="font-bold text-slate-500">Category:</span>
        <span class="font-semibold text-slate-800">${escapeHTML(task.category)}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-slate-200/60">
        <span class="font-bold text-slate-500">Verification Status:</span>
        <span class="font-black ${task.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}">${task.status === 'completed' ? 'Verified & Completed' : 'Awaiting Completion & Verification'}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="font-bold text-slate-500">Expected Unspent Refund:</span>
        <span class="font-black text-emerald-700">₹${remaining.toLocaleString('en-IN')} (auto-releases upon task verification)</span>
      </div>
    </div>

    <!-- Itemized Merchant Purchases -->
    <div class="space-y-2">
      <h4 class="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
        <span>Itemized Store Purchases (${purchases.length})</span>
        <span class="text-emerald-700">Total Spent: ₹${spent.toLocaleString('en-IN')}</span>
      </h4>

      ${purchases.length === 0 ? `
        <p class="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl text-center">No store purchases made yet. The volunteer will use reserved funds to pay merchants.</p>
      ` : `
        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
          ${purchases.map((p, idx) => `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-[10px]">#${idx + 1}</span>
                  <span class="font-extrabold text-slate-900 truncate">${escapeHTML(p.merchant || 'Store')} — ₹${Number(p.amount).toLocaleString('en-IN')}</span>
                </div>
                <span class="text-[11px] text-slate-500 block truncate mt-0.5">Item: ${escapeHTML(p.itemName || 'Supplies')}</span>
              </div>
              <div>
                ${p.receiptDoc ? `
                  <button type="button" onclick="openImageLightbox('${normalizeDocUrl(p.receiptDoc)}')" class="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-extrabold cursor-pointer flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>View Bill</span>
                  </button>
                ` : `<span class="text-[10px] text-slate-400 italic">No bill</span>`}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeTaskFinanceModal() {
  const modal = document.getElementById('taskFinanceModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. LIGHTBOX & NOTIFICATION BANNER
// ─────────────────────────────────────────────────────────────────────────────
function openImageLightbox(url) {
  const modal = document.getElementById('imageLightboxModal');
  const img = document.getElementById('lightboxImg');
  if (modal && img) {
    img.src = url;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeImageLightbox() {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function showNotificationBanner(title, desc) {
  const banner = document.getElementById('walletNotificationBanner');
  const titleEl = document.getElementById('walletNotificationTitle');
  const descEl = document.getElementById('walletNotificationDesc');

  if (banner && titleEl && descEl) {
    titleEl.textContent = title;
    descEl.textContent = desc;
    banner.classList.remove('hidden');
  }
}

function logoutCaregiver() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Expose globals for onclick attributes
window.openTopUpModal = openTopUpModal;
window.closeTopUpModal = closeTopUpModal;
window.setTopUpAmount = setTopUpAmount;
window.executeTopUp = executeTopUp;
window.filterTransactions = filterTransactions;
window.filterTaskCards = filterTaskCards;
window.loadReservedTasks = loadReservedTasks;
window.openTaskFinanceModal = openTaskFinanceModal;
window.closeTaskFinanceModal = closeTaskFinanceModal;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.logoutCaregiver = logoutCaregiver;

