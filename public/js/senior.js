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
    welcomeTitle.textContent = `Welcome back, ${user.name}! 👋`;
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
        title: 'EMERGENCY ALARM ACTIVE',
        description: 'SOS triggered by Senior Citizen via dashboard. Instant assistance required.',
        category: 'Medical Escort',
        urgency: 'emergency'
      };

      // Show overlay and start audio alert immediately for responsiveness
      sosOverlay.style.display = 'flex';
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
      stopEmergencyAlarm();
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
  if (btnCancelRequest) btnCancelRequest.addEventListener('click', closeModal);

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
        alert('Microphone access was denied or is not supported in this browser. Please check browser permissions.');
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

      if (recordedAudioBlob) {
        formData.append('audio', recordedAudioBlob, 'voice-recording.webm');
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

    requestList.innerHTML = requests.map(req => {
      let statusBadge = '';
      if (req.status === 'fulfilled_by_family' || req.familyApprovalStatus === 'fulfilled_by_family' || req.fulfilledByFamily) {
        statusBadge = `<span class="badge" style="background:#e8f5e9;color:#1b5e20;border:2px solid #2e7d32;font-weight:bold;">🏡 Fulfilled by Family Caregiver</span>`;
      } else if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
        statusBadge = `<span class="badge" style="background:#ffebee;color:#c62828;border:2px solid #b71c1c;font-weight:bold;">❌ Request Rejected by Caregiver</span>`;
      } else if (req.status === 'pending' && req.familyApprovalStatus === 'none') {
        statusBadge = `<span class="badge" style="background:#fff8e1;color:#e65100;border:2px solid #ffa000;font-weight:bold;">⏳ Awaiting Caregiver Allotment</span>`;
      } else if (req.status === 'pending' && req.familyApprovalStatus === 'approved') {
        statusBadge = `<span class="badge badge-pending">🔍 Allotted to Volunteers (Seeking Help)</span>`;
      } else if (req.status === 'awaiting_approval') {
        statusBadge = `<span class="badge" style="background:#ffe082;color:#e65100;font-weight:bold;">⏳ Caregiver Reviewing Volunteer Quotes</span>`;
      } else if (req.status === 'accepted') {
        statusBadge = `<span class="badge badge-accepted">🤝 Volunteer Assigned</span>`;
      } else if (req.status === 'completed') {
        statusBadge = `<span class="badge badge-completed">✅ Service Completed</span>`;
      }

      let urgencyBadge = '';
      if (req.urgency === 'high') {
        urgencyBadge = `<span class="badge badge-urgency-high">High Priority</span>`;
      } else if (req.urgency === 'emergency') {
        urgencyBadge = `<span class="badge badge-urgency-emergency">SOS EMERGENCY</span>`;
      }

      let audioPlayerHtml = '';
      if (req.audioFile) {
        audioPlayerHtml = `
          <div class="request-audio-player">
            <label>🎙️ Voice Recording:</label>
            <audio controls src="${req.audioFile}"></audio>
          </div>`;
      }

      let assignmentInfo = '';
      if (req.status === 'rejected' || req.familyApprovalStatus === 'rejected') {
        assignmentInfo = `
          <div class="request-details" style="background:#ffebee; border-color:#c62828;">
            <p style="color:#c62828; font-weight:bold;">❌ Request Rejected by Family Caregiver</p>
            <p style="margin-top:4px; color:#b71c1c;"><strong>Reason:</strong> "${escapeHTML(req.familyRejectionReason || 'Caregiver marked this request as invalid.')}"</p>
          </div>`;
      } else if (req.status === 'fulfilled_by_family' || req.fulfilledByFamily) {
        assignmentInfo = `
          <div class="request-details" style="background:#e8f5e9; border-color:#2e7d32;">
            <p style="color:#1b5e20; font-weight:bold;">🏡 Completed Directly by Family Caregiver</p>
            <p style="margin-top:4px; color:#2e7d32;">Your family caregiver took care of this request for you!</p>
          </div>`;
      } else if (req.status === 'awaiting_approval' && req.volunteer) {
        assignmentInfo = `
          <div class="request-details" style="background:#fff8e1; border-color:#f57f17;">
            <p><strong>Volunteer Candidate:</strong> ${escapeHTML(req.volunteer.name)}</p>
            <p style="margin-top:6px; color:#e65100;">🔐 Your family caregiver is reviewing volunteer quotes. Contact details will appear once they approve.</p>
          </div>`;
      } else if (req.status === 'accepted' && req.volunteer) {
        assignmentInfo = `
          <div class="request-details">
            <p><strong>Approved Volunteer:</strong> ${escapeHTML(req.volunteer.name)}</p>
            <p><strong>Volunteer Contact:</strong> <a href="tel:${req.volunteer.phone}" style="color: var(--color-primary-dark); font-weight: bold;">${escapeHTML(req.volunteer.phone)}</a></p>
            <p><strong>Volunteer Email:</strong> ${escapeHTML(req.volunteer.email)}</p>
          </div>`;
      } else if (req.status === 'completed') {
        assignmentInfo = `
          <div class="request-details">
            <p><strong>Assisted By:</strong> ${req.volunteer ? req.volunteer.name : 'Platform Volunteer'}</p>
            <p><strong>Completion Notes:</strong> ${req.resolutionNotes || 'No notes provided'}</p>
          </div>`;
      }

      const canDelete = req.status === 'pending';
      const deleteButton = canDelete 
        ? `<button class="btn btn-outline-danger" onclick="cancelHelpRequest('${req._id}')" style="padding: 10px 18px; font-size: 1rem; min-height: 44px;">❌ Cancel Request</button>` 
        : '';

      const cardUrgencyClass = req.urgency === 'high' ? 'urgency-high' : req.urgency === 'emergency' ? 'urgency-emergency' : '';

      return `
        <div class="request-card ${cardUrgencyClass}">
          <div class="request-card-header">
            <div class="request-title">${escapeHTML(req.title)}</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${statusBadge}
              ${urgencyBadge}
              <span class="badge badge-urgency">${escapeHTML(req.category)}</span>
            </div>
          </div>
          ${req.description ? `<div class="request-description">${escapeHTML(req.description)}</div>` : ''}
          ${audioPlayerHtml}
          ${assignmentInfo}
          <div class="request-card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <span style="font-size: 0.9rem; color: #666;">Requested on: ${new Date(req.createdAt).toLocaleDateString()}</span>
            ${deleteButton}
          </div>
        </div>`;
    }).join('');
  } else {
    requestList.innerHTML = `<div class="alert alert-danger">Error loading requests: ${res.data.message || 'Server error'}</div>`;
  }
}

// Cancel a pending request
async function cancelHelpRequest(id) {
  if (confirm("Are you sure you want to cancel this request?")) {
    const res = await apiCall(`/requests/${id}`, 'DELETE');
    if (res.ok) {
      loadRequests();
    } else {
      alert(res.data.message || "Failed to cancel request");
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

async function openVoiceModal() {
  const voiceModal = document.getElementById('voiceModal');
  if (voiceModal) voiceModal.style.display = 'flex';

  resetVoiceModalState();
  startRecordingAndSpeechRecognition();
}

function closeVoiceModal() {
  const voiceModal = document.getElementById('voiceModal');
  if (voiceModal) voiceModal.style.display = 'none';

  stopSpeechAndAudioRecording();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
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

  if (stepStatus) stepStatus.textContent = 'Speak your request now...';
  if (subStatus) subStatus.textContent = 'Listening to what you need help with.';
  if (transcriptBox) transcriptBox.innerHTML = '<em style="color: #999;">Listening to your voice...</em>';
  if (confirmArea) confirmArea.style.display = 'none';
  if (confidenceBadge) confidenceBadge.style.display = 'none';
  if (pulse) {
    pulse.style.background = 'linear-gradient(135deg, #1976d2, #0288d1)';
    pulse.textContent = '🎙️';
  }
}

async function startRecordingAndSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

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
      voiceRecognition.lang = 'en-US';

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
    alert('Microphone access is required for voice request confirmation.');
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

  if (!currentTranscript || currentTranscript.trim().length === 0) {
    currentTranscript = 'Help request recorded via voice';
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
  if (stepStatus) stepStatus.textContent = '🔊 Reading your request back...';
  if (subStatus) subStatus.textContent = 'Please listen carefully to confirm.';
  if (pulse) {
    pulse.style.background = 'linear-gradient(135deg, #43a047, #2e7d32)';
    pulse.textContent = '🔊';
  }

  // TTS Readback
  const readbackPhrase = `I recorded your request: ${cleanTranscript}. Should I send this request?`;

  const confirmArea = document.getElementById('voiceConfirmationArea');
  if (confirmArea) confirmArea.style.display = 'block';

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(readbackPhrase);
    utterance.rate = 0.95;

    utterance.onend = () => {
      listenForVoiceConfirmation();
    };

    utterance.onerror = () => {
      listenForVoiceConfirmation();
    };

    window.speechSynthesis.speak(utterance);
  } else {
    listenForVoiceConfirmation();
  }
}

function listenForVoiceConfirmation() {
  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  const pulse = document.getElementById('voiceMicPulse');

  if (stepStatus) stepStatus.textContent = '🎙️ Listening for "Yes" or "No"...';
  if (subStatus) subStatus.textContent = 'Say "Yes" to send or "No" to discard.';
  if (pulse) {
    pulse.style.background = 'linear-gradient(135deg, #e65100, #f57f17)';
    pulse.textContent = '👂';
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    confirmRecognition = new SpeechRecognition();
    confirmRecognition.continuous = true;
    confirmRecognition.interimResults = false;
    confirmRecognition.lang = 'en-US';

    confirmRecognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const word = event.results[i][0].transcript.trim().toLowerCase();
          console.log('Voice confirmation input:', word);

          if (word.includes('yes') || word.includes('yeah') || word.includes('sure') || word.includes('send') || word.includes('correct') || word.includes('yep') || word.includes('do it') || word.includes('ok')) {
            confirmVoiceRequest(true);
            return;
          }
          if (word.includes('no') || word.includes('cancel') || word.includes('delete') || word.includes('stop') || word.includes('don\'t') || word.includes('nah') || word.includes('discard') || word.includes('nope')) {
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

  if (!shouldSend) {
    if (window.speechSynthesis) {
      const cancelUtterance = new SpeechSynthesisUtterance('Request cancelled and discarded.');
      window.speechSynthesis.speak(cancelUtterance);
    }
    closeVoiceModal();
    return;
  }

  const stepStatus = document.getElementById('voiceStepStatus');
  const subStatus = document.getElementById('voiceSubStatus');
  if (stepStatus) stepStatus.textContent = '⏳ Submitting request...';
  if (subStatus) subStatus.textContent = 'Please wait a moment.';

  if (window.speechSynthesis) {
    const confirmUtterance = new SpeechSynthesisUtterance('Sending your request now.');
    window.speechSynthesis.speak(confirmUtterance);
  }

  const cleanTranscript = currentTranscript.trim();
  let isLowConfidence = false;
  if (cleanTranscript.length < 15 || currentConfidence < 70) {
    isLowConfidence = true;
  }

  let category = 'Other';
  const lower = cleanTranscript.toLowerCase();
  if (lower.includes('grocery') || lower.includes('buy') || lower.includes('food') || lower.includes('store') || lower.includes('milk') || lower.includes('bread')) {
    category = 'Grocery Shopping';
  } else if (lower.includes('doctor') || lower.includes('hospital') || lower.includes('clinic') || lower.includes('medicine') || lower.includes('pharmacy')) {
    category = 'Medical Escort';
  } else if (lower.includes('phone') || lower.includes('computer') || lower.includes('tech') || lower.includes('tv') || lower.includes('wifi')) {
    category = 'Tech Support';
  } else if (lower.includes('clean') || lower.includes('house') || lower.includes('laundry') || lower.includes('sweep') || lower.includes('trash')) {
    category = 'Housekeeping';
  } else if (lower.includes('talk') || lower.includes('chat') || lower.includes('walk') || lower.includes('companion') || lower.includes('lonely')) {
    category = 'Companionship';
  }

  const formData = new FormData();
  formData.append('title', cleanTranscript.slice(0, 60));
  formData.append('description', cleanTranscript);
  formData.append('transcript', cleanTranscript);
  formData.append('category', category);
  formData.append('urgency', lower.includes('urgent') || lower.includes('emergency') || lower.includes('today') ? 'high' : 'low');
  formData.append('aiConfidenceScore', currentConfidence);
  formData.append('aiLowConfidence', isLowConfidence);

  if (voiceAudioBlob) {
    formData.append('audio', voiceAudioBlob, 'voice-request.webm');
  }

  const res = await apiCall('/requests', 'POST', formData);

  closeVoiceModal();

  if (res.ok && res.data.success) {
    if (res.data.isLowConfidence) {
      alert('✅ Voice request created! Because AI speech confidence was low, your family caregiver has been notified to verify it.');
    } else {
      alert('✅ Help request created successfully!');
    }
    loadRequests();
  } else {
    alert(`❌ Failed to submit request: ${res.data?.message || 'Server error'}`);
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

  // Read aloud automated voice call message via SpeechSynthesis
  const callText = `Hello! Your volunteer has completed your request for ${itemLabel}. Please confirm if you received your items. Press 1 or say Yes if you received the items. Press 2 or say No if you did not.`;
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const callUtterance = new SpeechSynthesisUtterance(callText);
    callUtterance.rate = 0.95;
    window.speechSynthesis.speak(callUtterance);
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

  try {
    if (ivrSpeechRecognition) {
      try { ivrSpeechRecognition.stop(); } catch (e) {}
    }

    ivrSpeechRecognition = new SpeechRecognition();
    ivrSpeechRecognition.continuous = false;
    ivrSpeechRecognition.interimResults = false;
    ivrSpeechRecognition.lang = 'en-US';

    ivrSpeechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log('IVR Spoken Response Detected:', transcript);

      if (transcript.includes('yes') || transcript.includes('one') || transcript === '1' || transcript.includes('receive')) {
        submitSeniorVoiceIVRResponse(requestId, 1);
      } else if (transcript.includes('no') || transcript.includes('two') || transcript === '2' || transcript.includes('not')) {
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
  const feedbackMsg = isYes ? "Thank you! Your delivery confirmation has been verified." : "We have recorded your report. Support will follow up with your volunteer.";

  if (window.speechSynthesis) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(feedbackMsg));
  }

  const modal = document.getElementById('ivrCallModal');
  if (modal) modal.style.display = 'none';

  const res = await apiCall(`/requests/${requestId}/verify-completion-voice`, 'PUT', { selection });

  if (res.ok && res.data.success) {
    alert(isYes ? '✅ Delivery confirmed! Thank you.' : '⚠️ Issue reported: Item not received.');
    loadRequests();
  } else {
    alert(res.data?.message || 'Error submitting response');
  }
}
