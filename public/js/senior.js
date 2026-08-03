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
      if (req.status === 'pending') {
        statusBadge = `<span class="badge badge-pending">🔍 Finding Volunteer</span>`;
      } else if (req.status === 'awaiting_approval') {
        statusBadge = `<span class="badge" style="background:#ffe082;color:#e65100;">⏳ Awaiting Family Approval</span>`;
      } else if (req.status === 'accepted') {
        statusBadge = `<span class="badge badge-accepted">🤝 Volunteer Approved &amp; Assigned</span>`;
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
      if (req.status === 'awaiting_approval' && req.volunteer) {
        assignmentInfo = `
          <div class="request-details" style="background:#fff8e1; border-color:#f57f17;">
            <p><strong>Volunteer Candidate:</strong> ${escapeHTML(req.volunteer.name)}</p>
            <p style="margin-top:6px; color:#e65100;">🔐 Your family caregiver is reviewing this volunteer's profile.
              Contact details will appear once they approve.</p>
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
