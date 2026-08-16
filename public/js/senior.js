// AgeWell - Senior Citizen Dashboard Client Script

let selectedCategory = '';
let audioCtx = null;
let alarmInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  // Validate authentication
  const auth = checkAuthAndRedirect('senior');
  if (!auth) return;

  // Personalize welcome bar
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

  // Load requests
  loadRequests();

  // Initialize Voice Confirmation Assistant workflow
  initVoiceConfirmationAssistant();


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
    const requests = res.data.requests;

    // Check if any completed request requires automated senior IVR voice call confirmation
    const pendingVoiceRequest = requests.find(r => 
      r.status === 'completed' && 
      r.completionVerified === 'pending_verification' && 
      r.requiresSeniorVoiceCall === true
    );

    if (pendingVoiceRequest) {
      triggerSeniorVoiceConfirmationCall(pendingVoiceRequest);
    }

    if (requests.length === 0) {
      requestList.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: var(--color-white); border-radius: var(--border-radius); border: 3px dashed var(--color-primary-light);">
          <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🌸</span>
          <p style="font-size: 1.2rem; font-weight: 600; color: var(--color-primary-dark);">No active requests found.</p>
          <p style="margin-top: 5px;">Need help? Click the green button above to raise a request!</p>
        </div>`;
      return;
    }

    const completedStatuses = ['completed', 'fulfilled_by_family', 'rejected', 'cancelled'];

    const sortedRequests = [...requests].sort((a, b) => {
      const aDone = completedStatuses.includes(a.status) || a.fulfilledByFamily || a.familyApprovalStatus === 'rejected';
      const bDone = completedStatuses.includes(b.status) || b.fulfilledByFamily || b.familyApprovalStatus === 'rejected';

      // Active/Pending requests MUST appear FIRST
      if (!aDone && bDone) return -1;
      if (aDone && !bDone) return 1;

      // Newer requests first
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    requestList.innerHTML = sortedRequests.map(req => {
      let statusBadge = '';
      if (req.status === 'fulfilled_by_family' || req.familyApprovalStatus === 'fulfilled_by_family' || req.fulfilledByFamily) {
        statusBadge = `<span class="badge" style="background:#e8f5e9;color:#1b5e20;border:2px solid #2e7d32;font-weight:bold;">${t('status_fulfilled_by_family')}</span>`;
      } else if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
        statusBadge = `<span class="badge" style="background:#ffebee;color:#c62828;border:2px solid #b71c1c;font-weight:bold;">${t('status_rejected_by_caregiver')}</span>`;
      } else if (req.status === 'cancelled') {
        statusBadge = `<span class="badge" style="background:#ffebee;color:#c62828;border:2px solid #b71c1c;font-weight:bold;">❌ Request Cancelled</span>`;
      } else if (req.status === 'pending' && (req.familyApprovalStatus === 'none' || !req.familyApprovalStatus)) {
        statusBadge = `<span class="badge" style="background:#fff8e1;color:#e65100;border:2px solid #ffa000;font-weight:bold;">${t('status_awaiting_allotment')}</span>`;
      } else if (req.status === 'pending' && req.familyApprovalStatus === 'approved') {
        statusBadge = `<span class="badge badge-pending">${t('status_allotted_volunteers')}</span>`;
      } else if (req.status === 'awaiting_approval' || req.status === 'quoted') {
        statusBadge = `<span class="badge" style="background:#ffe082;color:#e65100;border:2px solid #f57f17;font-weight:bold;">${t('status_caregiver_reviewing')}</span>`;
      } else if (req.status === 'accepted') {
        statusBadge = `<span class="badge badge-accepted">${t('status_volunteer_assigned')}</span>`;
      } else if (req.status === 'purchase_cost_submitted') {
        statusBadge = `<span class="badge" style="background:#fff3e0;color:#e65100;border:2px solid #f57c00;font-weight:bold;">${t('status_cart_proof_submitted')}</span>`;
      } else if (req.status === 'purchase_funded') {
        statusBadge = `<span class="badge" style="background:#e8f5e9;color:#1b5e20;border:2px solid #2e7d32;font-weight:bold;">${t('status_purchase_funded')}</span>`;
      } else if (req.status === 'awaiting_verification') {
        statusBadge = `<span class="badge" style="background:#f3e5f5;color:#4a148c;border:2px solid #7b1fa2;font-weight:bold;">${t('status_awaiting_verification')}</span>`;
      } else if (req.status === 'completed') {
        statusBadge = `<span class="badge badge-completed">${t('status_service_completed')}</span>`;
      }

      let urgencyBadge = '';
      if (req.urgency === 'high') {
        urgencyBadge = `<span class="badge badge-urgency-high">${t('badge_high_priority')}</span>`;
      } else if (req.urgency === 'emergency') {
        urgencyBadge = `<span class="badge badge-urgency-emergency">${t('badge_sos_emergency')}</span>`;
      }

      let audioPlayerHtml = '';
      if (req.audioFile) {
        audioPlayerHtml = `
          <div class="request-audio-player">
            <label>${t('sd_voice_recording_label')}</label>
            <audio controls src="${req.audioFile}"></audio>
          </div>`;
      }

      let assignmentInfo = '';
      if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
        assignmentInfo = `
          <div class="request-details" style="background:#ffebee; border-color:#c62828;">
            <p style="color:#c62828; font-weight:bold;">${t('status_rejected_by_caregiver')}</p>
            <p style="margin-top:4px; color:#b71c1c;"><strong>${t('sd_reason_label')}</strong> "${escapeHTML(req.familyRejectionReason || 'Caregiver marked this request as invalid.')}"</p>
          </div>`;
      } else if (req.status === 'cancelled') {
        assignmentInfo = `
          <div class="request-details" style="background:#ffebee; border-color:#c62828;">
            <p style="color:#c62828; font-weight:bold;">❌ Cancelled</p>
            <p style="margin-top:4px; color:#b71c1c;">You cancelled this request.</p>
          </div>`;
      } else if (req.status === 'fulfilled_by_family' || req.fulfilledByFamily) {
        assignmentInfo = `
          <div class="request-details" style="background:#e8f5e9; border-color:#2e7d32;">
            <p style="color:#1b5e20; font-weight:bold;">${t('sd_completed_directly_caregiver')}</p>
            <p style="margin-top:4px; color:#2e7d32;">${t('sd_completed_directly_caregiver_desc')}</p>
          </div>`;
      } else if ((req.status === 'awaiting_approval' || req.status === 'quoted') && (req.volunteer || (req.volunteerQuotes && req.volunteerQuotes.length > 0))) {
        const volName = req.volunteer ? req.volunteer.name : (req.volunteerQuotes && req.volunteerQuotes[0] && req.volunteerQuotes[0].volunteer ? req.volunteerQuotes[0].volunteer.name : 'A Volunteer');
        assignmentInfo = `
          <div class="request-details" style="background:#fff8e1; border-color:#f57f17;">
            <p><strong>${t('sd_volunteer_candidate')}</strong> ${escapeHTML(volName)}</p>
            <p style="margin-top:6px; color:#e65100;">${t('sd_caregiver_reviewing_quotes')}</p>
          </div>`;
      } else if (['accepted', 'purchase_cost_submitted', 'purchase_funded', 'awaiting_verification'].includes(req.status) && req.volunteer) {
        const volObj = typeof req.volunteer === 'object' ? req.volunteer : null;
        const volName = volObj ? volObj.name : 'Assigned Volunteer';
        const volPhone = volObj ? volObj.phone : '';
        const volEmail = volObj ? volObj.email : '';

        assignmentInfo = `
          <div class="request-details" style="background:#f1f8e9; border-color:#558b2f;">
            <p><strong>${t('sd_approved_volunteer')}</strong> ${escapeHTML(volName)}</p>
            ${volPhone ? `<p><strong>${t('sd_volunteer_contact')}</strong> <a href="tel:${escapeHTML(volPhone)}" style="color: var(--color-primary-dark); font-weight: bold;">${escapeHTML(volPhone)}</a></p>` : ''}
            ${volEmail ? `<p><strong>${t('sd_volunteer_email')}</strong> ${escapeHTML(volEmail)}</p>` : ''}
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

        const totalSpentBadge = `
          <div style="margin-top: 10px; padding: 8px 14px; background: #e8f5e9; border-left: 4px solid #2e7d32; border-radius: 8px; font-size: 0.95rem; color: #1b5e20; font-weight: bold;">
            ${t('sd_total_spent')} ₹${totalSpent} ${totalSpent === 0 ? `<span style="font-weight: normal; color: #2e7d32;">${t('sd_free_service')}</span>` : ''}
          </div>`;

        assignmentInfo = `
          <div class="request-details">
            <p><strong>${t('sd_assisted_by')}</strong> ${escapeHTML(volName)}</p>
            <p><strong>${t('sd_completion_notes')}</strong> ${escapeHTML(req.resolutionNotes || t('sd_no_notes_provided'))}</p>
            ${totalSpentBadge}
          </div>`;
      }

      const nonCancellable = ['purchase_cost_submitted', 'purchase_funded', 'awaiting_verification', 'delivery_completed', 'completed', 'rejected', 'fulfilled_by_family', 'cancelled'];
      const canDelete = !nonCancellable.includes(req.status);
      const deleteButton = canDelete 
        ? `<button class="btn btn-outline-danger" onclick="cancelHelpRequest('${req._id}')" style="padding: 10px 18px; font-size: 1rem; min-height: 44px;">${t('btn_cancel_request')}</button>` 
        : '';

      const cardUrgencyClass = req.urgency === 'high' ? 'urgency-high' : req.urgency === 'emergency' ? 'urgency-emergency' : '';

      const categoryMap = {
        'Grocery Shopping': 'skill_grocery',
        'Medical Escort': 'skill_medical',
        'Tech Support': 'skill_tech',
        'Housekeeping': 'skill_housekeeping',
        'Companionship': 'skill_companionship',
        'Other': 'skill_other'
      };
      const categoryKey = categoryMap[req.category] || 'skill_other';
      const categoryTranslated = t(categoryKey);

      let prefVal = req.shoppingPreference || '';
      if (prefVal === 'No Preference') prefVal = t('sd_pref_no_preference');
      else if (prefVal === 'Store Brand Only') prefVal = t('sd_pref_store_brand');

      return `
        <div class="request-card ${cardUrgencyClass}">
          <div class="request-card-header">
            <div class="request-title">${escapeHTML(req.title)}</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${statusBadge}
              ${urgencyBadge}
              <span class="badge badge-urgency">${escapeHTML(categoryTranslated)}</span>
            </div>
          </div>
          ${req.description ? `<div class="request-description">${escapeHTML(req.description)}</div>` : ''}
          ${req.shoppingPreference ? `
            <div style="margin-top: 6px; margin-bottom: 10px; padding: 8px 12px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 8px; font-size: 0.95rem; color: #0d47a1; font-weight: 600;">
              ${t('sd_pref_label')}${escapeHTML(prefVal)}
            </div>` : ''}
          ${audioPlayerHtml}
          ${assignmentInfo}
          <div class="request-card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <span style="font-size: 0.9rem; color: #666;">${t('sd_requested_on_label')}${new Date(req.createdAt).toLocaleDateString()}</span>
            ${deleteButton}
          </div>
        </div>`;
    }).join('');
  } else {
    requestList.innerHTML = `<div class="alert alert-danger">Error loading requests: ${res.data.message || 'Server error'}</div>`;
  }
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
      closeVoiceModal();
      showTabPopup(
        t('popup_cancelled_title'),
        t('popup_voice_assistant_cancelled_msg'),
        '❌',
        '#c62828'
      );
    });
  }

  if (btnVoiceConfirmYes) {
    btnVoiceConfirmYes.addEventListener('click', () => {
      confirmVoiceRequest(true);
    });
  }

  if (btnVoiceConfirmNo) {
    btnVoiceConfirmNo.addEventListener('click', () => {
      confirmVoiceRequest(false);
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === voiceModal) {
      closeVoiceModal();
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

async function openVoiceModal() {
  const voiceModal = document.getElementById('voiceModal');
  if (voiceModal) voiceModal.style.display = 'flex';

  isVoiceModalOpen = true;
  resetVoiceModalState();
  
  // Sync voiceLangSelect with currently selected app language
  const appLang = getLang();
  const voiceLangSelect = document.getElementById('voiceLangSelect');
  if (voiceLangSelect) {
    if (appLang === 'hi') {
      voiceLangSelect.value = 'hi-IN';
    } else if (appLang === 'mr') {
      voiceLangSelect.value = 'mr-IN';
    } else {
      voiceLangSelect.value = 'en-IN';
    }
  }

  const selectedLang = voiceLangSelect?.value || 'en-IN';

  const promptText = 
    selectedLang === 'hi-IN' ? "कृपया अपना अनुरोध बोलें, हम सुन रहे हैं।" : 
    selectedLang === 'mr-IN' ? "कृपया आपली विनंती बोला, आम्ही ऐकत आहोत।" : 
    "Please speak out your request, we are listening.";
  
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
  const selectedLang = document.getElementById('voiceLangSelect')?.value || 'en-IN';
  
  const transcriptBox = document.getElementById('voiceTranscriptBox');
  if (transcriptBox) {
    transcriptBox.innerHTML = selectedLang === 'hi-IN' ? '<em style="color: #666;">आवाज संदेश रिकॉर्ड किया गया है</em>' :
                               selectedLang === 'mr-IN' ? '<em style="color: #666;">आवाज संदेश रेकॉर्ड केला आहे</em>' :
                               '<em style="color: #666;">Voice message has been recorded</em>';
  }

  // Go directly to confirmation
  const readbackPhrase = 
    selectedLang === 'hi-IN' ? `मैंने आपका अनुरोध रिकॉर्ड किया। क्या मुझे यह अनुरोध भेजना चाहिए?` :
    selectedLang === 'mr-IN' ? `मी तुमची विनंती रेकॉर्ड केली. मी ही विनंती पाठवू का?` :
    `I recorded your request. Should I send this request?`;

  const readoutText = document.getElementById('voiceReadoutText');
  if (readoutText) {
    readoutText.textContent = 
      selectedLang === 'hi-IN' ? `🔊 "क्या मुझे यह अनुरोध भेजना चाहिए?"` :
      selectedLang === 'mr-IN' ? `🔊 "मी ही विनंती पाठवू का?"` :
      `🔊 "Should I send this request?"`;
  }

  const confirmArea = document.getElementById('voiceConfirmationArea');
  if (confirmArea) confirmArea.style.display = 'block';

  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  if (stepStatus) stepStatus.textContent = selectedLang === 'hi-IN' ? '🔊 आपका अनुरोध पुष्टि के लिए पूछा जा रहा है...' : selectedLang === 'mr-IN' ? '🔊 तुमची विनंती पुष्टीकरणासाठी विचारत आहे...' : '🔊 Asking confirmation...';
  if (subStatus) subStatus.textContent = selectedLang === 'hi-IN' ? 'कृपया पुष्टि करने के लिए ध्यान से सुनें।' : selectedLang === 'mr-IN' ? 'कृपया पुष्टी करण्यासाठी काळजीपूर्वक ऐका.' : 'Please listen carefully to confirm.';

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
  
  const listenMsg = getLang() === 'hi' ? 'आपकी आवाज़ सुनी जा रही है...' : getLang() === 'mr' ? 'तुमचा आवाज ऐकला जात आहे...' : 'Listening to your voice...';
  if (transcriptBox) transcriptBox.innerHTML = `<em style="color: #999;">${listenMsg}</em>`;
  if (confirmArea) confirmArea.style.display = 'none';
  if (confidenceBadge) confidenceBadge.style.display = 'none';
  if (pulse) {
    pulse.style.background = 'linear-gradient(135deg, #1976d2, #0288d1)';
    pulse.textContent = '🎙️';
  }
}

async function startRecordingAndSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const selectedLang = document.getElementById('voiceLangSelect')?.value || 'en-IN';

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
      '🎙️',
      '#e65100'
    );
    closeVoiceModal();
  }
}


function stopSpeechAndAudioRecording() {
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
  const selectedLang = document.getElementById('voiceLangSelect')?.value || 'en-IN';

  if (!currentTranscript || currentTranscript.trim().length === 0) {
    currentTranscript = selectedLang === 'hi-IN' ? 'आवाज द्वारा दर्ज सहायता अनुरोध' : selectedLang === 'mr-IN' ? 'आवाज द्वारे नोंदवलेली मदत विनंती' : 'Help request recorded via voice';
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
  
  if (stepStatus) stepStatus.textContent = selectedLang === 'hi-IN' ? '🔊 आपका अनुरोध पढ़कर सुनाया जा रहा है...' : selectedLang === 'mr-IN' ? '🔊 तुमची विनंती वाचून दाखवत आहे...' : '🔊 Reading your request back...';
  if (subStatus) subStatus.textContent = selectedLang === 'hi-IN' ? 'कृपया पुष्टि करने के लिए ध्यान से सुनें।' : selectedLang === 'mr-IN' ? 'कृपया पुष्टी करण्यासाठी काळजीपूर्वक ऐका.' : 'Please listen carefully to confirm.';
  if (pulse) {
    pulse.style.background = 'linear-gradient(135deg, #43a047, #2e7d32)';
    pulse.textContent = '🔊';
  }

  // TTS Readback
  const readbackPhrase = 
    selectedLang === 'hi-IN' ? `मैंने आपका अनुरोध रिकॉर्ड किया: ${cleanTranscript}। क्या मुझे यह अनुरोध भेजना चाहिए?` :
    selectedLang === 'mr-IN' ? `मी तुमची विनंती रेकॉर्ड केली: ${cleanTranscript}। मी ही विनंती पाठवू का?` :
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
  const selectedLang = document.getElementById('voiceLangSelect')?.value || 'en-IN';

  if (stepStatus) stepStatus.textContent = selectedLang === 'hi-IN' ? '🎙️ "हाँ" या "नहीं" बोलें...' : selectedLang === 'mr-IN' ? '🎙️ "हो" किंवा "नाही" बोला...' : '🎙️ Listening for "Yes" or "No"...';
  if (subStatus) subStatus.textContent = selectedLang === 'hi-IN' ? 'भेजने के लिए "हाँ" या रद्द करने के लिए "नहीं" कहें।' : selectedLang === 'mr-IN' ? 'पाठवण्यासाठी "हो" किंवा रद्द करण्यासाठी "नाही" म्हणा.' : 'Say "Yes" to send or "No" to discard.';
  if (pulse) {
    pulse.style.background = 'linear-gradient(135deg, #e65100, #f57f17)';
    pulse.textContent = '👂';
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
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  stopSpeechAndAudioRecording();
  const selectedLang = document.getElementById('voiceLangSelect')?.value || 'en-IN';

  if (!shouldSend) {
    const cancelMsg = selectedLang === 'hi-IN' ? 'आपका आवाज अनुरोध रद्द कर दिया गया है।' : selectedLang === 'mr-IN' ? 'तुमची आवाज विनंती रद्द करण्यात आली आहे.' : 'Your voice request has been cancelled and discarded.';
    closeVoiceModal(true);
    const rejectTitle = selectedLang === 'hi-IN' ? 'अनुरोध अस्वीकृत / रद्द' : selectedLang === 'mr-IN' ? 'विनंती नाकारली / रद्द' : 'Request Rejected / Discarded';
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
  if (stepStatus) stepStatus.textContent = selectedLang === 'hi-IN' ? '⏳ अनुरोध भेजा जा रहा है...' : selectedLang === 'mr-IN' ? '⏳ विनंती पाठवली जात आहे...' : '⏳ Submitting request...';
  if (subStatus) subStatus.textContent = selectedLang === 'hi-IN' ? 'कृपया एक क्षण प्रतीक्षा करें।' : selectedLang === 'mr-IN' ? 'कृपया क्षणभर थांबा.' : 'Please wait a moment.';

  const sendMsg = selectedLang === 'hi-IN' ? 'आपका अनुरोध भेजा जा रहा है।' : selectedLang === 'mr-IN' ? 'तुमची विनंती आता पाठवत आहे.' : 'Sending your request now.';
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
      const successVoice = selectedLang === 'hi-IN' ? 'आपका अनुरोध सफलतापूर्वक जमा कर दिया गया है।' : selectedLang === 'mr-IN' ? 'तुमची विनंती यशस्वीरित्या सबमिट केली आहे.' : 'Your request has been submitted successfully.';
      speakUtteranceWithLocale(successVoice, selectedLang);
      loadRequests();
    } else {
      showTabPopup(
        t('popup_failed_title'),
        res.data?.message || t('popup_failed_msg'),
        '❌',
        '#c62828'
      );
      const failVoice = selectedLang === 'hi-IN' ? 'आपका अनुरोध सबमिट करने में विफल रहा।' : selectedLang === 'mr-IN' ? 'तुमची विनंती सबमिट करण्यात अयशस्वी झाली.' : 'Your request submission failed.';
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
      const lowConfVoice = selectedLang === 'hi-IN' ? 'कम आत्मविश्वास के कारण, आपके देखभालकर्ता को सत्यापित करने के लिए सूचित किया गया है।' : selectedLang === 'mr-IN' ? 'कमी विश्वासार्हतेमुळे, तुमच्या काळजीवाहूला पडताळणीसाठी सूचित केले आहे.' : 'Because AI confidence was low, your caregiver has been notified to verify your request.';
      speakUtteranceWithLocale(lowConfVoice, selectedLang);
    } else {
      showTabPopup(
        t('popup_voice_confirmed_title'),
        t('popup_voice_confirmed_msg'),
        '✅',
        '#2e7d32'
      );
      const successVoice = selectedLang === 'hi-IN' ? 'आपका अनुरोध सफलतापूर्वक जमा कर दिया गया है।' : selectedLang === 'mr-IN' ? 'तुमची विनंती यशस्वीरित्या सबमिट केली आहे.' : 'Your request has been submitted successfully.';
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
    const failVoice = selectedLang === 'hi-IN' ? 'आपका अनुरोध सबमिट करने में विफल रहा।' : selectedLang === 'mr-IN' ? 'तुमची विनंती सबमिट करण्यात अयशस्वी झाली.' : 'Your request submission failed.';
    speakUtteranceWithLocale(failVoice, selectedLang);
  }
}

function showTabPopup(title, message, icon = '🎉', borderColor = '#2e7d32') {
  const modal = document.getElementById('tabPopupModal');
  const titleEl = document.getElementById('tabPopupTitle');
  const msgEl = document.getElementById('tabPopupMessage');
  const iconEl = document.getElementById('tabPopupIcon');
  const closeBtn = document.getElementById('btnTabPopupClose');
  const modalContent = modal ? modal.querySelector('.modal-content') : null;

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.style.color = borderColor;
  if (modalContent) modalContent.style.borderColor = borderColor;

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
  const yesBtn = document.getElementById('btnTabConfirmYes');
  const noBtn = document.getElementById('btnTabConfirmNo');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;

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
      showTabPopup(t('popup_aborted_title'), t('popup_aborted_msg'), 'ℹ️', '#1565c0');
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
