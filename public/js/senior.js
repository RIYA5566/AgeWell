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

  // --- Voice-to-Text Input logic ---
  const btnVoice = document.getElementById('btnVoice');
  const waveform = document.getElementById('voiceWaveform');
  const descriptionInput = document.getElementById('requestDescription');

  if (btnVoice) {
    let recognition = null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        btnVoice.classList.add('recording');
        waveform.classList.add('active');
        descriptionInput.placeholder = "Listening to your voice... Speak now!";
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        stopVoiceRecording();
      };

      recognition.onend = () => {
        stopVoiceRecording();
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (descriptionInput.value) {
          descriptionInput.value += ' ' + transcript;
        } else {
          descriptionInput.value = transcript;
        }
      };
    }

    btnVoice.addEventListener('click', () => {
      if (btnVoice.classList.contains('recording')) {
        if (recognition) {
          recognition.stop();
        } else {
          stopVoiceSimulation();
        }
      } else {
        if (recognition) {
          try {
            recognition.start();
          } catch (e) {
            console.error(e);
            startVoiceSimulation();
          }
        } else {
          startVoiceSimulation();
        }
      }
    });

    function stopVoiceRecording() {
      btnVoice.classList.remove('recording');
      waveform.classList.remove('active');
      descriptionInput.placeholder = "Describe what you need help with (you can also use the voice button)...";
    }

    let simulationTimeout = null;
    function startVoiceSimulation() {
      btnVoice.classList.add('recording');
      waveform.classList.add('active');
      descriptionInput.placeholder = "Simulating voice input (Speak now)...";
      
      const simulatedPhrases = [
        "I need help getting fresh milk, eggs, and bread from the grocery store today.",
        "Could someone please help me set up my new TV remote? I am having trouble with the buttons.",
        "I have a doctor appointment tomorrow at 10 AM at the clinic and need a medical escort to walk with me.",
        "My living room lightbulb burned out. I would be very grateful if someone could help me replace it."
      ];

      simulationTimeout = setTimeout(() => {
        const randomPhrase = simulatedPhrases[Math.floor(Math.random() * simulatedPhrases.length)];
        descriptionInput.value = randomPhrase;
        stopVoiceSimulation();
      }, 3000);
    }

    function stopVoiceSimulation() {
      if (simulationTimeout) clearTimeout(simulationTimeout);
      btnVoice.classList.remove('recording');
      waveform.classList.remove('active');
      descriptionInput.placeholder = "Describe what you need help with (you can also use the voice button)...";
    }
  }

  // --- Help Request Form Submit ---
  const requestForm = document.getElementById('requestForm');
  if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('requestTitle').value.trim();
      const description = descriptionInput.value.trim();
      const urgency = document.getElementById('requestUrgency').value;

      const alertArea = document.getElementById('modalAlertArea');
      alertArea.innerHTML = '';

      if (!selectedCategory) {
        alertArea.innerHTML = `<div class="alert alert-danger">Please choose a category from the buttons above</div>`;
        return;
      }

      if (!title || !description) {
        alertArea.innerHTML = `<div class="alert alert-danger">Please fill in the title and description</div>`;
        return;
      }

      const res = await apiCall('/requests', 'POST', {
        title,
        description,
        category: selectedCategory,
        urgency
      });

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
          <div class="request-description">${escapeHTML(req.description)}</div>
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
