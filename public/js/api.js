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
    const result = await response.json();

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
      data: { message: 'Network connection error. Please make sure the server is running.' }
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

// Initialize Accessibility Panel handlers on load
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved font size immediately
  applyFontSize(currentFontSize);

  // Auto-inject language switcher next to accessibility size indicators
  const accPanel = document.querySelector('.accessibility-panel');
  if (accPanel) {
    // Create language switcher wrapper
    const langWrapper = document.createElement('div');
    langWrapper.className = 'lang-switcher';
    const hasTextSizeButtons = document.getElementById('btnTextIncrease') !== null;
    if (hasTextSizeButtons) {
      langWrapper.style.cssText = 'display: inline-flex; gap: 8px; margin-left: 20px; align-items: center; border-left: 2px solid #ccc; padding-left: 15px;';
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
        navUser.textContent = `Hello, ${user.name} (${user.role === 'senior' ? 'Senior' : user.role === 'volunteer' ? 'Volunteer' : 'Admin'})`;
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
