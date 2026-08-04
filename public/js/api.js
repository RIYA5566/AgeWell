// AgeWell - API Helper and Global Accessibility Utility

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

  // Bind accessibility click handlers
  const btnInc = document.getElementById('btnTextIncrease');
  const btnDec = document.getElementById('btnTextDecrease');
  const btnReset = document.getElementById('btnTextReset');

  if (btnInc) btnInc.addEventListener('click', increaseFontSize);
  if (btnDec) btnDec.addEventListener('click', decreaseFontSize);
  if (btnReset) btnReset.addEventListener('click', resetFontSize);

  // Add username to navigation if logged in
  const userStr = localStorage.getItem('user');
  if (userStr) {
    const user = JSON.parse(userStr);
    const navUser = document.getElementById('navUserName');
    if (navUser) {
      navUser.textContent = `Hello, ${user.name} (${user.role === 'senior' ? 'Senior' : user.role === 'volunteer' ? 'Volunteer' : 'Admin'})`;
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
  const existing = document.getElementById('agewellToast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' },
    error:   { bg: '#ffebee', border: '#c62828', text: '#b71c1c' },
    info:    { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' }
  };

  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.id = 'agewellToast';
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
    font-weight: 700;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 100000;
    max-width: 90vw;
    text-align: center;
  `;

  toast.innerHTML = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
