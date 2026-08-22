// AgeWell — Real-Time Messaging Client Script (Socket.IO + LinkedIn-Style UI)

let socket = null;
let currentUser = null;
let currentConversations = [];
let activeConversationId = null;
let activeConversationData = null;
let activeCategoryFilter = 'all';
let typingTimeout = null;
let onlineUsersStatus = {};
let selectedAttachmentFile = null;
let selectedAttachmentType = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  currentUser = JSON.parse(localStorage.getItem('user'));
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  // Pre-unlock AudioContext on user interaction
  const unlockAudio = () => {
    getUnlockedAudioContext();
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

  // Setup user info in header
  setupNavbarUserInfo();

  // Initialize Socket.IO connection
  initSocketConnection();

  // Load initial conversations
  await loadConversationsList();

  // Check URL query parameters (e.g. ?conv=... or ?task=...)
  handleUrlQueryParams();
});

// Setup top navbar user profile
function setupNavbarUserInfo() {
  const navAvatar = document.getElementById('navUserAvatar');
  const navName = document.getElementById('navUserName');
  const navRole = document.getElementById('navUserRole');
  const backBtn = document.getElementById('navBackDashboardBtn');

  if (navAvatar && currentUser) {
    navAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
  }
  if (navName && currentUser) {
    navName.textContent = currentUser.name || 'User';
  }
  if (navRole && currentUser) {
    navRole.textContent = currentUser.role || 'Member';
  }

  if (backBtn && currentUser) {
    if (currentUser.role === 'senior') backBtn.href = '/senior-dashboard.html';
    else if (currentUser.role === 'family') backBtn.href = '/family-dashboard.html';
    else if (currentUser.role === 'volunteer') backBtn.href = '/volunteer-dashboard.html';
    else if (currentUser.role === 'admin') backBtn.href = '/admin-dashboard.html';
  }
}

// ─── Socket.IO Real-Time Engine ──────────────────────────────────────────────
function initSocketConnection() {
  const token = localStorage.getItem('token') || getCookie('token');
  const userId = currentUser._id || currentUser.id;

  try {
    socket = io({
      auth: { token },
      query: { token, userId }
    });

    socket.on('connect', () => {
      console.log('Socket.IO Connected:', socket.id);
      // Check online status of conversation participants
      queryOnlinePresence();
    });

    socket.on('newMessage', (message) => {
      handleIncomingSocketMessage(message);
    });

    socket.on('userTyping', (data) => {
      if (data.conversationId === activeConversationId && data.userId !== userId) {
        showTypingIndicator(data.userName || 'Someone');
      }
    });

    socket.on('userStoppedTyping', (data) => {
      if (data.conversationId === activeConversationId) {
        hideTypingIndicator();
      }
    });

    socket.on('userPresenceChanged', (data) => {
      if (data && data.userId) {
        onlineUsersStatus[data.userId] = data.isOnline;
        updateOnlinePresenceUI();
      }
    });

    socket.on('conversationUpdated', () => {
      loadConversationsList(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO Disconnected');
    });
  } catch (err) {
    console.warn('Socket.IO initialization error:', err);
  }
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

// ─── Load & Render Conversations ─────────────────────────────────────────────
async function loadConversationsList(isSilent = false) {
  const container = document.getElementById('conversationsListContainer');
  if (!container) return;

  if (!isSilent && currentConversations.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center space-y-2">
        <div class="w-8 h-8 mx-auto rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
        <p class="text-xs font-bold text-slate-400">Loading conversations...</p>
      </div>`;
  }

  try {
    const res = await apiCall('/chat/conversations', 'GET');
    if (res && res.ok && res.data && res.data.data) {
      currentConversations = res.data.data;
      renderConversationsList();
      queryOnlinePresence();
      updateTotalUnreadBadge();
    }
  } catch (err) {
    console.error('Error fetching conversations:', err);
    if (!isSilent) {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-rose-500 font-bold">
          Failed to load conversations. Please check your connection.
        </div>`;
    }
  }
}

function renderConversationsList() {
  const container = document.getElementById('conversationsListContainer');
  if (!container) return;

  const myId = (currentUser._id || currentUser.id || '').toString();
  const searchVal = (document.getElementById('chatSearchInput')?.value || '').toLowerCase().trim();

  let filtered = currentConversations.filter(c => {
    // Category filter
    if (activeCategoryFilter === 'task' && c.type !== 'task') return false;
    if (activeCategoryFilter === 'direct' && c.type !== 'direct') return false;

    // Search query filter
    if (searchVal) {
      const matchTitle = (c.title || '').toLowerCase().includes(searchVal);
      const matchMsg = (c.lastMessage || '').toLowerCase().includes(searchVal);
      const matchParticipants = (c.participants || []).some(p => (p.name || '').toLowerCase().includes(searchVal));
      return matchTitle || matchMsg || matchParticipants;
    }
    return true;
  });

  // Always sort conversations so the latest message sent or received is on TOP
  filtered.sort((a, b) => {
    const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
          💬
        </div>
        <p class="text-xs font-extrabold text-slate-700">No conversations found</p>
        <p class="text-[11px] text-slate-400 font-medium">When you accept requests or start direct messages, they will appear here.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isActive = c._id === activeConversationId;
    const isTask = c.type === 'task';
    const unread = Number(c.unreadCount || 0);

    // Other participants display
    const otherParticipants = (c.participants || []).filter(p => p._id.toString() !== myId);
    let displayName = c.title || 'Conversation';
    let avatarHtml = '';
    let rolePill = '';
    let isUserOnline = false;

    if (!isTask && otherParticipants.length > 0) {
      const other = otherParticipants[0];
      displayName = other.name || 'User';
      const initial = (displayName.charAt(0) || 'U').toUpperCase();
      isUserOnline = !!onlineUsersStatus[other._id.toString()];

      avatarHtml = `
        <div class="relative flex-shrink-0">
          <div class="w-11 h-11 rounded-2xl bg-brand-50 text-brand-700 border border-brand-200/90 font-black text-sm flex items-center justify-center shadow-2xs">
            ${initial}
          </div>
          ${isUserOnline ? `<span class="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5 shadow-xs"></span>` : ''}
        </div>`;

      rolePill = `<span class="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200/70 rounded-md whitespace-nowrap flex-shrink-0 tracking-wider capitalize">${other.role || 'Member'}</span>`;
    } else {
      // 3-Way Task Chat Professional Vector Avatar
      avatarHtml = `
        <div class="relative flex-shrink-0">
          <div class="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 font-extrabold flex items-center justify-center shadow-2xs">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
        </div>`;
      rolePill = `<span class="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/90 rounded-md whitespace-nowrap flex-shrink-0 tracking-wider">Task Chat</span>`;
    }

    const timeAgo = formatChatTime(c.lastMessageAt || c.updatedAt);

    return `
      <div 
        onclick="selectConversation('${c._id}')" 
        class="p-3 rounded-2xl transition-all cursor-pointer flex items-center gap-3 relative group ${isActive ? 'bg-brand-50/90 border border-brand-200 shadow-2xs' : 'hover:bg-slate-50 border border-transparent'}"
      >
        ${avatarHtml}

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1 mb-0.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-xs font-black text-slate-900 truncate leading-tight">${escapeHTML(displayName)}</span>
              ${rolePill}
            </div>
            <span class="text-[10px] font-bold text-slate-400 flex-shrink-0">${timeAgo}</span>
          </div>

          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-medium text-slate-500 truncate leading-snug">
              ${escapeHTML(c.lastMessage || 'No messages yet')}
            </p>
            ${unread > 0 ? `<span class="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-xs">${unread}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Select & Open Conversation ──────────────────────────────────────────────
async function selectConversation(convId) {
  if (!convId) return;

  // Leave previous socket room if any
  if (activeConversationId && socket) {
    socket.emit('leaveConversation', activeConversationId);
  }

  activeConversationId = convId;
  const conversation = currentConversations.find(c => c._id === convId);
  activeConversationData = conversation;

  // Render left sidebar selection highlight
  renderConversationsList();

  // Join new socket room
  if (socket) {
    socket.emit('joinConversation', convId);
  }

  // Setup right pane header & input section
  setupActiveThreadUI(conversation);

  // Show thread on mobile viewports
  const threadContainer = document.getElementById('chatActiveThreadContainer');
  const sidebarContainer = document.getElementById('conversationsSidebar');
  if (window.innerWidth < 768) {
    if (sidebarContainer) sidebarContainer.classList.add('hidden');
    if (threadContainer) threadContainer.classList.remove('hidden');
  } else {
    if (threadContainer) threadContainer.classList.remove('hidden');
  }

  // Fetch message history
  await loadConversationMessages(convId);

  // Focus message input
  const inputEl = document.getElementById('chatMessageInput');
  if (inputEl) inputEl.focus();
}

function setupActiveThreadUI(conversation) {
  const titleEl = document.getElementById('threadTitle');
  const typeBadgeEl = document.getElementById('threadTypeBadge');
  const subtitleEl = document.getElementById('threadSubtitle');
  const avatarContainer = document.getElementById('threadAvatarContainer');
  const actionsContainer = document.getElementById('threadHeaderActions');
  const noState = document.getElementById('noChatSelectedState');
  const msgList = document.getElementById('messagesList');
  const inputSection = document.getElementById('chatInputSection');

  if (noState) noState.classList.add('hidden');
  if (msgList) msgList.classList.remove('hidden');
  if (inputSection) inputSection.classList.remove('hidden');

  const myId = (currentUser._id || currentUser.id || '').toString();
  const isTask = conversation?.type === 'task';
  const otherParticipants = (conversation?.participants || []).filter(p => p._id.toString() !== myId);

  if (!isTask && otherParticipants.length > 0) {
    const other = otherParticipants[0];
    if (titleEl) titleEl.textContent = other.name || 'Direct Chat';
    if (typeBadgeEl) {
      typeBadgeEl.textContent = (other.role || 'Member').toUpperCase();
      typeBadgeEl.className = 'px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 capitalize';
      typeBadgeEl.classList.remove('hidden');
    }
    const isOnline = !!onlineUsersStatus[other._id.toString()];
    if (subtitleEl) {
      subtitleEl.innerHTML = isOnline 
        ? `<span class="inline-flex items-center gap-1 text-emerald-600 font-bold"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Online</span>`
        : `<span class="text-slate-400 font-medium">Offline</span>`;
    }

    if (avatarContainer) {
      avatarContainer.innerHTML = `
        <div class="w-10 h-10 rounded-2xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
          ${(other.name || 'U').charAt(0).toUpperCase()}
        </div>`;
    }

    if (actionsContainer) {
      actionsContainer.innerHTML = other.phone ? `
        <a href="tel:${other.phone}" class="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center gap-1 border border-emerald-200/80 transition-all" title="Call">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
          <span class="hidden sm:inline">Call</span>
        </a>` : '';
    }
  } else {
    // 3-Person Task Chat
    const taskTitle = conversation?.taskId?.title || conversation?.title || 'Task Coordination';
    if (titleEl) titleEl.textContent = taskTitle;
    if (typeBadgeEl) {
      typeBadgeEl.textContent = '3-Way Task Chat';
      typeBadgeEl.className = 'px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/80';
      typeBadgeEl.classList.remove('hidden');
    }
    const participantNames = (conversation?.participants || []).map(p => `${p.name} (${p.role})`).join(' • ');
    if (subtitleEl) subtitleEl.textContent = participantNames || 'Senior, Caregiver & Volunteer';

    if (avatarContainer) {
      avatarContainer.innerHTML = `
        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/90 font-extrabold flex items-center justify-center shadow-2xs">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>`;
    }

    if (actionsContainer && conversation?.taskId) {
      const reqId = conversation.taskId._id || conversation.taskId;
      actionsContainer.innerHTML = `
        <span class="px-3 py-1 bg-brand-50 border border-brand-200 text-brand-800 rounded-xl text-xs font-black shadow-2xs">
          Task Status: ${conversation.taskId.status || 'Active'}
        </span>`;
    }
  }
}

// ─── Fetch & Render Messages ─────────────────────────────────────────────────
async function loadConversationMessages(convId) {
  const listEl = document.getElementById('messagesList');
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="py-12 text-center">
      <div class="w-6 h-6 mx-auto rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
    </div>`;

  try {
    const res = await apiCall(`/chat/conversations/${convId}/messages`, 'GET');
    if (res && res.ok && res.data && res.data.data) {
      renderMessagesThread(res.data.data);
      scrollChatToBottom();
      // Mark as read in local conversation model
      const conv = currentConversations.find(c => c._id === convId);
      if (conv) conv.unreadCount = 0;
      renderConversationsList();
      updateTotalUnreadBadge();
    }
  } catch (err) {
    console.error('Error fetching messages:', err);
    listEl.innerHTML = `<div class="p-6 text-center text-xs text-rose-500 font-bold">Failed to load message history</div>`;
  }
}

function renderMessagesThread(messages) {
  const listEl = document.getElementById('messagesList');
  if (!listEl) return;

  if (!messages || messages.length === 0) {
    listEl.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400 font-medium">
        No messages yet. Send a greeting to start the conversation!
      </div>`;
    return;
  }

  const myId = (currentUser._id || currentUser.id || '').toString();

  listEl.innerHTML = messages.map(msg => {
    return renderSingleMessageBubble(msg, myId);
  }).join('');
}

function renderSingleMessageBubble(msg, myId) {
  const senderId = (msg.senderId?._id || msg.senderId || '').toString();
  const isMine = senderId === myId;
  const isSystem = msg.senderRole === 'system' || msg.messageType === 'system';

  // System Notification Card
  if (isSystem) {
    return `
      <div class="flex justify-center my-3">
        <div class="bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-2 text-center max-w-md shadow-2xs">
          <p class="text-[11px] font-bold text-slate-700 leading-snug">${escapeHTML(msg.text)}</p>
          <span class="text-[9px] font-semibold text-slate-400 mt-0.5 block">${formatChatTime(msg.createdAt)}</span>
        </div>
      </div>`;
  }

  // Interactive Purchase Request Card (Merchant payment)
  if (msg.messageType === 'purchase_request' && msg.actionData) {
    const act = msg.actionData;
    const canPay = currentUser.role === 'family';

    return `
      <div class="flex ${isMine ? 'justify-end' : 'justify-start'} my-2">
        <div class="max-w-md w-full bg-white rounded-3xl border border-amber-200 shadow-md p-4 space-y-3 relative overflow-hidden">
          <div class="h-1.5 bg-gradient-to-r from-amber-400 to-brand-500 -mx-4 -mt-4 mb-3"></div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 font-black text-sm flex items-center justify-center border border-amber-200 shadow-2xs">
                <svg class="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div>
                <span class="text-xs font-black text-slate-900 block leading-tight">Purchase Payment Request</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase">${escapeHTML(act.shopName || 'Store Merchant')}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-base font-black text-emerald-700 block">₹${act.amount || 0}</span>
              <span class="text-[10px] text-slate-400 font-semibold">Bill Amount</span>
            </div>
          </div>

          ${act.qrImage ? `
            <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer" onclick="openChatLightbox('${escapeHTML(act.qrImage)}')">
              <img src="${escapeHTML(act.qrImage)}" alt="Store QR" class="w-16 h-16 object-contain rounded-lg border border-slate-300 bg-white p-0.5">
              <div class="text-xs font-medium text-slate-600">
                <span class="font-bold text-slate-900 block">Merchant Store QR</span>
                <span class="text-[11px] text-brand-600 font-bold hover:underline">Click to view full QR &rarr;</span>
              </div>
            </div>` : ''}

          ${act.upiId ? `<div class="text-xs font-bold text-slate-800 bg-slate-50 p-2 rounded-xl border border-slate-200/80">Merchant UPI ID: <span class="text-brand-700 font-black">${escapeHTML(act.upiId)}</span></div>` : ''}

          ${canPay ? `
            <div class="pt-1">
              <button 
                type="button" 
                onclick="directPayFromChat('${act.requestId}', '${act.amount}')" 
                class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>Confirm Store Payment of ₹${act.amount || 0}</span>
              </button>
            </div>` : `<p class="text-[11px] text-slate-400 italic text-center">Waiting for Family Caregiver direct merchant funding</p>`}

          <span class="text-[9px] font-semibold text-slate-400 block text-right">${formatChatTime(msg.createdAt)}</span>
        </div>
      </div>`;
  }

  // Interactive Payment Success Milestone Card
  if (msg.messageType === 'payment_success') {
    return `
      <div class="flex justify-center my-3">
        <div class="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 text-center max-w-md shadow-2xs space-y-1">
          <div class="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Payment Verified</span>
          </div>
          <p class="text-xs font-semibold text-slate-700">${escapeHTML(msg.text)}</p>
          <span class="text-[9px] font-semibold text-emerald-600 block">${formatChatTime(msg.createdAt)}</span>
        </div>
      </div>`;
  }

  // Standard Chat Bubbles (Role Specific Styling)
  const senderName = msg.senderId?.name || (isMine ? 'You' : 'Participant');
  const senderRole = msg.senderRole || 'user';
  let roleColor = 'text-brand-600 bg-brand-50 border-brand-200';
  if (senderRole === 'senior') roleColor = 'text-amber-700 bg-amber-50 border-amber-200';
  if (senderRole === 'volunteer') roleColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

  let mediaHtml = '';
  if (msg.attachmentUrl) {
    if (msg.messageType === 'image') {
      mediaHtml = `
        <div class="mt-1.5 cursor-pointer group" onclick="openChatLightbox('${escapeHTML(msg.attachmentUrl)}')">
          <img src="${escapeHTML(msg.attachmentUrl)}" alt="Attachment" class="max-w-xs max-h-56 rounded-xl object-cover border border-slate-200/80 shadow-2xs group-hover:scale-102 transition-transform">
        </div>`;
    } else {
      mediaHtml = `
        <a href="${escapeHTML(msg.attachmentUrl)}" target="_blank" class="mt-1.5 inline-flex items-center gap-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-colors">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.373L8.552 18.32a1.5 1.5 0 01-2.121-2.121L15.9 6.73"/></svg>
          <span class="truncate max-w-[180px]">${escapeHTML(msg.attachmentMetadata?.fileName || 'View Document')}</span>
        </a>`;
    }
  }

  return `
    <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} my-1.5">
      ${!isMine ? `
        <div class="flex items-center gap-1.5 mb-1 px-1">
          <span class="text-[11px] font-extrabold text-slate-700">${escapeHTML(senderName)}</span>
          <span class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${roleColor}">${senderRole}</span>
        </div>` : ''}

      <div class="max-w-sm sm:max-w-md rounded-2xl px-4 py-2.5 shadow-2xs ${isMine ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}">
        ${msg.text ? `<p class="text-xs sm:text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">${escapeHTML(msg.text)}</p>` : ''}
        ${mediaHtml}
        <span class="text-[9px] font-semibold block text-right mt-1 ${isMine ? 'text-brand-100' : 'text-slate-400'}">${formatChatTime(msg.createdAt)}</span>
      </div>
    </div>`;
}

// ─── Send Message Handler ────────────────────────────────────────────────────
async function handleSendMessageSubmit(e) {
  e.preventDefault();
  if (!activeConversationId) return;

  const inputEl = document.getElementById('chatMessageInput');
  const btnSend = document.getElementById('btnSendMessage');
  const text = (inputEl?.value || '').trim();

  if (!text && !selectedAttachmentFile) return;

  if (btnSend) btnSend.disabled = true;

  try {
    // 1. If file attached, upload via multipart
    if (selectedAttachmentFile) {
      const formData = new FormData();
      formData.append('file', selectedAttachmentFile);
      if (text) formData.append('caption', text);

      const res = await apiCall(`/chat/conversations/${activeConversationId}/upload`, 'POST', formData);
      if (res && res.ok) {
        cancelSelectedAttachment();
      }
    } else {
      // 2. Standard text message
      await apiCall(`/chat/conversations/${activeConversationId}/messages`, 'POST', {
        text,
        messageType: 'text'
      });
    }

    if (inputEl) {
      inputEl.value = '';
      inputEl.style.height = 'auto';
    }

    // Immediately update local conversation and bump to the top of the sidebar list
    const conv = currentConversations.find(c => c._id === activeConversationId);
    if (conv) {
      conv.lastMessage = text || (selectedAttachmentFile ? '📎 Attachment' : 'Message sent');
      conv.lastMessageAt = new Date().toISOString();
      renderConversationsList();
    }

    // Stop typing emit
    if (socket) {
      socket.emit('stopTyping', {
        conversationId: activeConversationId,
        userId: currentUser._id || currentUser.id
      });
    }
  } catch (err) {
    console.error('Error sending message:', err);
    alert('Failed to send message. Please check your network connection.');
  } finally {
    if (btnSend) btnSend.disabled = false;
  }
}

// ─── Modern Message Notification Chime (Web Audio API with Autoplay Unlock) ─
let globalAudioCtx = null;

function getUnlockedAudioContext() {
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

function playChimeTones(ctx) {
  try {
    const now = ctx.currentTime;

    // Tone 1: Bright pleasant chime (659.25 Hz - E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Tone 2: Harmonious high chime (987.77 Hz - B5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.07);
    gain2.gain.setValueAtTime(0, now + 0.07);
    gain2.gain.linearRampToValueAtTime(0.5, now + 0.085);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.42);
  } catch (e) {
    console.warn('Tone synth error:', e);
  }
}

function playMessageNotificationSound() {
  try {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playChimeTones(ctx)).catch(() => playChimeTones(ctx));
    } else {
      playChimeTones(ctx);
    }
  } catch (err) {
    console.warn('Audio notification warning:', err);
  }
}

// ─── Real-Time Incoming Message Handler ──────────────────────────────────────
function handleIncomingSocketMessage(message) {
  if (!message || !message.conversationId) return;

  const myId = (currentUser._id || currentUser.id || '').toString();
  const isFromOther = (message.senderId?._id || message.senderId || '').toString() !== myId;

  // Play notification chime for messages from other users
  if (isFromOther) {
    playMessageNotificationSound();
  }

  // If this message belongs to currently open conversation:
  if (message.conversationId.toString() === (activeConversationId || '').toString()) {
    const listEl = document.getElementById('messagesList');
    if (listEl) {
      const bubbleHtml = renderSingleMessageBubble(message, myId);
      listEl.insertAdjacentHTML('beforeend', bubbleHtml);
      scrollChatToBottom();
    }
    // Mark read
    apiCall(`/chat/conversations/${activeConversationId}/read`, 'PATCH').catch(() => {});
  }

  // Update conversation snippet in left sidebar
  const conv = currentConversations.find(c => c._id === message.conversationId);
  if (conv) {
    conv.lastMessage = message.text || (message.messageType === 'image' ? 'Photo attached' : 'Attachment');
    conv.lastMessageAt = message.createdAt || new Date().toISOString();
    if (message.conversationId !== activeConversationId && isFromOther) {
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }
  } else {
    // Fetch fresh conversations list
    loadConversationsList(true);
  }

  renderConversationsList();
  updateTotalUnreadBadge();
}

// ─── Attachments Handling ────────────────────────────────────────────────────
function handleAttachmentSelected(input, type) {
  if (!input.files || !input.files[0]) return;

  selectedAttachmentFile = input.files[0];
  selectedAttachmentType = type;

  const preview = document.getElementById('attachmentPreviewContainer');
  const previewIcon = document.getElementById('previewFileIcon');
  const previewName = document.getElementById('previewFileName');
  const previewSize = document.getElementById('previewFileSize');

  if (preview) preview.classList.remove('hidden');
  if (previewIcon) previewIcon.textContent = type === 'image' ? '📷' : '📄';
  if (previewName) previewName.textContent = selectedAttachmentFile.name;
  if (previewSize) previewSize.textContent = `(${(selectedAttachmentFile.size / 1024).toFixed(0)} KB)`;

  input.value = '';
}

function cancelSelectedAttachment() {
  selectedAttachmentFile = null;
  selectedAttachmentType = null;
  const preview = document.getElementById('attachmentPreviewContainer');
  if (preview) preview.classList.add('hidden');
}

// ─── Typing Indicators ───────────────────────────────────────────────────────
function handleChatInputTyping(textarea) {
  // Auto-grow textarea
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;

  if (!socket || !activeConversationId) return;

  socket.emit('typing', {
    conversationId: activeConversationId,
    userId: currentUser._id || currentUser.id,
    userName: currentUser.name
  });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping', {
      conversationId: activeConversationId,
      userId: currentUser._id || currentUser.id
    });
  }, 2000);
}

function handleChatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('chatMessageForm')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }
}

function showTypingIndicator(name) {
  const bar = document.getElementById('typingIndicatorBar');
  const text = document.getElementById('typingIndicatorText');
  if (bar && text) {
    text.textContent = `${name} is typing...`;
    bar.classList.remove('hidden');
  }
}

function hideTypingIndicator() {
  const bar = document.getElementById('typingIndicatorBar');
  if (bar) bar.classList.add('hidden');
}

// ─── Online Presence Queries ─────────────────────────────────────────────────
function queryOnlinePresence() {
  if (!socket) return;

  const userIds = [];
  const myId = (currentUser._id || currentUser.id || '').toString();

  currentConversations.forEach(c => {
    (c.participants || []).forEach(p => {
      const pId = p._id.toString();
      if (pId !== myId && !userIds.includes(pId)) userIds.push(pId);
    });
  });

  if (userIds.length > 0) {
    socket.emit('checkOnlineUsers', userIds, (statuses) => {
      if (statuses) {
        onlineUsersStatus = { ...onlineUsersStatus, ...statuses };
        updateOnlinePresenceUI();
      }
    });
  }
}

function updateOnlinePresenceUI() {
  renderConversationsList();
  if (activeConversationData) {
    setupActiveThreadUI(activeConversationData);
  }
}

// ─── Filters & Search ────────────────────────────────────────────────────────
function setChatCategoryFilter(filter) {
  activeCategoryFilter = filter;
  ['all', 'task', 'direct'].forEach(f => {
    const btn = document.getElementById(`tabFilter${f.charAt(0).toUpperCase() + f.slice(1)}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'flex-1 py-1 rounded-lg text-slate-900 bg-white shadow-2xs font-extrabold transition-all text-center';
      } else {
        btn.className = 'flex-1 py-1 rounded-lg text-slate-500 hover:text-slate-900 transition-all text-center';
      }
    }
  });
  renderConversationsList();
}

function filterConversationsLive(val) {
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) {
    if (val.trim()) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderConversationsList();
}

function clearChatSearch() {
  const input = document.getElementById('chatSearchInput');
  if (input) input.value = '';
  filterConversationsLive('');
}

function updateTotalUnreadBadge() {
  const badge = document.getElementById('unreadTotalBadge');
  if (!badge) return;

  const total = currentConversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);
  if (total > 0) {
    badge.textContent = total;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function closeMobileChatThread() {
  const threadContainer = document.getElementById('chatActiveThreadContainer');
  const sidebarContainer = document.getElementById('conversationsSidebar');
  if (sidebarContainer) sidebarContainer.classList.remove('hidden');
  if (threadContainer) threadContainer.classList.add('hidden');
}

// ─── New Direct & Task Chat Modal ───────────────────────────────────────────
async function openNewDirectChatModal() {
  const modal = document.getElementById('newDirectChatModal');
  const list = document.getElementById('directContactsList');
  if (!modal || !list) return;

  list.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Loading contacts and active tasks...</div>`;
  modal.style.display = 'flex';

  try {
    const res = await apiCall('/requests', 'GET');
    const myId = (currentUser._id || currentUser.id || '').toString();
    const contactsMap = {};
    const taskList = [];

    if (res && res.ok && res.data && res.data.requests) {
      res.data.requests.forEach(r => {
        // Collect active tasks
        if (r.volunteer || r.senior) {
          taskList.push(r);
        }
        if (r.volunteer && r.volunteer._id && r.volunteer._id.toString() !== myId) {
          contactsMap[r.volunteer._id.toString()] = r.volunteer;
        }
        if (r.senior && r.senior._id && r.senior._id.toString() !== myId) {
          contactsMap[r.senior._id.toString()] = r.senior;
        }
      });
    }

    const contacts = Object.values(contactsMap);
    let html = '';

    // If active tasks exist, show quick Task Chat triggers
    if (taskList.length > 0) {
      html += `
        <div class="mb-3 space-y-1.5">
          <div class="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider">Active Task Chats (3-Way)</div>
          ${taskList.slice(0, 5).map(t => `
            <div onclick="startTaskChatFromModal('${t._id}')" class="p-2.5 bg-amber-50/80 hover:bg-amber-100/90 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer transition-all">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-amber-800" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-black text-slate-900 truncate leading-tight">${escapeHTML(t.title)}</h4>
                  <span class="text-[10px] text-amber-800 font-bold">Status: ${t.status}</span>
                </div>
              </div>
              <button type="button" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black rounded-xl shadow-xs flex-shrink-0">Open Chat</button>
            </div>
          `).join('')}
        </div>`;
    }

    if (contacts.length > 0) {
      html += `
        <div class="space-y-1.5">
          <div class="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Direct Contacts (1-on-1)</div>
          ${contacts.map(c => `
            <div onclick="startDirectChatWithUser('${c._id}')" class="p-2.5 bg-slate-50 hover:bg-brand-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer transition-all">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-brand-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  ${(c.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-black text-slate-900 truncate leading-tight">${escapeHTML(c.name)}</h4>
                  <span class="text-[10px] text-slate-400 font-bold capitalize">${c.role || 'Member'}</span>
                </div>
              </div>
              <button type="button" class="px-2.5 py-1 bg-brand-600 text-white text-[11px] font-bold rounded-xl shadow-xs flex-shrink-0">Chat</button>
            </div>
          `).join('')}
        </div>`;
    }

    if (!html) {
      list.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-500 font-medium">
          No connected contacts or active tasks yet.
        </div>`;
      return;
    }

    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="p-4 text-center text-xs text-rose-500 font-bold">Failed to load contacts</div>`;
  }
}

async function startTaskChatFromModal(taskId) {
  closeNewDirectChatModal();
  try {
    const res = await apiCall(`/chat/task/${taskId}`, 'POST');
    if (res && res.ok && res.data && res.data.data) {
      await loadConversationsList();
      selectConversation(res.data.data._id);
    }
  } catch (e) {
    alert('Failed to open task chat.');
  }
}
window.startTaskChatFromModal = startTaskChatFromModal;

function closeNewDirectChatModal() {
  const modal = document.getElementById('newDirectChatModal');
  if (modal) modal.style.display = 'none';
}

async function startDirectChatWithUser(recipientId) {
  closeNewDirectChatModal();
  try {
    const res = await apiCall('/chat/direct', 'POST', { recipientId });
    if (res && res.ok && res.data && res.data.data) {
      await loadConversationsList();
      selectConversation(res.data.data._id);
    }
  } catch (err) {
    alert('Error initiating direct chat.');
  }
}

// ─── Lightbox for Media ──────────────────────────────────────────────────────
function openChatLightbox(url) {
  const modal = document.getElementById('chatLightboxModal');
  const img = document.getElementById('chatLightboxImg');
  const download = document.getElementById('chatLightboxDownloadLink');

  if (modal && img) {
    img.src = url;
    if (download) download.href = url;
    modal.style.display = 'flex';
  }
}

function closeChatLightbox() {
  const modal = document.getElementById('chatLightboxModal');
  if (modal) modal.style.display = 'none';
}

// ─── Query Param Handler ─────────────────────────────────────────────────────
async function handleUrlQueryParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const convId = urlParams.get('conv');
  const taskId = urlParams.get('task');

  if (convId) {
    selectConversation(convId);
  } else if (taskId) {
    try {
      const res = await apiCall(`/chat/task/${taskId}`, 'POST');
      if (res && res.ok && res.data && res.data.data) {
        await loadConversationsList();
        selectConversation(res.data.data._id);
      }
    } catch (e) {
      console.warn('Could not auto-open task chat:', e);
    }
  }
}

// ─── Helper Utilities ────────────────────────────────────────────────────────
function scrollChatToBottom() {
  const area = document.getElementById('chatMessagesArea');
  if (area) {
    setTimeout(() => {
      area.scrollTop = area.scrollHeight;
    }, 50);
  }
}

function formatChatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.selectConversation = selectConversation;
window.setChatCategoryFilter = setChatCategoryFilter;
window.filterConversationsLive = filterConversationsLive;
window.clearChatSearch = clearChatSearch;
window.closeMobileChatThread = closeMobileChatThread;
window.openNewDirectChatModal = openNewDirectChatModal;
window.closeNewDirectChatModal = closeNewDirectChatModal;
window.startDirectChatWithUser = startDirectChatWithUser;
window.handleSendMessageSubmit = handleSendMessageSubmit;
window.handleAttachmentSelected = handleAttachmentSelected;
window.cancelSelectedAttachment = cancelSelectedAttachment;
window.handleChatInputTyping = handleChatInputTyping;
window.handleChatInputKeydown = handleChatInputKeydown;
window.openChatLightbox = openChatLightbox;
window.closeChatLightbox = closeChatLightbox;
