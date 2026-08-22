// AgeWell - API Helper and Global Accessibility Utility

// Proxy localStorage to sessionStorage for authentication keys to allow separate portals in different tabs
(function() {
  const authKeys = ['token', 'user'];
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.getItem = function(key) {
    if (this === window.localStorage && authKeys.includes(key)) {
      return originalGetItem.call(window.sessionStorage, key);
    }
    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function(key, value) {
    if (this === window.localStorage && authKeys.includes(key)) {
      return originalSetItem.call(window.sessionStorage, key, value);
    }
    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function(key) {
    if (this === window.localStorage && authKeys.includes(key)) {
      return originalRemoveItem.call(window.sessionStorage, key);
    }
    return originalRemoveItem.call(this, key);
  };
})();

const API_BASE = '/api';

// Simple check to redirect users based on role and auth status
function checkAuthAndRedirect(expectedRole) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    // Not logged in, redirect to login page
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html' && window.location.pathname !== '/register.html') {
      window.location.href = '/';
    }
    return null;
  }

  const user = JSON.parse(userStr);

  if (expectedRole && user.role !== expectedRole) {
    // Role mismatch, redirect to respective dashboard
    redirectToDashboard(user.role);
    return null;
  }

  return { token, user };
}

function redirectToDashboard(role) {
  if (role === 'senior')    window.location.href = '/senior-dashboard.html';
  else if (role === 'volunteer') window.location.href = '/volunteer-dashboard.html';
  else if (role === 'family')    window.location.href = '/family-dashboard.html';
  else if (role === 'admin')     window.location.href = '/admin-dashboard.html';
  else window.location.href = '/';
}

// Fetch wrapper with automatic authentication headers
async function apiCall(endpoint, method = 'GET', data = null) {
  const token = localStorage.getItem('token');
  const headers = {};

  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    if (data instanceof FormData) {
      config.body = data;
    } else {
      config.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    let result;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = { message: text || `Error (${response.status})` };
      }
    }

    if (response.status === 401) {
      // Session expired, clear storage and send to landing
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/' && window.location.pathname !== '/index.html' && window.location.pathname !== '/register.html') {
        window.location.href = '/?message=session_expired';
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      data: result
    };
  } catch (error) {
    console.error('API call failure:', error);
    return {
      status: 500,
      ok: false,
      data: { message: error.message || 'Network connection error. Please make sure the server is running.' }
    };
  }
}

// User logout helper
async function logoutUser() {
  await apiCall('/auth/logout', 'POST');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// --- Accessibility Sizing Controls ---
let currentFontSize = parseInt(localStorage.getItem('fontSize') || '18');

function applyFontSize(size) {
  document.documentElement.style.setProperty('--base-font-size', `${size}px`);
  localStorage.setItem('fontSize', size);
  
  // Show font size counter indicator if it exists
  const textIndicator = document.getElementById('fontSizeIndicator');
  if (textIndicator) {
    textIndicator.textContent = `${size}px`;
  }
}

function increaseFontSize() {
  if (currentFontSize < 30) { // Limit max zoom
    currentFontSize += 2;
    applyFontSize(currentFontSize);
  }
}

function decreaseFontSize() {
  if (currentFontSize > 14) { // Limit min zoom
    currentFontSize -= 2;
    applyFontSize(currentFontSize);
  }
}

function resetFontSize() {
  currentFontSize = 18;
  applyFontSize(currentFontSize);
}

// Clean up any previously cached dark mode class or setting
try {
  localStorage.removeItem('agewell_theme');
  document.documentElement.classList.remove('dark', 'dark-theme');
  if (document.body) document.body.classList.remove('dark', 'dark-theme');
} catch (e) {}

// Initialize Accessibility Panel handlers on load
document.addEventListener('DOMContentLoaded', () => {
  // Clear any residual dark mode class
  document.documentElement.classList.remove('dark', 'dark-theme');
  if (document.body) document.body.classList.remove('dark', 'dark-theme');

  // Apply saved font size immediately
  applyFontSize(currentFontSize);

  // Auto-inject language switcher into accessibility panel
  const accPanel = document.querySelector('.accessibility-panel');
  if (accPanel) {
    // Create language switcher wrapper
    const langWrapper = document.createElement('div');
    langWrapper.className = 'lang-switcher';
    const hasTextSizeButtons = document.getElementById('btnTextIncrease') !== null;
    if (hasTextSizeButtons) {
      langWrapper.style.cssText = 'display: inline-flex; gap: 8px; margin-left: 15px; align-items: center; border-left: 2px solid rgba(148, 163, 184, 0.3); padding-left: 12px;';
    } else {
      langWrapper.style.cssText = 'display: inline-flex; gap: 8px; align-items: center;';
    }
    
    // Globe icon indicator for language switcher
    const labelSpan = document.createElement('span');
    labelSpan.setAttribute('data-i18n', 'nav_language_label');
    labelSpan.setAttribute('title', 'Language');
    labelSpan.setAttribute('aria-label', 'Language');
    labelSpan.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; margin-right: 2px; color: #475569;';
    labelSpan.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align: middle; display: inline-block;"><circle cx="12" cy="12" r="9" /><path stroke-linecap="round" stroke-linejoin="round" d="M3.6 9h16.8M3.6 15h16.8" /><path stroke-linecap="round" stroke-linejoin="round" d="M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18" /></svg>';
    
    const btnEn = document.createElement('button');
    btnEn.id = 'langBtnEn';
    btnEn.setAttribute('title', 'English');
    btnEn.setAttribute('aria-label', 'English');
    btnEn.innerHTML = '<span style="font-weight: 900; font-size: 11px; letter-spacing: -0.02em;">EN</span>';
    btnEn.onclick = () => setLang('en');
    
    const btnHi = document.createElement('button');
    btnHi.id = 'langBtnHi';
    btnHi.setAttribute('title', 'हिन्दी (Hindi)');
    btnHi.setAttribute('aria-label', 'Hindi');
    btnHi.innerHTML = '<span style="font-weight: 900; font-size: 13px;">अ</span>';
    btnHi.onclick = () => setLang('hi');
    
    const btnMr = document.createElement('button');
    btnMr.id = 'langBtnMr';
    btnMr.setAttribute('title', 'मराठी (Marathi)');
    btnMr.setAttribute('aria-label', 'Marathi');
    btnMr.innerHTML = '<span style="font-weight: 900; font-size: 13px;">म</span>';
    btnMr.onclick = () => setLang('mr');

    langWrapper.appendChild(labelSpan);
    langWrapper.appendChild(btnEn);
    langWrapper.appendChild(btnHi);
    langWrapper.appendChild(btnMr);
    accPanel.appendChild(langWrapper);

    // Apply switcher button active styles based on current language
    if (typeof updateLangSwitcherUI === 'function') {
      updateLangSwitcherUI(getLang());
    }
  }

  // Bind accessibility click handlers
  const btnInc = document.getElementById('btnTextIncrease');
  const btnDec = document.getElementById('btnTextDecrease');
  const btnReset = document.getElementById('btnTextReset');

  if (btnInc) btnInc.addEventListener('click', increaseFontSize);
  if (btnDec) btnDec.addEventListener('click', decreaseFontSize);
  if (btnReset) btnReset.addEventListener('click', resetFontSize);

  // Sync language selection from user object
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.language && !localStorage.getItem('appLang')) {
        localStorage.setItem('appLang', user.language);
      }
      
      const navUser = document.getElementById('navUserName');
      if (navUser) {
        navUser.textContent = `Hello, ${user.name} (${user.role === 'senior' ? 'Senior' : user.role === 'volunteer' ? 'Volunteer' : user.role === 'family' ? (user.relationship || 'Caregiver') : 'Admin'})`;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Bind logout button if exists
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
});


// Global Toast Notification Helper
function showToast(message, type = 'info') {
  if (!message) return;
  // Deduplicate identical toast messages within 1.5s
  if (window._recentToastMsg === message && (Date.now() - (window._recentToastTime || 0)) < 1500) {
    return;
  }
  window._recentToastMsg = message;
  window._recentToastTime = Date.now();

  let container = document.getElementById('agewellToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'agewellToastContainer';
    container.style.cssText = `
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
      max-width: 440px;
      width: calc(100vw - 2.5rem);
    `;
    document.body.appendChild(container);
  }

  // Remove oldest if more than 3
  while (container.children.length >= 3) {
    container.firstChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'agewell-toast-item';
  toast.style.cssText = `
    pointer-events: auto;
    background: #0f172a;
    color: #f8fafc;
    border-radius: 18px;
    padding: 14px 18px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
    transform: translateY(-16px) scale(0.96);
    opacity: 0;
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  let iconSvg = '';
  let badgeStyle = '';
  let titleText = '';

  if (type === 'success') {
    badgeStyle = 'background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);';
    titleText = 'Success';
    iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';
  } else if (type === 'error') {
    badgeStyle = 'background: rgba(244, 63, 94, 0.18); color: #fb7185; border: 1px solid rgba(251, 113, 133, 0.3);';
    titleText = 'Notice';
    iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>';
  } else {
    badgeStyle = 'background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3);';
    titleText = 'Information';
    iconSvg = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>';
  }

  const safeMsg = (typeof message === 'string') ? message : JSON.stringify(message);

  toast.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; ${badgeStyle}">
      ${iconSvg}
    </div>
    <div style="flex: 1; min-width: 0; padding-top: 1px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.65; margin-bottom: 2px; color: #94a3b8;">
        ${titleText}
      </div>
      <div style="font-size: 13px; font-weight: 600; line-height: 1.45; color: #f8fafc;">
        ${safeMsg}
      </div>
    </div>
    <button type="button" style="background: none; border: none; padding: 4px; color: #64748b; cursor: pointer; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: color 0.2s;" onmouseover="this.style.color='#cbd5e1'" onmouseout="this.style.color='#64748b'" onclick="this.closest('.agewell-toast-item').remove()">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  container.appendChild(toast);

  // Entrance
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0) scale(1)';
    toast.style.opacity = '1';
  });

  // Auto dismiss
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transform = 'translateY(-12px) scale(0.96)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 350);
    }
  }, 4500);
}

/* =============================================================
   awConfirm() — Custom Styled Confirm Dialog
   Replaces native browser confirm() across all portals.
   Usage: const ok = await awConfirm({ title, message, confirmText, danger })
   ============================================================= */
function awConfirm({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    // ── Remove any stale instance ──────────────────────────
    const existing = document.getElementById('aw-confirm-overlay');
    if (existing) existing.remove();

    // ── Styles ─────────────────────────────────────────────
    const overlayStyle = `
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(15,23,42,0.45);
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      animation:awFadeIn 0.18s ease;
    `;

    const dialogStyle = `
      width:100%;max-width:440px;margin:16px;
      background:#ffffff;
      border:1px solid rgba(226,232,240,0.9);
      border-radius:22px;
      box-shadow:0 25px 50px -12px rgba(15,23,42,0.25), 0 0 0 1px rgba(0,0,0,0.02);
      animation:awSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
      overflow:hidden;
    `;

    const iconBg    = danger ? '#fee2e2' : '#eff6ff';
    const iconColor = danger ? '#dc2626' : '#2563eb';
    const confirmBg = danger ? '#dc2626' : '#2563eb';
    const titleColor   = '#0f172a';
    const messageColor = '#475569';
    const cancelBg     = '#f1f5f9';
    const cancelColor  = '#475569';
    const cancelBorder = '#cbd5e1';

    // ── SVG icons ──────────────────────────────────────────
    const iconSVG = danger
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
           <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
         </svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
           <circle cx="12" cy="12" r="10"/>
           <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
         </svg>`;

    // ── HTML ───────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'aw-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'aw-confirm-title');
    overlay.style.cssText = overlayStyle;

    overlay.innerHTML = `
      <style>
        @keyframes awFadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes awSlideUp  { from { opacity:0; transform:translateY(24px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        #aw-confirm-dialog { ${dialogStyle} }
        #aw-confirm-dialog * { box-sizing:border-box; font-family: 'Plus Jakarta Sans', sans-serif; }
        #aw-btn-confirm { cursor:pointer;transition:all 0.15s ease; }
        #aw-btn-confirm:hover { filter:brightness(1.1); transform:translateY(-1px); }
        #aw-btn-confirm:active { transform:scale(0.97); }
        #aw-btn-cancel  { cursor:pointer;transition:all 0.15s ease; }
        #aw-btn-cancel:hover  { background:#e2e8f0 !important; }
        #aw-btn-cancel:active { transform:scale(0.97); }
      </style>

      <div id="aw-confirm-dialog">
        <!-- Top accent line -->
        <div style="height:4px;background:${danger ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#2563eb,#38bdf8)'};"></div>

        <!-- Header -->
        <div style="display:flex;align-items:flex-start;gap:14px;padding:24px 24px 16px;">
          <!-- Icon -->
          <div style="
            flex-shrink:0;width:46px;height:46px;border-radius:14px;
            background:${iconBg};border:1px solid ${danger ? '#fca5a5' : '#bfdbfe'};
            display:flex;align-items:center;justify-content:center;
          ">${iconSVG}</div>

          <!-- Title + message -->
          <div style="flex:1;min-width:0;">
            <h3 id="aw-confirm-title" style="
              margin:0 0 6px;font-size:16px;font-weight:800;line-height:1.3;
              color:${titleColor};letter-spacing:-0.01em;
            ">${title}</h3>
            <p style="
              margin:0;font-size:13.5px;line-height:1.55;
              color:${messageColor};
            ">${message}</p>
          </div>
        </div>

        <!-- Divider -->
        <div style="height:1px;background:#f1f5f9;margin:0 24px;"></div>

        <!-- Actions -->
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 24px;">
          <button id="aw-btn-cancel" style="
            padding:10px 20px;border-radius:12px;font-size:13.5px;font-weight:700;
            background:${cancelBg};color:${cancelColor};
            border:1px solid ${cancelBorder};
            outline:none;
          ">${cancelText}</button>
          <button id="aw-btn-confirm" style="
            padding:10px 22px;border-radius:12px;font-size:13.5px;font-weight:800;
            background:${confirmBg};color:#fff;
            border:none;outline:none;
            box-shadow:${danger ? '0 4px 14px rgba(220,38,38,0.3)' : '0 4px 14px rgba(37,99,235,0.3)'};
          ">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // ── Focus confirm button ───────────────────────────────
    const btnConfirm = overlay.querySelector('#aw-btn-confirm');
    const btnCancel  = overlay.querySelector('#aw-btn-cancel');
    setTimeout(() => btnConfirm.focus(), 50);

    // ── Close helper ───────────────────────────────────────
    function close(result) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s ease';
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    }

    // ── Event listeners ────────────────────────────────────
    btnConfirm.addEventListener('click', () => close(true));
    btnCancel.addEventListener('click',  () => close(false));

    // Click outside to dismiss
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close(false);
    });

    // Escape key
    function onKey(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
      if (e.key === 'Enter')  { close(true);  document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);
  });
}
