// AgeWell - Senior Citizen Dashboard Client Script

let selectedCategory = '';
let audioCtx = null;
let alarmInterval = null;
let allFetchedRequests = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedCategoryFilter = 'all';

// Quick category opener helper for Action Card shortcuts
window.openRequestWithCategory = function(category) {
  const modal = document.getElementById('requestModal');
  if (!modal) return;
  modal.style.display = 'flex';
  resetForm();

  selectedCategory = category;
  const categoryButtons = document.querySelectorAll('.category-option-btn');
  categoryButtons.forEach(btn => {
    if (btn.getAttribute('data-category') === category) {
      btn.classList.add('selected');
    }
  });

  const titleInput = document.getElementById('requestTitle');
  if (titleInput) {
    titleInput.focus();
  }
};

// ─── Senior Daily Vitality & Routine Tracker ─────────────────────────────────
const SENIOR_DAILY_TIPS = [
  "A gentle 10-minute morning walk in natural light strengthens bones and promotes healthy sleep.",
  "Drinking 4 to 6 glasses of clean water daily helps maintain vitality, digestion, and sharp focus.",
  "Taking a few deep, relaxed breaths before each meal aids digestion and relaxes the heart.",
  "Staying in touch with caring neighbors and family brings happiness and peace of mind.",
  "Simple arm and ankle stretches while seated help improve circulation and joint comfort."
];

function getTodayDateKey() {
  const d = new Date();
  return `senior_vitality_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;
}

window.initSeniorDailyVitality = function() {
  // Set rotating daily tip based on day of month
  const tipEl = document.getElementById('dailySeniorTip');
  if (tipEl) {
    const dayIndex = new Date().getDate() % SENIOR_DAILY_TIPS.length;
    tipEl.textContent = `"${SENIOR_DAILY_TIPS[dayIndex]}"`;
  }

  // Load saved routine state for today
  try {
    const key = getTodayDateKey();
    const saved = JSON.parse(localStorage.getItem(key)) || { glasses: 0, meds: false, walk: false };
    
    // Restore hydration glasses
    window.currentHydrationCount = Number(saved.glasses || 0);
    renderHydrationState();

    // Restore checkboxes
    const medsCheckbox = document.getElementById('routineMeds');
    if (medsCheckbox) medsCheckbox.checked = !!saved.meds;

    const walkCheckbox = document.getElementById('routineWalk');
    if (walkCheckbox) walkCheckbox.checked = !!saved.walk;
  } catch (e) {
    window.currentHydrationCount = 0;
  }
};

window.toggleHydrationGlass = function(glassNum) {
  if (window.currentHydrationCount === glassNum) {
    window.currentHydrationCount = glassNum - 1;
  } else {
    window.currentHydrationCount = glassNum;
  }
  renderHydrationState();
  saveSeniorRoutineState();

  // Play gentle chime when reaching full 4 glasses
  if (window.currentHydrationCount === 4 && typeof playMessageNotificationSound === 'function') {
    playMessageNotificationSound();
  }
};

function renderHydrationState() {
  const count = window.currentHydrationCount || 0;
  const statusEl = document.getElementById('hydrationStatusText');
  if (statusEl) {
    statusEl.textContent = count === 4 ? '🎉 4 / 4 Complete!' : `${count} / 4 Glasses`;
    statusEl.className = count === 4 ? 'text-[11px] font-black text-emerald-600' : 'text-[11px] font-extrabold text-sky-700';
  }

  for (let i = 1; i <= 4; i++) {
    const glassBtn = document.getElementById(`waterGlass${i}`);
    if (glassBtn) {
      if (i <= count) {
        glassBtn.className = 'py-2.5 rounded-xl bg-sky-500 text-white font-black text-xs transition-all active:scale-95 shadow-xs flex flex-col items-center gap-1 border border-sky-600 scale-102';
        glassBtn.innerHTML = `
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          <span class="text-[10px]">Drunk</span>`;
      } else {
        glassBtn.className = 'py-2.5 rounded-xl bg-white border border-sky-200 text-sky-500 hover:border-sky-400 font-extrabold text-xs transition-all active:scale-95 shadow-2xs flex flex-col items-center gap-1';
        glassBtn.innerHTML = `
          <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
          <span class="text-[10px]">Glass ${i}</span>`;
      }
    }
  }
}

window.saveSeniorRoutineState = function() {
  try {
    const key = getTodayDateKey();
    const medsCheckbox = document.getElementById('routineMeds');
    const walkCheckbox = document.getElementById('routineWalk');
    
    const state = {
      glasses: window.currentHydrationCount || 0,
      meds: medsCheckbox ? medsCheckbox.checked : false,
      walk: walkCheckbox ? walkCheckbox.checked : false
    };
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {}
};

document.addEventListener('DOMContentLoaded', () => {
  // Validate authentication
  const auth = checkAuthAndRedirect('senior');
  if (!auth) return;

  // Personalize welcome bar & live date
  const user = JSON.parse(localStorage.getItem('user'));
  const welcomeTitle = document.getElementById('welcomeTitle');
  if (welcomeTitle && user) {
    welcomeTitle.textContent = t('sd_welcome', { name: user.name });
  }

  // Set default voice request language from user profile preference
  const voiceLangSelect = document.getElementById('voiceLangSelect');
  if (voiceLangSelect && user) {
    if (user.language === 'hi') voiceLangSelect.value = 'hi-IN';
    else if (user.language === 'mr') voiceLangSelect.value = 'mr-IN';
    else voiceLangSelect.value = 'en-IN';
  }

  // Setup search & filter tab listeners
  setupFilterToolbar();

  // Load requests
  loadRequests();

  // Initialize Voice Confirmation Assistant workflow
  initVoiceConfirmationAssistant();

  // Initialize Senior Daily Vitality & Routine Tracker
  initSeniorDailyVitality();


  // --- SOS Alert Logic ---
  const btnSos = document.getElementById('btnSos');
  const sosOverlay = document.getElementById('sosOverlay');
  const btnCancelSos = document.getElementById('btnCancelSos');

  if (btnSos) {
    btnSos.addEventListener('click', async () => {
      // Trigger API to log emergency request
      const sosData = {
        title: t('sos_alert_title'),
        description: t('sos_alert_desc'),
        category: 'Medical Escort',
        urgency: 'emergency'
      };

      // Show overlay and start audio alert immediately for responsiveness
      sosOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      startEmergencyAlarm();

      const res = await apiCall('/requests', 'POST', sosData);
      if (res.ok) {
        console.log('SOS logged in database successfully.');
        loadRequests();
      } else {
        console.error('Failed to log SOS in database:', res.data.message);
      }
    });
  }

  if (btnCancelSos) {
    btnCancelSos.addEventListener('click', () => {
      sosOverlay.style.display = 'none';
      document.body.style.overflow = '';
      stopEmergencyAlarm();
      showTabPopup(t('popup_sos_cancelled_title'), t('popup_sos_cancelled_msg'), '🔕', '#c62828');

      const appLang = (typeof getLang === 'function' ? getLang() : localStorage.getItem('agewell_lang')) || 'en';
      if (appLang === 'mr') {
        speakUtteranceWithLocale('आणीबाणीचा अलार्म रद्द करण्यात आला आहे', 'mr-IN');
      } else if (appLang === 'hi') {
        speakUtteranceWithLocale('आपातकालीन अलार्म रद्द कर दिया गया है', 'hi-IN');
      }
    });
  }

  // --- Modal Logic ---
  const modal = document.getElementById('requestModal');
  const btnNewRequest = document.getElementById('btnNewRequest');
  const modalClose = document.getElementById('modalClose');
  const btnCancelRequest = document.getElementById('btnCancelRequest');

  if (btnNewRequest) {
    btnNewRequest.addEventListener('click', () => {
      modal.style.display = 'flex';
      resetForm();
    });
  }

  const closeModal = () => {
    modal.style.display = 'none';
    resetForm();
  };

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (btnCancelRequest) {
    btnCancelRequest.addEventListener('click', () => {
      closeModal();
      showTabPopup(t('popup_form_cancelled_title'), t('popup_form_cancelled_msg'), '❌', '#c62828');

      const appLang = (typeof getLang === 'function' ? getLang() : localStorage.getItem('agewell_lang')) || 'en';
      if (appLang === 'mr') {
        speakUtteranceWithLocale('मदत विनंती फॉर्म रद्द करण्यात आला आहे', 'mr-IN');
      } else if (appLang === 'hi') {
        speakUtteranceWithLocale('सहायता अनुरोध फ़ॉर्म रद्द कर दिया गया है', 'hi-IN');
      }
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // --- Category Selector logic ---
  const categoryButtons = document.querySelectorAll('.category-option-btn');
  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = btn.getAttribute('data-category');
    });
  });

  // --- Real Voice Recording Logic (MediaRecorder API) ---
  const btnStartRecording = document.getElementById('btnStartRecording');
  const btnStopRecording = document.getElementById('btnStopRecording');
  const btnClearRecording = document.getElementById('btnClearRecording');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const recordingTimer = document.getElementById('recordingTimer');
  const waveform = document.getElementById('voiceWaveform');
  const audioPreview = document.getElementById('audioPreview');
  const audioPlayback = document.getElementById('audioPlayback');

  let mediaRecorder = null;
  let audioChunks = [];
  let recordedAudioBlob = null;
  let timerInterval = null;
  let secondsRecorded = 0;

  if (btnStartRecording) {
    btnStartRecording.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          recordedAudioBlob = new Blob(audioChunks, { type: mimeType });
          const audioUrl = URL.createObjectURL(recordedAudioBlob);
          audioPlayback.src = audioUrl;
          if (audioPreview) audioPreview.style.display = 'block';

          // Stop all audio stream tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        btnStartRecording.style.display = 'none';
        btnStopRecording.style.display = 'inline-flex';
        recordingIndicator.style.display = 'flex';
        waveform.classList.add('active');

        // Timer
        secondsRecorded = 0;
        recordingTimer.textContent = '0:00';
        timerInterval = setInterval(() => {
          secondsRecorded++;
          const mins = Math.floor(secondsRecorded / 60);
          const secs = secondsRecorded % 60;
          recordingTimer.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

          // Max 2 minutes limit
          if (secondsRecorded >= 120) {
            stopRecording();
          }
        }, 1000);

      } catch (err) {
        console.error('Error accessing microphone:', err);
        showTabPopup(
          t('popup_mic_required_title'),
          t('popup_mic_required_msg'),
          '🎙️',
          '#e65100'
        );
      }
    });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (btnStartRecording) btnStartRecording.style.display = 'inline-flex';
    if (btnStopRecording) btnStopRecording.style.display = 'none';
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    if (waveform) waveform.classList.remove('active');
  }

  if (btnStopRecording) {
    btnStopRecording.addEventListener('click', stopRecording);
  }

  if (btnClearRecording) {
    btnClearRecording.addEventListener('click', () => {
      recordedAudioBlob = null;
      if (audioPlayback) audioPlayback.src = '';
      if (audioPreview) audioPreview.style.display = 'none';
    });
  }

  // --- Help Request Form Submit ---
  const requestForm = document.getElementById('requestForm');
  const descriptionInput = document.getElementById('requestDescription');

  if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('requestTitle').value.trim();
      const description = descriptionInput ? descriptionInput.value.trim() : '';
      const urgency = document.getElementById('requestUrgency').value;

      const alertArea = document.getElementById('modalAlertArea');
      alertArea.innerHTML = '';

      // Check if at least one input is provided
      const hasCategory = selectedCategory && selectedCategory !== '';
      const hasTitle = title.length > 0;
      const hasDescription = description.length > 0;
      const hasAudio = recordedAudioBlob !== null;

      if (!hasCategory && !hasTitle && !hasDescription && !hasAudio) {
        alertArea.innerHTML = `<div class="alert alert-danger">Please select a category, type details, or record a voice message.</div>`;
        return;
      }

      // Build FormData for upload
      const formData = new FormData();
      if (selectedCategory) formData.append('category', selectedCategory);
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      formData.append('urgency', urgency);
      formData.append('voiceLanguage', document.getElementById('voiceLangSelect')?.value || 'en-IN');

      if (recordedAudioBlob) {
        formData.append('audio', recordedAudioBlob, 'voice-recording.webm');
      }


      if (recordedAudioBlob) {
        isFormRequestSubmission = true;
        formRequestDataToSubmit = formData;
        openVoiceModalForFormRequest();
        return;
      }

      const res = await apiCall('/requests', 'POST', formData);


      if (res.ok && res.data.success) {
        alertArea.innerHTML = `<div class="alert alert-success">Request raised successfully!</div>`;
        setTimeout(() => {
          closeModal();
          loadRequests();
        }, 1000);
      } else {
        alertArea.innerHTML = `<div class="alert alert-danger">${res.data.message || 'Error raising request'}</div>`;
      }
    });
  }
});

// Setup filter tabs, search and category select
function setupFilterToolbar() {
  const filterTabBtns = document.querySelectorAll('.filter-tab-btn');
  filterTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterTabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderFilteredRequests();
    });
  });

  const searchInput = document.getElementById('searchRequestsInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderFilteredRequests();
    });
  }

  const categorySelect = document.getElementById('filterCategorySelect');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      selectedCategoryFilter = e.target.value;
      renderFilteredRequests();
    });
  }
}

// Reset Request Form
function resetForm() {
  const form = document.getElementById('requestForm');
  if (form) form.reset();
  
  const categoryButtons = document.querySelectorAll('.category-option-btn');
  categoryButtons.forEach(b => b.classList.remove('selected'));
  selectedCategory = '';

  const alertArea = document.getElementById('modalAlertArea');
  if (alertArea) alertArea.innerHTML = '';

  // Clear audio recording state
  const audioPreview = document.getElementById('audioPreview');
  const audioPlayback = document.getElementById('audioPlayback');
  if (audioPlayback) audioPlayback.src = '';
  if (audioPreview) audioPreview.style.display = 'none';

  const btnStartRecording = document.getElementById('btnStartRecording');
  const btnStopRecording = document.getElementById('btnStopRecording');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const waveform = document.getElementById('voiceWaveform');
  if (btnStartRecording) btnStartRecording.style.display = 'inline-flex';
  if (btnStopRecording) btnStopRecording.style.display = 'none';
  if (recordingIndicator) recordingIndicator.style.display = 'none';
  if (waveform) waveform.classList.remove('active');
}

// Fetch and Render Requests
async function loadRequests() {
  const requestList = document.getElementById('requestList');
  if (!requestList) return;

  requestList.innerHTML = `
    <div class="loading-wrapper">
      <div class="spinner"></div>
      <span>Loading your requests...</span>
    </div>`;

  const res = await apiCall('/requests', 'GET');
  if (res.ok && res.data.success) {
    allFetchedRequests = res.data.requests || [];

    // Calculate Summary Statistics
    updateSeniorStats(allFetchedRequests);

    // Check if any completed request requires automated senior IVR voice call confirmation
    const pendingVoiceRequest = allFetchedRequests.find(r => 
      r.status === 'completed' && 
      r.completionVerified === 'pending_verification' && 
      r.requiresSeniorVoiceCall === true
    );

    if (pendingVoiceRequest) {
      triggerSeniorVoiceConfirmationCall(pendingVoiceRequest);
    }

    // Render filtered requests
    renderFilteredRequests();

  } else {
    requestList.innerHTML = `<div class="alert alert-danger">Error loading requests: ${res.data.message || 'Server error'}</div>`;
  }
}

// Update the top Stats Metrics
function updateSeniorStats(requests) {
  const totalEl = document.getElementById('statTotalCount');
  const activeEl = document.getElementById('statActiveCount');
  const completedEl = document.getElementById('statCompletedCount');
  const countBadge = document.getElementById('requestsCountBadge');

  const completedStatuses = ['completed', 'fulfilled_by_family', 'rejected', 'cancelled'];
  
  const total = requests.length;
  const completedCount = requests.filter(r => 
    r.status === 'completed' || r.status === 'fulfilled_by_family' || r.fulfilledByFamily
  ).length;
  const activeCount = requests.filter(r => 
    !completedStatuses.includes(r.status) && !r.fulfilledByFamily && r.familyApprovalStatus !== 'rejected'
  ).length;

  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = activeCount;
  if (completedEl) completedEl.textContent = completedCount;
  if (countBadge) countBadge.textContent = `${total} Request${total === 1 ? '' : 's'}`;
}

// Render Request Cards based on Filter and Search
function renderFilteredRequests() {
  const requestList = document.getElementById('requestList');
  if (!requestList) return;

  const completedStatuses = ['completed', 'fulfilled_by_family', 'rejected', 'cancelled'];

  // Apply filters
  let filtered = allFetchedRequests.filter(req => {
    const isDone = completedStatuses.includes(req.status) || req.fulfilledByFamily || req.familyApprovalStatus === 'rejected';

    // Tab filter
    if (currentFilter === 'active' && isDone) return false;
    if (currentFilter === 'completed' && !isDone) return false;

    // Category filter
    if (selectedCategoryFilter !== 'all' && req.category !== selectedCategoryFilter) {
      return false;
    }

    // Search query filter
    if (searchQuery) {
      const titleMatch = (req.title || '').toLowerCase().includes(searchQuery);
      const descMatch = (req.description || '').toLowerCase().includes(searchQuery);
      const catMatch = (req.category || '').toLowerCase().includes(searchQuery);
      if (!titleMatch && !descMatch && !catMatch) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    if (allFetchedRequests.length === 0) {
      requestList.innerHTML = `
        <div class="senior-empty-state-card">
          <div class="w-14 h-14 mx-auto mb-3 bg-brand-50 border border-brand-200/70 rounded-2xl flex items-center justify-center text-brand-600 shadow-2xs">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338A2.25 2.25 0 0017.095 4H6.905A2.25 2.25 0 004.76 5.338L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
          </div>
          <h3 class="senior-empty-title">No requests raised yet</h3>
          <p class="senior-empty-desc">Need assistance with groceries, tech help, or doctor visits? Use the Quick Action buttons above to ask for help!</p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button onclick="document.getElementById('btnVoiceConfirmation')?.click()" class="btn btn-primary" style="padding: 12px 24px; font-weight: 700;">
              🎙️ Speak a Request
            </button>
            <button onclick="document.getElementById('btnNewRequest')?.click()" class="btn btn-secondary" style="padding: 12px 24px; font-weight: 700;">
              📝 Fill Form
            </button>
          </div>
        </div>`;
    } else {
      requestList.innerHTML = `
        <div class="senior-empty-state-card">
          <span class="senior-empty-icon" aria-hidden="true">🔍</span>
          <h3 class="senior-empty-title">No matching requests found</h3>
          <p class="senior-empty-desc">Try clearing your search query or switching to "All Requests".</p>
          <button onclick="clearSeniorFilters()" class="btn btn-secondary" style="padding: 10px 20px; font-weight: 700;">
            Clear Search & Filters
          </button>
        </div>`;
    }
    return;
  }

  // Sort: Active first, then by date descending
  const sortedRequests = [...filtered].sort((a, b) => {
    const aDone = completedStatuses.includes(a.status) || a.fulfilledByFamily || a.familyApprovalStatus === 'rejected';
    const bDone = completedStatuses.includes(b.status) || b.fulfilledByFamily || b.familyApprovalStatus === 'rejected';

    if (!aDone && bDone) return -1;
    if (aDone && !bDone) return 1;

    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  requestList.innerHTML = sortedRequests.map(req => buildSeniorRequestCardHtml(req)).join('');
}

window.clearSeniorFilters = function() {
  currentFilter = 'all';
  searchQuery = '';
  selectedCategoryFilter = 'all';

  const searchInput = document.getElementById('searchRequestsInput');
  if (searchInput) searchInput.value = '';

  const catSelect = document.getElementById('filterCategorySelect');
  if (catSelect) catSelect.value = 'all';

  const filterTabBtns = document.querySelectorAll('.filter-tab-btn');
  filterTabBtns.forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-filter') === 'all') b.classList.add('active');
  });

  renderFilteredRequests();
};

// Builder for individual request cards
function buildSeniorRequestCardHtml(req) {
  // Status Badge with Color & Professional SVG Icon
  let statusBadge = '';
  if (req.status === 'fulfilled_by_family' || req.familyApprovalStatus === 'fulfilled_by_family' || req.fulfilledByFamily) {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#dcfce7;color:#15803d;border:1.5px solid #86efac;"><svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg><span>${t('status_fulfilled_by_family')}</span></span>`;
  } else if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#fee2e2;color:#b91c1c;border:1.5px solid #fca5a5;"><svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span>${t('status_rejected_by_caregiver')}</span></span>`;
  } else if (req.status === 'cancelled') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#fee2e2;color:#b91c1c;border:1.5px solid #fca5a5;"><svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span>${t('popup_cancelled_title') || 'Request Cancelled'}</span></span>`;
  } else if (req.status === 'pending' && (req.familyApprovalStatus === 'none' || !req.familyApprovalStatus)) {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#fef3c7;color:#b45309;border:1.5px solid #fde68a;"><svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${t('status_awaiting_allotment')}</span></span>`;
  } else if (req.status === 'pending' && req.familyApprovalStatus === 'approved') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#e0e7ff;color:#4338ca;border:1.5px solid #c7d2fe;"><svg class="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg><span>${t('status_allotted_volunteers')}</span></span>`;
  } else if (req.status === 'awaiting_approval' || req.status === 'quoted') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#ffedd5;color:#c2410c;border:1.5px solid #fed7aa;"><svg class="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${t('status_caregiver_reviewing')}</span></span>`;
  } else if (req.status === 'accepted') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#dbeafe;color:#1d4ed8;border:1.5px solid #93c5fd;"><svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg><span>${t('status_volunteer_assigned')}</span></span>`;
  } else if (req.status === 'purchase_cost_submitted') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#ffedd5;color:#c2410c;border:1.5px solid #fdba74;"><svg class="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg><span>${t('status_cart_proof_submitted')}</span></span>`;
  } else if (req.status === 'purchase_funded') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#dcfce7;color:#15803d;border:1.5px solid #86efac;"><svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${t('status_purchase_funded')}</span></span>`;
  } else if (req.status === 'awaiting_verification') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#f3e8ff;color:#7e22ce;border:1.5px solid #d8b4fe;"><svg class="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg><span>${t('status_awaiting_verification')}</span></span>`;
  } else if (req.status === 'completed') {
    statusBadge = `<span class="req-status-pill inline-flex items-center gap-1.5" style="background:#dcfce7;color:#15803d;border:1.5px solid #86efac;"><svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${t('status_service_completed')}</span></span>`;
  }

  // Urgency badge
  let urgencyBadge = '';
  if (req.urgency === 'high') {
    urgencyBadge = `<span class="req-urgency-pill inline-flex items-center gap-1" style="background:#fef3c7;color:#b45309;border:1.5px solid #fde68a;"><svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg><span>${t('badge_high_priority')}</span></span>`;
  } else if (req.urgency === 'emergency') {
    urgencyBadge = `<span class="req-urgency-pill inline-flex items-center gap-1" style="background:#fee2e2;color:#b91c1c;border:1.5px solid #fca5a5;"><svg class="w-3.5 h-3.5 text-rose-600 animate-pulse" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg><span>${t('badge_sos_emergency')}</span></span>`;
  }

  // Category Icon & Tag
  const categoryMap = {
    'Grocery Shopping': { key: 'skill_grocery', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>' },
    'Medical Escort': { key: 'skill_medical', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
    'Tech Support': { key: 'skill_tech', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>' },
    'Housekeeping': { key: 'skill_housekeeping', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>' },
    'Companionship': { key: 'skill_companionship', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.76-.867l.322-1.748C3.178 16.897 2.25 14.569 2.25 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>' },
    'Other': { key: 'skill_other', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>' }
  };
  const catInfo = categoryMap[req.category] || { key: 'skill_other', icon: '<svg class="w-3.5 h-3.5 inline-block text-brand-600 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>' };
  const categoryTranslated = t(catInfo.key);

  // Audio recording player
  let audioPlayerHtml = '';
  if (req.audioFile) {
    audioPlayerHtml = `
      <div class="request-audio-player" style="margin: 0.8rem 0; padding: 10px 14px; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px;">
        <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; font-weight:700; color:#15803d; margin-bottom:6px;">
          <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0V12a3 3 0 01-3 3z" /></svg>
          <span>${t('sd_voice_recording_label')}</span>
        </label>
        <audio controls src="${req.audioFile}" style="width: 100%; height: 38px;"></audio>
      </div>`;
  }

  // Stepper Visual Timeline Tracker
  const stepperHtml = buildStepTrackerHtml(req);

  // Nested Volunteer / Caregiver info
  let assignmentInfo = '';
  if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
    assignmentInfo = `
      <div class="req-caregiver-callout callout-rejected">
        <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
          <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          <span>${t('status_rejected_by_caregiver')}</span>
        </h4>
        <p style="font-size:0.95rem;"><strong>${t('sd_reason_label')}</strong> "${escapeHTML(req.familyRejectionReason || 'Caregiver marked this request as invalid.')}"</p>
      </div>`;
  } else if (req.status === 'cancelled') {
    assignmentInfo = `
      <div class="req-caregiver-callout callout-rejected">
        <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
          <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          <span>Request Cancelled</span>
        </h4>
        <p style="font-size:0.95rem;">You cancelled this help request.</p>
      </div>`;
  } else if (req.status === 'fulfilled_by_family' || req.fulfilledByFamily) {
    assignmentInfo = `
      <div class="req-caregiver-callout callout-fulfilled">
        <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
          <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
          <span>${t('sd_completed_directly_caregiver')}</span>
        </h4>
        <p style="font-size:0.95rem;">${t('sd_completed_directly_caregiver_desc')}</p>
      </div>`;
  } else if ((req.status === 'awaiting_approval' || req.status === 'quoted') && (req.volunteer || (req.volunteerQuotes && req.volunteerQuotes.length > 0))) {
    const volName = req.volunteer ? req.volunteer.name : (req.volunteerQuotes && req.volunteerQuotes[0] && req.volunteerQuotes[0].volunteer ? req.volunteerQuotes[0].volunteer.name : 'A Volunteer');
    assignmentInfo = `
      <div class="req-caregiver-callout callout-review">
        <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>${t('sd_volunteer_candidate')} ${escapeHTML(volName)}</span>
        </h4>
        <p style="font-size:0.95rem;">${t('sd_caregiver_reviewing_quotes')}</p>
      </div>`;
  } else if (['accepted', 'purchase_cost_submitted', 'purchase_funded', 'awaiting_verification'].includes(req.status) && req.volunteer) {
    const volObj = typeof req.volunteer === 'object' ? req.volunteer : null;
    const volName = volObj ? volObj.name : 'Assigned Volunteer';
    const volPhone = volObj ? volObj.phone : '';
    const volEmail = volObj ? volObj.email : '';

    // ── For awaiting_verification: show senior confirmation section ────────────
    const proofType = req.taskProofType || (
      req.category === 'Grocery Shopping' ? 'financial' :
      (req.category === 'Tech Support' || req.category === 'Housekeeping' || req.category === 'Companionship') ? 'service_only' : 'mixed'
    );
    const seniorCanVerify = req.status === 'awaiting_verification' && req.completionVerified !== 'verified';
    const isPrePaid = !!req.serviceFeePrePaid;
    const serviceFeeAmt = Number(req.serviceFee || 0);

    let verifySection = '';
    if (seniorCanVerify) {
      if (proofType === 'service_only' && serviceFeeAmt > 0 && !isPrePaid) {
        // Caregiver hasn't paid yet — senior can't release until payment is made
        verifySection = `
          <div style="margin-top:12px; padding:14px; background:linear-gradient(135deg,#fffbeb,#fef3c7); border:1.5px solid #fcd34d; border-radius:14px;">
            <p style="font-size:0.88rem; font-weight:700; color:#92400e; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Waiting for Caregiver Payment
            </p>
            <p style="font-size:0.82rem; color:#78350f;">
              The volunteer has completed the task! The caregiver needs to pay the service fee of <strong>₹${serviceFeeAmt}</strong> before the volunteer's earnings can be released.
            </p>
          </div>`;
      } else {
        // Payment done (or ₹0 fee) — show normal verify buttons
        verifySection = `
          <div style="margin-top:12px; padding:14px; background:linear-gradient(135deg,#f0fdf4,#ecfdf5); border:1.5px solid #86efac; border-radius:14px;">
            <p style="font-size:0.88rem; font-weight:700; color:#15803d; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ${proofType === 'service_only' ? 'Did the volunteer perform this service?' : 'Did the volunteer complete this task?'}
            </p>
            <p style="font-size:0.82rem; color:#166534; margin-bottom:10px;">
              ${proofType === 'service_only'
                ? 'Tap "Yes, Done!" to confirm the service was performed and release the volunteer\'s payment.'
                : 'Confirm whether the volunteer delivered your items correctly.'}
            </p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button
                id="seniorVerifyBtn_${req._id}"
                onclick="seniorVerifyTask('${req._id}', true)"
                style="flex:1; min-width:120px; padding:9px 14px; background:#16a34a; color:#fff; border:none; border-radius:10px; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:background 0.2s; box-shadow:0 2px 6px rgba(22,163,74,0.25);"
                onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'"
              >
                <svg style="width:15px;height:15px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                Yes, Done!
              </button>
              <button
                onclick="seniorVerifyTask('${req._id}', false)"
                style="flex:1; min-width:120px; padding:9px 14px; background:#fff; color:#b91c1c; border:1.5px solid #fca5a5; border-radius:10px; font-size:0.85rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;"
                onmouseover="this.style.background='#fff1f2'" onmouseout="this.style.background='#fff'"
              >
                <svg style="width:15px;height:15px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Not Done Yet
              </button>
            </div>
          </div>`;
      }
    }


    assignmentInfo = `
      <div class="req-volunteer-card">
        <div class="vol-profile-left">
          <div class="vol-avatar-circle" aria-hidden="true">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          </div>
          <div class="vol-profile-info">
            <h4>${escapeHTML(volName)} <span style="font-size:0.8rem; background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; border:1px solid #86efac;">Verified Volunteer</span></h4>
            <p>Ready to assist with this task.</p>
          </div>
        </div>
        <div class="vol-actions-right">
          ${volPhone ? `<a href="tel:${escapeHTML(volPhone)}" class="btn-call-vol"><svg class="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>Call Volunteer (${escapeHTML(volPhone)})</a>` : ''}
          ${volEmail ? `<span style="font-size:0.88rem; color:#64748b; display:inline-flex; align-items:center; gap:4px;"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>${escapeHTML(volEmail)}</span>` : ''}
        </div>
        ${verifySection}
      </div>`;
  } else if (req.status === 'completed') {
    const volObj = typeof req.volunteer === 'object' ? req.volunteer : null;
    const volName = volObj ? volObj.name : 'Platform Volunteer';

    const serviceFeeVal = Number((req.serviceFee !== undefined && req.serviceFee !== null)
      ? req.serviceFee
      : ((req.volunteerQuotes && req.volunteerQuotes[0] && req.volunteerQuotes[0].serviceFee !== undefined)
        ? req.volunteerQuotes[0].serviceFee
        : (req.paymentDetails ? req.paymentDetails.volunteerFee : 0))) || 0;

    const itemCostVal = Number((req.actualPurchaseCost !== undefined && req.actualPurchaseCost !== null)
      ? req.actualPurchaseCost
      : (req.purchasePaymentDetails ? req.purchasePaymentDetails.amountPaid : (req.paymentDetails ? req.paymentDetails.itemsCost : 0))) || 0;

    const tipVal = Number(req.tipAmount || (req.paymentDetails ? req.paymentDetails.tipAmount : 0) || (req.tipPaymentDetails ? req.tipPaymentDetails.amountPaid : 0)) || 0;
    const totalSpent = itemCostVal + serviceFeeVal + tipVal;

    assignmentInfo = `
      <div class="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 my-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 shadow-2xs">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200/80 text-brand-600 flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
            <svg class="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">${t('sd_assisted_by')}</span>
              <span class="text-sm font-extrabold text-slate-900">${escapeHTML(volName)}</span>
              <span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Fulfilled
              </span>
            </div>
            <p class="text-xs text-slate-600 font-medium mt-1 leading-normal">
              <span class="font-bold text-slate-700">${t('sd_completion_notes')}</span> "${escapeHTML(req.resolutionNotes || t('sd_no_notes_provided'))}"
            </p>
          </div>
        </div>
        <div class="self-start sm:self-auto flex-shrink-0">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-extrabold text-slate-800">
            <span class="text-slate-400 font-medium text-[11px] uppercase tracking-wider">${t('sd_total_spent')}</span>
            <span class="text-emerald-700 text-sm font-black">₹${totalSpent}</span>
            ${totalSpent === 0 ? `<span class="text-[10px] font-bold text-slate-400">(${t('sd_free_service')})</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  // Cancel Button
  const nonCancellable = ['purchase_cost_submitted', 'purchase_funded', 'awaiting_verification', 'delivery_completed', 'completed', 'rejected', 'fulfilled_by_family', 'cancelled'];
  const canDelete = !nonCancellable.includes(req.status);
  const deleteButton = canDelete 
    ? `<button class="btn btn-outline-danger" onclick="cancelHelpRequest('${req._id}')" style="display:inline-flex; align-items:center; gap:6px; padding: 8px 16px; font-size: 0.92rem; border-radius: 12px; font-weight: 700; border-width: 1.5px;">
        <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        <span>${t('btn_cancel_request')}</span>
      </button>` 
    : '';

  const cardUrgencyClass = req.urgency === 'high' ? 'urgency-high' : req.urgency === 'emergency' ? 'urgency-emergency' : '';

  let prefVal = req.shoppingPreference || '';
  if (prefVal === 'No Preference') prefVal = t('sd_pref_no_preference');
  else if (prefVal === 'Store Brand Only') prefVal = t('sd_pref_store_brand');

  const createdDateStr = new Date(req.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return `
    <article class="senior-request-card ${cardUrgencyClass}" aria-label="Request: ${escapeHTML(req.title)}">
      <!-- Top Row: Badges and Date -->
      <div class="req-card-top-row">
        <div class="req-card-badges">
          <span class="req-category-pill">
            <span>${catInfo.icon}</span> ${escapeHTML(categoryTranslated)}
          </span>
          ${statusBadge}
          ${urgencyBadge}
        </div>
        <span class="req-date-text">
          <svg class="w-3.5 h-3.5 text-slate-400 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>${t('sd_requested_on_label')}</span>${createdDateStr}
        </span>
      </div>

      <!-- Title & Description -->
      <h3 class="req-card-title">${escapeHTML(req.title)}</h3>
      ${(req.description && req.description.trim() && req.description.trim().toLowerCase() !== req.title.trim().toLowerCase()) ? `<div class="req-card-desc">${escapeHTML(req.description)}</div>` : ''}

      <!-- Shopping Preference if any -->
      ${req.shoppingPreference ? `
        <div style="margin-bottom: 0.8rem; padding: 7px 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 8px; font-size: 0.88rem; color: #1e40af; font-weight: 600; display:flex; align-items:center; gap:6px;">
          <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
          <span>${t('sd_pref_label')}<strong>${escapeHTML(prefVal)}</strong></span>
        </div>` : ''}

      ${(req.allowedBudget !== undefined && req.allowedBudget !== null && Number(req.allowedBudget) > 0) ? `
        <div style="margin-bottom: 0.8rem; padding: 7px 12px; background: #f0fdf4; border-left: 3px solid #10b981; border-radius: 8px; font-size: 0.88rem; color: #065f46; font-weight: 600; display:flex; align-items:center; gap:6px;">
          <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Caregiver Budget Estimate: <strong>₹${req.allowedBudget}</strong></span>
        </div>` : ''}

      <!-- Voice Player -->
      ${audioPlayerHtml}

      <!-- Visual Step Progress Tracker -->
      ${stepperHtml}

      <!-- Volunteer / Caregiver details -->
      ${assignmentInfo}

      <!-- Footer Row -->
      ${deleteButton ? `
        <div class="req-card-footer-row" style="justify-content: flex-end;">
          ${deleteButton}
        </div>` : ''}
    </article>`;
}

// Generate the 5-step interactive progress bar
function buildStepTrackerHtml(req) {
  if (req.status === 'cancelled') {
    return `
      <div class="req-step-tracker" style="background:#fff1f2; border-color:#fca5a5;">
        <div class="step-item completed"><div class="step-icon-circle">1</div><span class="step-label">Created</span></div>
        <div class="step-item cancelled"><div class="step-icon-circle">&#10005;</div><span class="step-label">Cancelled</span></div>
      </div>`;
  }
  if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
    return `
      <div class="req-step-tracker" style="background:#fff1f2; border-color:#fca5a5;">
        <div class="step-item completed"><div class="step-icon-circle">1</div><span class="step-label">Created</span></div>
        <div class="step-item cancelled"><div class="step-icon-circle">&#10005;</div><span class="step-label">Declined</span></div>
      </div>`;
  }
  if (req.status === 'fulfilled_by_family' || req.fulfilledByFamily) {
    return `
      <div class="req-step-tracker" style="background:#f0fdf4; border-color:#86efac;">
        <div class="step-item completed"><div class="step-icon-circle">1</div><span class="step-label">Created</span></div>
        <div class="step-item completed"><div class="step-icon-circle">&#10003;</div><span class="step-label">Family Fulfilled</span></div>
        <div class="step-item completed"><div class="step-icon-circle">&#10003;</div><span class="step-label">Complete</span></div>
      </div>`;
  }

  // Normal flow:
  // 1: Created
  // 2: Caregiver Approved / Quoting
  // 3: Volunteer Assigned
  // 4: In-Progress / Funded
  // 5: Completed
  let step = 1;
  if (req.status === 'pending' && req.familyApprovalStatus === 'approved') step = 2;
  else if (req.status === 'awaiting_approval' || req.status === 'quoted') step = 2;
  else if (req.status === 'accepted') step = 3;
  else if (['purchase_cost_submitted', 'purchase_funded', 'awaiting_verification'].includes(req.status)) step = 4;
  else if (req.status === 'completed') step = 5;

  const s1Class = step >= 1 ? (step === 1 ? 'current' : 'completed') : '';
  const s2Class = step >= 2 ? (step === 2 ? 'current' : 'completed') : '';
  const s3Class = step >= 3 ? (step === 3 ? 'current' : 'completed') : '';
  const s4Class = step >= 4 ? (step === 4 ? 'current' : 'completed') : '';
  const s5Class = step >= 5 ? 'completed' : '';

  return `
    <div class="req-step-tracker" aria-label="Request Progress Status">
      <div class="step-item ${s1Class}">
        <div class="step-icon-circle">${step > 1 ? '✓' : '1'}</div>
        <span class="step-label">Submitted</span>
      </div>
      <div class="step-item ${s2Class}">
        <div class="step-icon-circle">${step > 2 ? '✓' : '2'}</div>
        <span class="step-label">Allotment</span>
      </div>
      <div class="step-item ${s3Class}">
        <div class="step-icon-circle">${step > 3 ? '✓' : '3'}</div>
        <span class="step-label">Volunteer</span>
      </div>
      <div class="step-item ${s4Class}">
        <div class="step-icon-circle">${step > 4 ? '✓' : '4'}</div>
        <span class="step-label">In-Progress</span>
      </div>
      <div class="step-item ${s5Class}">
        <div class="step-icon-circle">${step === 5 ? '✓' : '5'}</div>
        <span class="step-label">Completed</span>
      </div>
    </div>`;
}

// Cancel a pending/active request (Exposed globally to window)
window.cancelHelpRequest = async function cancelHelpRequest(id) {
  showTabConfirm(
    t('confirm_cancel_request_title'),
    t('confirm_cancel_request_msg'),
    async () => {
      const res = await apiCall(`/requests/${id}`, 'DELETE');
      if (res.ok) {
        showTabPopup(
          t('popup_cancelled_title'),
          t('popup_cancelled_msg'),
          '🗑️',
          '#c62828'
        );
        loadRequests();
      } else {
        showTabPopup(
          t('popup_failed_cancel_title'),
          res.data?.message || t('popup_failed_cancel_msg'),
          '❌',
          '#c62828'
        );
      }
    },
    '⚠️'
  );
};

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

// --- Synthesizer Emergency SOS Alarm Logic ---
function startEmergencyAlarm() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume context if suspended (browser security)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    alarmInterval = setInterval(() => {
      // Alternate frequencies to simulate a dual-tone siren
      const time = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // Alternate high and low sirens
      const isEven = Math.floor(time) % 2 === 0;
      osc1.frequency.setValueAtTime(isEven ? 960 : 770, time);
      osc2.frequency.setValueAtTime(isEven ? 480 : 385, time);

      gainNode.gain.setValueAtTime(0.0, time);
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc1.start(time);
      osc2.start(time);

      osc1.stop(time + 0.5);
      osc2.stop(time + 0.5);
    }, 500);

  } catch (error) {
    console.error('Audio Context Error:', error);
  }
}

function stopEmergencyAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

// ──────────────────────────────────────────────────────────
// VOICE CONFIRMATION ASSISTANT (STT → TTS → Voice YES/NO)
// ──────────────────────────────────────────────────────────
let voiceRecognition = null;
let confirmRecognition = null;
let voiceAudioStream = null;
let voiceMediaRecorder = null;
let voiceAudioChunks = [];
let voiceAudioBlob = null;
let currentTranscript = '';
let currentConfidence = 85;
let isVoiceModalOpen = false;
let isFormRequestSubmission = false;
let formRequestDataToSubmit = null;


function initVoiceConfirmationAssistant() {
  const btnVoiceConfirmation = document.getElementById('btnVoiceConfirmation');
  const voiceModal = document.getElementById('voiceModal');
  const voiceModalClose = document.getElementById('voiceModalClose');
  const btnVoiceConfirmYes = document.getElementById('btnVoiceConfirmYes');
  const btnVoiceConfirmNo = document.getElementById('btnVoiceConfirmNo');

  if (btnVoiceConfirmation) {
    btnVoiceConfirmation.addEventListener('click', () => {
      openVoiceModal();
    });
  }

  if (voiceModalClose) {
    voiceModalClose.addEventListener('click', () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      closeVoiceModal(true);
    });
  }

  if (btnVoiceConfirmYes) {
    btnVoiceConfirmYes.addEventListener('click', () => {
      confirmVoiceRequest(true);
    });
  }

  if (btnVoiceConfirmNo) {
    btnVoiceConfirmNo.addEventListener('click', () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      confirmVoiceRequest(false);
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === voiceModal) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      closeVoiceModal(true);
    }
  });
}

function speakUtteranceWithLocale(text, locale, onEndCallback = null) {
  if (!window.speechSynthesis) {
    if (onEndCallback) onEndCallback();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  
  const langPrefix = locale.split('-')[0];
  utterance.lang = langPrefix === 'en' ? 'en-US' : locale;
  utterance.rate = 0.92;
  utterance.volume = 1.0; // Force maximum volume

  const voices = window.speechSynthesis.getVoices();

  if (langPrefix === 'mr') {
    // Try to find a native Marathi voice
    let marVoice = voices.find(v => v.lang.toLowerCase().startsWith('mr'));
    if (marVoice) {
      utterance.voice = marVoice;
      utterance.lang = marVoice.lang;
    } else {
      // Fallback to Hindi voice because both share the Devanagari script!
      let hiVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi'));
      if (hiVoice) {
        utterance.voice = hiVoice;
        utterance.lang = hiVoice.lang;
      }
    }
  } else if (langPrefix === 'hi') {
    let hiVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi'));
    if (hiVoice) {
      utterance.voice = hiVoice;
      utterance.lang = hiVoice.lang;
    }
  }

  if (onEndCallback) {
    utterance.onend = onEndCallback;
    utterance.onerror = onEndCallback;
  }

  window.speechSynthesis.speak(utterance);
}

function getActiveVoiceLocale() {
  const appLang = (typeof getLang === 'function' ? getLang() : localStorage.getItem('agewell_lang')) || 'en';
  if (appLang === 'mr') return 'mr-IN';
  if (appLang === 'hi') return 'hi-IN';
  return 'en-US';
}

async function openVoiceModal() {
  const voiceModal = document.getElementById('voiceModal');
  if (voiceModal) voiceModal.style.display = 'flex';

  isVoiceModalOpen = true;
  resetVoiceModalState();
  
  const selectedLang = getActiveVoiceLocale();

  const promptText = 
    selectedLang.startsWith('mr') ? "कृपया आपली मदत विनंती सांगा, आम्ही ऐकत आहोत." : 
    selectedLang.startsWith('hi') ? "कृपया अपना सहायता अनुरोध बोलें, हम सुन रहे हैं।" : 
    "Please speak out your request, we are listening.";
  
  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  if (stepStatus) {
    stepStatus.textContent = selectedLang.startsWith('mr') ? '🎙️ आपली विनंती बोला...' : selectedLang.startsWith('hi') ? '🎙️ अपना अनुरोध बोलें...' : '🎙️ Speak your request now...';
  }
  if (subStatus) {
    subStatus.textContent = selectedLang.startsWith('mr') ? 'कृपया आपल्याला काय मदत हवी आहे ते सांगा.' : selectedLang.startsWith('hi') ? 'आपको क्या मदद चाहिए, कृपया बताएं।' : 'Listening to what you need help with.';
  }

  speakUtteranceWithLocale(promptText, selectedLang, () => {
    if (isVoiceModalOpen) startRecordingAndSpeechRecognition();
  });
}


function closeVoiceModal(shouldCancelSpeech = true) {
  isVoiceModalOpen = false;
  isFormRequestSubmission = false;
  formRequestDataToSubmit = null;
  const voiceModal = document.getElementById('voiceModal');
  if (voiceModal) voiceModal.style.display = 'none';

  stopSpeechAndAudioRecording();
  if (shouldCancelSpeech && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

async function openVoiceModalForFormRequest() {
  const voiceModal = document.getElementById('voiceModal');
  if (voiceModal) voiceModal.style.display = 'flex';

  isVoiceModalOpen = true;
  isFormRequestSubmission = true;
  
  // Clear any voice assistant state
  currentTranscript = '';
  const selectedLang = getActiveVoiceLocale();
  
  const transcriptBox = document.getElementById('voiceTranscriptBox');
  if (transcriptBox) {
    transcriptBox.innerHTML = selectedLang.startsWith('hi') ? '<em style="color: #666;">आवाज संदेश रिकॉर्ड किया गया है</em>' :
                               selectedLang.startsWith('mr') ? '<em style="color: #666;">आवाज संदेश रेकॉर्ड केला आहे</em>' :
                               '<em style="color: #666;">Voice message has been recorded</em>';
  }

  // Go directly to confirmation
  const readbackPhrase = 
    selectedLang.startsWith('hi') ? `मैंने आपका अनुरोध रिकॉर्ड किया। क्या मुझे यह अनुरोध भेजना चाहिए?` :
    selectedLang.startsWith('mr') ? `मी तुमची विनंती रेकॉर्ड केली. मी ही विनंती पाठवू का?` :
    `I recorded your request. Should I send this request?`;

  const readoutText = document.getElementById('voiceReadoutText');
  if (readoutText) {
    readoutText.textContent = 
      selectedLang.startsWith('hi') ? `🔊 "क्या मुझे यह अनुरोध भेजना चाहिए?"` :
      selectedLang.startsWith('mr') ? `🔊 "मी ही विनंती पाठवू का?"` :
      `🔊 "Should I send this request?"`;
  }

  const confirmArea = document.getElementById('voiceConfirmationArea');
  if (confirmArea) confirmArea.style.display = 'block';

  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  if (stepStatus) stepStatus.textContent = selectedLang.startsWith('hi') ? '🔊 आपका अनुरोध पुष्टि के लिए पूछा जा रहा है...' : selectedLang.startsWith('mr') ? '🔊 तुमची विनंती पुष्टीकरणासाठी विचारत आहे...' : '🔊 Asking confirmation...';
  if (subStatus) subStatus.textContent = selectedLang.startsWith('hi') ? 'कृपया पुष्टि करने के लिए ध्यान से सुनें।' : selectedLang.startsWith('mr') ? 'कृपया पुष्टी करण्यासाठी काळजीपूर्वक ऐका.' : 'Please listen carefully to confirm.';

  speakUtteranceWithLocale(readbackPhrase, selectedLang, () => {
    listenForVoiceConfirmation();
  });
}


function resetVoiceModalState() {
  currentTranscript = '';
  currentConfidence = 85;
  voiceAudioBlob = null;
  voiceAudioChunks = [];

  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  const transcriptBox = document.getElementById('voiceTranscriptBox');
  const confirmArea = document.getElementById('voiceConfirmationArea');
  const confidenceBadge = document.getElementById('voiceAiConfidenceBadge');
  const pulse = document.getElementById('voiceMicPulse');

  if (stepStatus) stepStatus.textContent = t('sd_voice_status_listening');
  if (subStatus) subStatus.textContent = t('sd_voice_sub_listening');
  
  const appLang = (typeof getLang === 'function' ? getLang() : localStorage.getItem('agewell_lang')) || 'en';
  const listenMsg = appLang === 'hi' ? 'आपकी आवाज़ सुनी जा रही है...' : appLang === 'mr' ? 'तुमचा आवाज ऐकला जात आहे...' : 'Listening to your voice...';
  if (transcriptBox) transcriptBox.innerHTML = `<em style="color: #999;">${listenMsg}</em>`;
  if (confirmArea) confirmArea.style.display = 'none';
  if (confidenceBadge) confidenceBadge.style.display = 'none';
  if (pulse) {
    pulse.className = "w-20 h-20 mx-auto rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 mb-3 transition-all animate-pulse";
    pulse.innerHTML = `<svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0V12a3 3 0 01-3 3z" /></svg>`;
  }
}

async function startRecordingAndSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const selectedLang = getActiveVoiceLocale();

  try {
    voiceAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceAudioChunks = [];
    voiceMediaRecorder = new MediaRecorder(voiceAudioStream);

    voiceMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) voiceAudioChunks.push(e.data);
    };

    voiceMediaRecorder.onstop = () => {
      const mimeType = voiceMediaRecorder.mimeType || 'audio/webm';
      voiceAudioBlob = new Blob(voiceAudioChunks, { type: mimeType });
    };

    voiceMediaRecorder.start();

    if (SpeechRecognition) {
      voiceRecognition = new SpeechRecognition();
      voiceRecognition.continuous = false;
      voiceRecognition.interimResults = true;
      voiceRecognition.lang = selectedLang;

      voiceRecognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i][0].confidence) {
              currentConfidence = Math.round(event.results[i][0].confidence * 100);
            }
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const displayText = currentTranscript || interimTranscript;
        const box = document.getElementById('voiceTranscriptBox');
        if (box && displayText) {
          box.textContent = `"${displayText.trim()}"`;
        }
      };

      voiceRecognition.onerror = (err) => {
        console.warn('Voice STT error:', err.error);
      };

      voiceRecognition.onend = () => {
        finishRecordingAndReadback();
      };

      voiceRecognition.start();
    } else {
      setTimeout(() => {
        if (!currentTranscript) {
          currentTranscript = 'Voice assistance request recorded';
        }
        finishRecordingAndReadback();
      }, 5000);
    }

  } catch (err) {
    console.error('Mic access error:', err);
    showTabPopup(
      t('popup_mic_required_title'),
      t('popup_mic_required_msg2'),
      '⚠️',
      '#e65100'
    );
    closeVoiceModal();
  }
}


function stopSpeechAndAudioRecording() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (e) {}
    voiceRecognition = null;
  }
  if (confirmRecognition) {
    try { confirmRecognition.stop(); } catch (e) {}
    confirmRecognition = null;
  }
  if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
    try { voiceMediaRecorder.stop(); } catch (e) {}
  }
  if (voiceAudioStream) {
    voiceAudioStream.getTracks().forEach(track => track.stop());
    voiceAudioStream = null;
  }
}

function finishRecordingAndReadback() {
  stopSpeechAndAudioRecording();
  const selectedLang = getActiveVoiceLocale();

  if (!currentTranscript || currentTranscript.trim().length === 0) {
    currentTranscript = selectedLang.startsWith('hi') ? 'आवाज द्वारा दर्ज सहायता अनुरोध' : selectedLang.startsWith('mr') ? 'आवाज द्वारे नोंदवलेली मदत विनंती' : 'Help request recorded via voice';
  }

  const cleanTranscript = currentTranscript.trim();
  const box = document.getElementById('voiceTranscriptBox');
  if (box) box.textContent = `"${cleanTranscript}"`;

  // Evaluate AI confidence
  let isLowConfidence = false;
  if (cleanTranscript.length < 15 || currentConfidence < 70) {
    isLowConfidence = true;
    const badge = document.getElementById('voiceAiConfidenceBadge');
    if (badge) badge.style.display = 'block';
  }

  // Update Status for TTS Readback
  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  const pulse = document.getElementById('voiceMicPulse');
  
  if (stepStatus) stepStatus.textContent = selectedLang.startsWith('hi') ? 'आपका अनुरोध पढ़कर सुनाया जा रहा है...' : selectedLang.startsWith('mr') ? 'तुमची विनंती वाचून दाखवत आहे...' : 'Reading your request back...';
  if (subStatus) subStatus.textContent = selectedLang.startsWith('hi') ? 'कृपया पुष्टि करने के लिए ध्यान से सुनें।' : selectedLang.startsWith('mr') ? 'कृपया पुष्टी करण्यासाठी काळजीपूर्वक ऐका.' : 'Please listen carefully to confirm.';
  if (pulse) {
    pulse.className = "w-20 h-20 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-3 transition-all animate-pulse";
    pulse.innerHTML = `<svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" /></svg>`;
  }

  // TTS Readback
  const readbackPhrase = 
    selectedLang.startsWith('hi') ? `मैंने आपका अनुरोध रिकॉर्ड किया: ${cleanTranscript}। क्या मुझे यह अनुरोध भेजना चाहिए?` :
    selectedLang.startsWith('mr') ? `मी तुमची विनंती रेकॉर्ड केली: ${cleanTranscript}। मी ही विनंती पाठवू का?` :
    `I recorded your request: ${cleanTranscript}. Should I send this request?`;

  const confirmArea = document.getElementById('voiceConfirmationArea');
  if (confirmArea) confirmArea.style.display = 'block';

  speakUtteranceWithLocale(readbackPhrase, selectedLang, () => {
    listenForVoiceConfirmation();
  });
}


function listenForVoiceConfirmation() {
  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  const pulse = document.getElementById('voiceMicPulse');
  const selectedLang = getActiveVoiceLocale();

  if (stepStatus) stepStatus.textContent = selectedLang.startsWith('hi') ? '"हाँ" या "नहीं" बोलें...' : selectedLang.startsWith('mr') ? '"हो" किंवा "नाही" बोला...' : 'Listening for "Yes" or "No"...';
  if (subStatus) subStatus.textContent = selectedLang.startsWith('hi') ? 'भेजने के लिए "हाँ" या रद्द करने के लिए "नहीं" कहें।' : selectedLang.startsWith('mr') ? 'पाठवण्यासाठी "हो" किंवा रद्द करण्यासाठी "नाही" म्हणा.' : 'Say "Yes" to send or "No" to discard.';
  if (pulse) {
    pulse.className = "w-20 h-20 mx-auto rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 mb-3 transition-all animate-pulse";
    pulse.innerHTML = `<svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0V12a3 3 0 01-3 3z" /></svg>`;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    confirmRecognition = new SpeechRecognition();
    confirmRecognition.continuous = true;
    confirmRecognition.interimResults = false;
    confirmRecognition.lang = selectedLang;

    confirmRecognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim().toLowerCase();
          console.log('Voice confirmation input:', word);

          // Support multi-language confirmation phrases
          const matchesYes = word.includes('yes') || word.includes('yeah') || word.includes('sure') || 
                             word.includes('हाँ') || word.includes('हां') || word.includes('भेज') || 
                             word.includes('हो') || word.includes('पाठव') || word.includes('मंजूर');
                             
          const matchesNo = word.includes('no') || word.includes('cancel') || word.includes('stop') || 
                            word.includes('don\'t') || word.includes('discard') || 
                            word.includes('नहीं') || word.includes('नही') || word.includes('रद्द') || 
                            word.includes('नाही') || word.includes('नको');

          if (matchesYes) {
            confirmVoiceRequest(true);
            return;
          }
          if (matchesNo) {
            confirmVoiceRequest(false);
            return;
          }
        }
      }

    };

    confirmRecognition.onerror = (err) => {
      console.warn('Confirmation listener error:', err.error);
    };

    try {
      confirmRecognition.start();
    } catch (e) {}
  }
}

async function confirmVoiceRequest(shouldSend) {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  stopSpeechAndAudioRecording();
  const selectedLang = getActiveVoiceLocale();

  if (!shouldSend) {
    closeVoiceModal(true);
    const cancelMsg = selectedLang.startsWith('hi') ? 'आपका आवाज अनुरोध रद्द कर दिया गया है।' : selectedLang.startsWith('mr') ? 'तुमची आवाज विनंती रद्द करण्यात आली आहे.' : 'Your voice request has been cancelled and discarded.';
    const rejectTitle = selectedLang.startsWith('hi') ? 'अनुरोध अस्वीकृत / रद्द' : selectedLang.startsWith('mr') ? 'विनंती नाकारली / रद्द' : 'Request Rejected / Discarded';
    showTabPopup(
      rejectTitle,
      cancelMsg,
      '❌',
      '#c62828'
    );
    return;
  }

  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  if (stepStatus) stepStatus.textContent = selectedLang.startsWith('hi') ? 'अनुरोध भेजा जा रहा है...' : selectedLang.startsWith('mr') ? 'विनंती पाठवली जात आहे...' : 'Submitting request...';
  if (subStatus) subStatus.textContent = selectedLang.startsWith('hi') ? 'कृपया एक क्षण प्रतीक्षा करें।' : selectedLang.startsWith('mr') ? 'कृपया क्षणभर थांबा.' : 'Please wait a moment.';

  const sendMsg = selectedLang.startsWith('hi') ? 'आपका अनुरोध भेजा जा रहा है।' : selectedLang.startsWith('mr') ? 'तुमची विनंती आता पाठवत आहे.' : 'Sending your request now.';
  speakUtteranceWithLocale(sendMsg, selectedLang);

  if (isFormRequestSubmission) {
    const res = await apiCall('/requests', 'POST', formRequestDataToSubmit);
    isFormRequestSubmission = false;
    formRequestDataToSubmit = null;
    closeVoiceModal(false);
    if (typeof closeModal === 'function') {
      closeModal(); // Close standard form modal
    }
    if (res.ok && res.data.success) {
      showTabPopup(
        t('popup_confirmed_title'),
        t('popup_confirmed_msg'),
        '✅',
        '#2e7d32'
      );
      const successVoice = selectedLang.startsWith('hi') ? 'आपका अनुरोध सफलतापूर्वक जमा कर दिया गया है। पास के स्वयंसेवकों को सूचित किया जाएगा।' : selectedLang.startsWith('mr') ? 'तुमची विनंती यशस्वीरित्या सबमिट केली आहे. जवळील स्वयंसेवकांना सूचित केले जाईल.' : 'Your request has been submitted successfully. Volunteers nearby will be notified.';
      speakUtteranceWithLocale(successVoice, selectedLang);
      loadRequests();
    } else {
      showTabPopup(
        t('popup_failed_title'),
        res.data?.message || t('popup_failed_msg'),
        '❌',
        '#c62828'
      );
      const failVoice = selectedLang.startsWith('hi') ? 'आपका अनुरोध सबमिट करने में विफल रहा।' : selectedLang.startsWith('mr') ? 'तुमची विनंती सबमिट करण्यात अयशस्वी झाली.' : 'Your request submission failed.';
      speakUtteranceWithLocale(failVoice, selectedLang);
    }
    return;
  }

  const cleanTranscript = currentTranscript.trim();

  let isLowConfidence = false;
  if (cleanTranscript.length < 15 || currentConfidence < 70) {
    isLowConfidence = true;
  }

  let category = 'Other';
  const lower = cleanTranscript.toLowerCase();
  
  // Hindi & Marathi keywords for automatic category tagging
  const isGrocery = lower.includes('grocery') || lower.includes('buy') || lower.includes('food') || lower.includes('store') || lower.includes('milk') || lower.includes('bread') ||
                    lower.includes('किराना') || lower.includes('सामान') || lower.includes('खरीद') || lower.includes('दूध') ||
                    lower.includes('किराणा') || lower.includes('भाजी') || lower.includes('दूध') || lower.includes('खरेदी');
                    
  const isMedical = lower.includes('doctor') || lower.includes('hospital') || lower.includes('clinic') || lower.includes('medicine') || lower.includes('pharmacy') ||
                    lower.includes('डॉक्टर') || lower.includes('अस्पताल') || lower.includes('दवा') || lower.includes('इलाज') ||
                    lower.includes('दवाखाना') || lower.includes('औषध') || lower.includes('रुग्णालय');
                    
  const isTech = lower.includes('phone') || lower.includes('computer') || lower.includes('tech') || lower.includes('tv') || lower.includes('wifi') ||
                 lower.includes('फ़ोन') || lower.includes('कंप्यूटर') || lower.includes('मोबाईल') ||
                 lower.includes('संगणक') || lower.includes('टीव्ही') || lower.includes('वायफाय');
                 
  const isHouse = lower.includes('clean') || lower.includes('house') || lower.includes('laundry') || lower.includes('sweep') || lower.includes('trash') ||
                  lower.includes('सफाई') || lower.includes('कचरा') || lower.includes('कपड़े') ||
                  lower.includes('झाडू') || lower.includes('घरकाम');
                  
  const isCompanion = lower.includes('talk') || lower.includes('chat') || lower.includes('walk') || lower.includes('companion') || lower.includes('lonely') ||
                      lower.includes('बात') || lower.includes('गपशप') || lower.includes('साथ') ||
                      lower.includes('गप्पा') || lower.includes('सोबत') || lower.includes('एकटे');

  if (isGrocery) {
    category = 'Grocery Shopping';
  } else if (isMedical) {
    category = 'Medical Escort';
  } else if (isTech) {
    category = 'Tech Support';
  } else if (isHouse) {
    category = 'Housekeeping';
  } else if (isCompanion) {
    category = 'Companionship';
  }

  const formData = new FormData();
  formData.append('title', cleanTranscript.slice(0, 60));
  formData.append('description', cleanTranscript);
  formData.append('transcript', cleanTranscript);
  formData.append('category', category);
  
  const isUrgent = lower.includes('urgent') || lower.includes('emergency') || lower.includes('today') ||
                   lower.includes('आपातकालीन') || lower.includes('आज') || lower.includes('त्वरित') ||
                   lower.includes('तात्काळ') || lower.includes('लगेच');
  formData.append('urgency', isUrgent ? 'high' : 'low');
  formData.append('aiConfidenceScore', currentConfidence);
  formData.append('aiLowConfidence', isLowConfidence);
  formData.append('voiceLanguage', selectedLang);

  if (voiceAudioBlob) {
    formData.append('audio', voiceAudioBlob, 'voice-request.webm');
  }

  const res = await apiCall('/requests', 'POST', formData);

  closeVoiceModal(false);


  if (res.ok && res.data.success) {
    if (res.data.isLowConfidence) {
      showTabPopup(
        t('popup_low_conf_title'),
        t('popup_low_conf_msg'),
        '⚠️',
        '#f57f17'
      );
      const lowConfVoice = selectedLang.startsWith('hi') ? 'कम आत्मविश्वास के कारण, आपके देखभालकर्ता को सत्यापित करने के लिए सूचित किया गया है।' : selectedLang.startsWith('mr') ? 'कमी विश्वासार्हतेमुळे, तुमच्या काळजीवाहूला पडताळणीसाठी सूचित केले आहे.' : 'Because AI confidence was low, your caregiver has been notified to verify your request.';
      speakUtteranceWithLocale(lowConfVoice, selectedLang);
    } else {
      showTabPopup(
        t('popup_voice_confirmed_title'),
        t('popup_voice_confirmed_msg'),
        '✅',
        '#2e7d32'
      );
      const successVoice = selectedLang.startsWith('hi') ? 'आपका आवाज अनुरोध सफलतापूर्वक सत्यापित और जमा कर दिया गया है। पास के स्वयंसेवकों को सूचित किया जाएगा।' : selectedLang.startsWith('mr') ? 'तुमची आवाज विनंती यशस्वीरित्या सबमिट केली आहे. जवळील स्वयंसेवकांना सूचित केले जाईल.' : 'Your voice request has been confirmed and submitted successfully! Volunteers nearby will be notified.';
      speakUtteranceWithLocale(successVoice, selectedLang);
    }
    loadRequests();
  } else {
    showTabPopup(
      t('popup_failed_title'),
      res.data?.message || t('popup_failed_msg'),
      '❌',
      '#c62828'
    );
    const failVoice = selectedLang.startsWith('hi') ? 'आपका अनुरोध सबमिट करने में विफल रहा।' : selectedLang.startsWith('mr') ? 'तुमची विनंती सबमिट करण्यात अयशस्वी झाली.' : 'Your request submission failed.';
    speakUtteranceWithLocale(failVoice, selectedLang);
  }
}

function getSvgForPopup(iconType) {
  if (iconType === '🔕' || iconType === 'bell-off') {
    return {
      svg: `<svg class="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3 3l18 18" /></svg>`,
      bg: 'bg-rose-50 border-rose-200/80 text-rose-600'
    };
  }
  if (iconType === '🎉' || iconType === '✅' || iconType === 'success') {
    return {
      svg: `<svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
      bg: 'bg-emerald-50 border-emerald-200/80 text-emerald-600'
    };
  }
  if (iconType === '❌' || iconType === 'error') {
    return {
      svg: `<svg class="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`,
      bg: 'bg-rose-50 border-rose-200/80 text-rose-600'
    };
  }
  if (iconType === '⚠️' || iconType === 'warning') {
    return {
      svg: `<svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
      bg: 'bg-amber-50 border-amber-200/80 text-amber-600'
    };
  }
  if (iconType === '❓' || iconType === 'question') {
    return {
      svg: `<svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>`,
      bg: 'bg-amber-50 border-amber-200/80 text-amber-600'
    };
  }
  return {
    svg: `<svg class="w-8 h-8 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>`,
    bg: 'bg-brand-50 border-brand-200/80 text-brand-600'
  };
}

function showTabPopup(title, message, icon = '🎉', borderColor = '#026bc9') {
  const modal = document.getElementById('tabPopupModal');
  const titleEl = document.getElementById('tabPopupTitle');
  const msgEl = document.getElementById('tabPopupMessage');
  const iconEl = document.getElementById('tabPopupIcon');
  const iconBadge = document.getElementById('tabPopupIconBadge');
  const closeBtn = document.getElementById('btnTabPopupClose');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  const iconConfig = getSvgForPopup(icon);
  if (iconEl) {
    iconEl.innerHTML = iconConfig.svg;
  }
  if (iconBadge) {
    iconBadge.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-xs border ${iconConfig.bg}`;
  }

  if (modal) {
    modal.style.display = 'flex';
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      if (modal) modal.style.display = 'none';
    };
  }
}

function showTabConfirm(title, message, onConfirm, icon = '❓') {
  const modal = document.getElementById('tabConfirmModal');
  const titleEl = document.getElementById('tabConfirmTitle');
  const msgEl = document.getElementById('tabConfirmMessage');
  const iconEl = document.getElementById('tabConfirmIcon');
  const iconBadge = document.getElementById('tabConfirmIconBadge');
  const yesBtn = document.getElementById('btnTabConfirmYes');
  const noBtn = document.getElementById('btnTabConfirmNo');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  const iconConfig = getSvgForPopup(icon);
  if (iconEl) {
    iconEl.innerHTML = iconConfig.svg;
  }
  if (iconBadge) {
    iconBadge.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-xs border ${iconConfig.bg}`;
  }

  if (modal) {
    modal.style.display = 'flex';
  }

  if (yesBtn) {
    yesBtn.onclick = () => {
      if (modal) modal.style.display = 'none';
      if (onConfirm) onConfirm();
    };
  }

  if (noBtn) {
    noBtn.onclick = () => {
      if (modal) modal.style.display = 'none';
      showTabPopup(t('popup_aborted_title'), t('popup_aborted_msg'), 'ℹ️', '#026bc9');
    };
  }
}

// ──────────────────────────────────────────────────────────
// AUTOMATED IVR VOICE CALL CONFIRMATION FOR SENIOR CITIZENS
// ──────────────────────────────────────────────────────────
let currentIvrRequestId = null;
let ivrSpeechRecognition = null;

function triggerSeniorVoiceConfirmationCall(req) {
  currentIvrRequestId = req._id;
  const modal = document.getElementById('ivrCallModal');
  const titleEl = document.getElementById('ivrRequestTitle');
  if (!modal) return;

  const itemLabel = req.extractedItems || req.title || 'Delivery Items';
  if (titleEl) titleEl.textContent = `"${itemLabel}"`;

  modal.style.display = 'flex';

  const selectedLang = getLang();

  // Read aloud automated voice call message via SpeechSynthesis
  let callText = `Hello! Your volunteer has completed your request for ${itemLabel}. Please confirm if you received your items. Press 1 or say Yes if you received the items. Press 2 or say No if you did not.`;
  if (selectedLang === 'hi') {
    callText = `नमस्ते! आपके स्वयंसेवक ने ${itemLabel} के लिए आपका अनुरोध पूरा कर लिया है। कृपया पुष्टि करें कि क्या आपको अपनी वस्तुएं प्राप्त हो गई हैं। यदि आपको वस्तुएं प्राप्त हो गई हैं तो १ दबाएं या हाँ कहें। यदि नहीं मिली हैं, तो २ दबाएं या नहीं कहें।`;
  } else if (selectedLang === 'mr') {
    callText = `नमस्कार! आपल्या स्वयंसेवकाने ${itemLabel} साठी आपली विनंती पूर्ण केली आहे. कृपया आपल्याला वस्तू मिळाल्या आहेत का याची पुष्टी करा. वस्तू मिळाल्या असल्यास १ दाबा किंवा हो म्हणा. नसल्यास, २ दाबा किंवा नाही म्हणा.`;
  }
  
  speakUtteranceWithLocale(callText, selectedLang === 'hi' ? 'hi-IN' : selectedLang === 'mr' ? 'mr-IN' : 'en-IN');

  const ivrReadoutText = document.getElementById('ivrReadoutText');
  if (ivrReadoutText) {
    if (selectedLang === 'hi') {
      ivrReadoutText.innerHTML = `🔊 "यदि आपको वस्तुएं प्राप्त हो गई हैं तो १ दबाएं या हाँ कहें।<br>यदि नहीं मिली हैं, तो २ दबाएं या नहीं कहें।"`;
    } else if (selectedLang === 'mr') {
      ivrReadoutText.innerHTML = `🔊 "वस्तू मिळाल्या असल्यास १ दाबा किंवा हो म्हणा।<br>नसल्यास, २ दाबा किंवा नाही म्हणा।"`;
    } else {
      ivrReadoutText.innerHTML = `🔊 "Press 1 or say 'YES' if you received the items.<br>Press 2 or say 'NO' if you did not."`;
    }
  }


  // Bind Dialpad Button Handlers
  const btn1 = document.getElementById('btnIvrPress1');
  const btn2 = document.getElementById('btnIvrPress2');

  if (btn1) {
    btn1.onclick = () => submitSeniorVoiceIVRResponse(req._id, 1);
  }
  if (btn2) {
    btn2.onclick = () => submitSeniorVoiceIVRResponse(req._id, 2);
  }

  // Activate Spoken Voice Listener for "Yes" or "No" / "1" or "2"
  startIvrVoiceListener(req._id);
}

function startIvrVoiceListener(requestId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const selectedLang = getLang();

  try {
    if (ivrSpeechRecognition) {
      try { ivrSpeechRecognition.stop(); } catch (e) {}
    }

    ivrSpeechRecognition = new SpeechRecognition();
    ivrSpeechRecognition.continuous = false;
    ivrSpeechRecognition.interimResults = false;
    ivrSpeechRecognition.lang = selectedLang === 'hi' ? 'hi-IN' : selectedLang === 'mr' ? 'mr-IN' : 'en-IN';

    ivrSpeechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log('IVR Spoken Response Detected:', transcript);

      const matchesYes = transcript.includes('yes') || transcript.includes('one') || transcript === '1' || transcript.includes('receive') ||
                         transcript.includes('हाँ') || transcript.includes('हां') || transcript.includes('एक') ||
                         transcript.includes('हो') || transcript.includes('मिळा');
                         
      const matchesNo = transcript.includes('no') || transcript.includes('two') || transcript === '2' || transcript.includes('not') ||
                        transcript.includes('नहीं') || transcript.includes('नही') || transcript.includes('दो') ||
                        transcript.includes('नाही') || transcript.includes('ना');

      if (matchesYes) {
        submitSeniorVoiceIVRResponse(requestId, 1);
      } else if (matchesNo) {
        submitSeniorVoiceIVRResponse(requestId, 2);
      }
    };

    ivrSpeechRecognition.start();
  } catch (err) {
    console.warn('IVR Speech Recognition listener error:', err);
  }
}

async function submitSeniorVoiceIVRResponse(requestId, selection) {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (ivrSpeechRecognition) {
    try { ivrSpeechRecognition.stop(); } catch (e) {}
  }

  const isYes = (selection == 1 || selection === '1');
  const selectedLang = getLang();
  
  let feedbackMsg = isYes ? "Thank you! Your delivery confirmation has been verified." : "We have recorded your report. Support will follow up with your volunteer.";
  if (selectedLang === 'hi') {
    feedbackMsg = isYes ? "धन्यवाद! आपका वितरण सत्यापन सफलतापूर्वक पूर्ण हो गया है।" : "हमने आपकी रिपोर्ट दर्ज कर ली है। सहायता टीम जल्द ही आपके स्वयंसेवक से संपर्क करेगी।";
  } else if (selectedLang === 'mr') {
    feedbackMsg = isYes ? "धन्यवाद! आपली वितरण खात्री यशस्वीरित्या पूर्ण झाली आहे." : "आम्ही आपला अहवाल नोंदवला आहे. मदत टीम लवकरच आपल्या स्वयंसेवकाशी संपर्क साधेल.";
  }

  speakUtteranceWithLocale(feedbackMsg, selectedLang === 'hi' ? 'hi-IN' : selectedLang === 'mr' ? 'mr-IN' : 'en-IN');


  const modal = document.getElementById('ivrCallModal');
  if (modal) modal.style.display = 'none';

  const res = await apiCall(`/requests/${requestId}/verify-completion-voice`, 'PUT', { selection });

  if (res.ok && res.data.success) {
    showTabPopup(
      isYes ? t('popup_delivery_confirmed_title') : t('popup_issue_reported_title'),
      isYes ? t('popup_delivery_confirmed_msg') : t('popup_issue_reported_msg'),
      isYes ? '✅' : '⚠️',
      isYes ? '#2e7d32' : '#f57f17'
    );
    loadRequests();
  } else {
    showTabPopup(
      t('popup_error_title'),
      res.data?.message || t('popup_error_submit_msg'),
      '❌',
      '#c62828'
    );
  }
}

// â”€â”€ Senior directly verifies the volunteer completed the task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Called from "Yes, Done!" / "Not Done Yet" buttons in the request cards
window.seniorVerifyTask = async function(requestId, approved) {
  var btn = document.getElementById('seniorVerifyBtn_' + requestId);
  if (btn) {
    btn.disabled = true;
    btn.textContent = approved ? 'Confirming...' : 'Submitting...';
  }
  try {
    var res = await apiCall('/requests/' + requestId + '/verify-completion-senior', 'PUT', {
      approved: approved,
      rejectionReason: approved ? '' : 'Senior reported the task is not yet complete.'
    });
    if (res.ok && res.data.success) {
      if (approved) {
        showTabPopup(
          'Task Confirmed!',
          'Thank you! The volunteer service charge has been released. The task is now complete.',
          'âœ…',
          '#16a34a'
        );
      } else {
        showTabPopup(
          'Feedback Noted',
          'We have notified the volunteer that the task needs attention.',
          'âš ï¸',
          '#d97706'
        );
      }
      loadRequests();
    } else {
      showTabPopup(
        'Error',
        (res.data && res.data.message) || 'Could not record your confirmation. Please try again.',
        'âŒ',
        '#c62828'
      );
      if (btn) { btn.disabled = false; btn.textContent = 'Yes, Done!'; }
    }
  } catch (err) {
    console.error('Senior verify task error:', err);
    showTabPopup('Network Error', 'Please check your connection and try again.', 'âŒ', '#c62828');
    if (btn) { btn.disabled = false; btn.textContent = 'Yes, Done!'; }
  }
};
