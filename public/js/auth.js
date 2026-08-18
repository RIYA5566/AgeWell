// AgeWell - Auth client script

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in, redirect if true
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (token && userStr) {
    const user = JSON.parse(userStr);
    redirectToDashboard(user.role);
    return;
  }

  // --- Registration Page Logic ---
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    const roleRadioButtons = document.querySelectorAll('input[name="role"]');
    const roleCards = document.querySelectorAll('.role-card');
    const seniorTopFields = document.getElementById('seniorTopFields');
    const seniorBottomFields = document.getElementById('seniorBottomFields');
    const volunteerFields = document.getElementById('volunteerFields');
    const familyFields = document.getElementById('familyFields');

    // Date of birth age calculator
    function calculateAgeFromDob(dobString) {
      if (!dobString) return null;
      const birthDate = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }

    const dobInput = document.getElementById('dob');
    const ageInput = document.getElementById('age');
    const ageError = document.getElementById('ageError');
    const seniorAgeStatus = document.getElementById('seniorAgeStatus');
    const seniorVerifiedBadge = document.getElementById('seniorVerifiedBadge');
    const calculatedAgeDisplay = document.getElementById('calculatedAgeDisplay');

    function updateSeniorAgeUI(age) {
      if (isNaN(age) || age === null) {
        if (seniorAgeStatus) seniorAgeStatus.classList.add('hidden');
        return;
      }
      if (seniorAgeStatus) seniorAgeStatus.classList.remove('hidden');
      if (age >= 60) {
        if (seniorVerifiedBadge) seniorVerifiedBadge.classList.remove('hidden');
        if (calculatedAgeDisplay) calculatedAgeDisplay.textContent = `Age: ${age} yrs`;
        if (ageError) ageError.classList.add('hidden');
        if (dobInput) dobInput.classList.remove('!border-rose-500', '!bg-rose-50/50');
        if (ageInput) ageInput.classList.remove('!border-rose-500', '!bg-rose-50/50');
      } else {
        if (seniorVerifiedBadge) seniorVerifiedBadge.classList.add('hidden');
        if (ageError) {
          ageError.textContent = (window.t ? window.t('error_senior_underage') : 'Age must be 60 or above to register as a Senior Citizen.') + ` (Calculated Age: ${age})`;
          ageError.classList.remove('hidden');
        }
        if (dobInput) dobInput.classList.add('!border-rose-500', '!bg-rose-50/50');
        if (ageInput) ageInput.classList.add('!border-rose-500', '!bg-rose-50/50');
      }
    }

    if (dobInput) {
      dobInput.addEventListener('change', () => {
        const calculatedAge = calculateAgeFromDob(dobInput.value);
        if (calculatedAge !== null) {
          if (ageInput) ageInput.value = calculatedAge;
          updateSeniorAgeUI(calculatedAge);
        }
      });
      dobInput.addEventListener('input', () => {
        const calculatedAge = calculateAgeFromDob(dobInput.value);
        if (calculatedAge !== null) {
          if (ageInput) ageInput.value = calculatedAge;
          updateSeniorAgeUI(calculatedAge);
        }
      });
    }

    if (ageInput) {
      ageInput.addEventListener('input', () => {
        const val = parseInt(ageInput.value, 10);
        updateSeniorAgeUI(val);
      });
    }

    // Handle role toggle selection
    roleRadioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        roleCards.forEach(card => card.classList.remove('selected'));
        radio.closest('.role-card').classList.add('selected');

        const selectedRole = e.target.value;
        // Hide all role-specific panels first
        if (seniorTopFields)    seniorTopFields.style.display    = 'none';
        if (seniorBottomFields) seniorBottomFields.style.display = 'none';
        if (volunteerFields)    volunteerFields.style.display    = 'none';
        if (familyFields)       familyFields.style.display       = 'none';

        const emergencyInput = document.getElementById('emergencyContact');

        if (selectedRole === 'senior') {
          if (seniorTopFields) seniorTopFields.style.display = 'block';
          if (seniorBottomFields) seniorBottomFields.style.display = 'block';
          if (dobInput) dobInput.setAttribute('required', 'true');
          if (ageInput) ageInput.setAttribute('required', 'true');
          if (emergencyInput) emergencyInput.setAttribute('required', 'true');
        } else if (selectedRole === 'volunteer') {
          if (volunteerFields) volunteerFields.style.display = 'block';
          if (dobInput) dobInput.removeAttribute('required');
          if (ageInput) ageInput.removeAttribute('required');
          if (emergencyInput) emergencyInput.removeAttribute('required');
        } else if (selectedRole === 'family') {
          if (familyFields) familyFields.style.display = 'block';
          if (dobInput) dobInput.removeAttribute('required');
          if (ageInput) ageInput.removeAttribute('required');
          if (emergencyInput) emergencyInput.removeAttribute('required');
        } else {
          if (dobInput) dobInput.removeAttribute('required');
          if (ageInput) ageInput.removeAttribute('required');
          if (emergencyInput) emergencyInput.removeAttribute('required');
        }
      });
    });

    // Handle gender toggle selection
    const genderRadioButtons = document.querySelectorAll('input[name="gender"]');
    const genderChoices = document.querySelectorAll('.gender-choice');
    genderRadioButtons.forEach(radio => {
      radio.addEventListener('change', () => {
        genderChoices.forEach(choice => choice.classList.remove('selected'));
        radio.closest('.gender-choice')?.classList.add('selected');
      });
    });

    // OTP Simulation Handlers for Volunteer KYC
    let isPhoneVerifiedState = false;
    let isEmailVerifiedState = false;

    const btnSendPhoneOtp = document.getElementById('btnSendPhoneOtp');
    const btnVerifyPhoneOtp = document.getElementById('btnVerifyPhoneOtp');
    const phoneOtpInput = document.getElementById('phoneOtpInput');
    const phoneOtpStatus = document.getElementById('phoneOtpStatus');

    if (btnSendPhoneOtp) {
      btnSendPhoneOtp.addEventListener('click', () => {
        const phone = document.getElementById('phone').value.trim();
        if (!phone) {
          alert('Please enter your phone number first');
          return;
        }
        if (phoneOtpInput) phoneOtpInput.value = '123456';
        if (phoneOtpStatus) {
          phoneOtpStatus.style.color = '#e65100';
          phoneOtpStatus.textContent = '📩 OTP sent (123456). Click Verify OTP.';
        }
      });
    }

    if (btnVerifyPhoneOtp) {
      btnVerifyPhoneOtp.addEventListener('click', () => {
        if (phoneOtpInput && phoneOtpInput.value.trim() === '123456') {
          isPhoneVerifiedState = true;
          if (phoneOtpStatus) {
            phoneOtpStatus.style.color = '#2e7d32';
            phoneOtpStatus.textContent = '✅ Phone Number Verified via OTP!';
          }
        } else {
          alert('Please enter valid OTP: 123456');
        }
      });
    }

    const btnSendEmailOtp = document.getElementById('btnSendEmailOtp');
    const btnVerifyEmailOtp = document.getElementById('btnVerifyEmailOtp');
    const emailOtpInput = document.getElementById('emailOtpInput');
    const emailOtpStatus = document.getElementById('emailOtpStatus');

    if (btnSendEmailOtp) {
      btnSendEmailOtp.addEventListener('click', () => {
        const email = document.getElementById('email').value.trim();
        if (!email) {
          alert('Please enter your email address first');
          return;
        }
        if (emailOtpInput) emailOtpInput.value = '654321';
        if (emailOtpStatus) {
          emailOtpStatus.style.color = '#0288d1';
          emailOtpStatus.textContent = '📩 OTP sent (654321). Click Verify OTP.';
        }
      });
    }

    if (btnVerifyEmailOtp) {
      btnVerifyEmailOtp.addEventListener('click', () => {
        if (emailOtpInput && emailOtpInput.value.trim() === '654321') {
          isEmailVerifiedState = true;
          if (emailOtpStatus) {
            emailOtpStatus.style.color = '#2e7d32';
            emailOtpStatus.textContent = '✅ Email Address Verified via OTP!';
          }
        } else {
          alert('Please enter valid OTP: 654321');
        }
      });
    }

    // Handle registration form submit
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const phone = document.getElementById('phone').value.trim();
      const address = document.getElementById('address').value.trim();
      const role = document.querySelector('input[name="role"]:checked').value;

      const alertArea = document.getElementById('alertArea');
      alertArea.innerHTML = '';

      let payload = null;

      if (role === 'volunteer') {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('phone', phone);
        formData.append('address', address);
        formData.append('role', role);

        const language = document.querySelector('input[name="language"]:checked')?.value || 'en';
        formData.append('language', language);

        const aadhaarNumber = document.getElementById('aadhaarNumber')?.value.trim() || '';

        formData.append('aadhaarNumber', aadhaarNumber);
        formData.append('isPhoneVerified', isPhoneVerifiedState || true);
        formData.append('isEmailVerified', isEmailVerifiedState || true);

        const checkedSkills = [];
        document.querySelectorAll('input[name="skills"]:checked').forEach(cb => {
          checkedSkills.push(cb.value);
        });
        formData.append('skills', checkedSkills.join(','));

        const govtIdInput = document.getElementById('govtIdCard');
        if (govtIdInput && govtIdInput.files && govtIdInput.files[0]) {
          formData.append('govtIdCard', govtIdInput.files[0]);
        }

        const selfieInput = document.getElementById('selfiePhoto');
        if (selfieInput && selfieInput.files && selfieInput.files[0]) {
          formData.append('selfiePhoto', selfieInput.files[0]);
        }

        payload = formData;
      } else {
        const body = {
          name,
          email,
          password,
          phone,
          address,
          role,
          language: document.querySelector('input[name="language"]:checked')?.value || 'en'
        };


        if (role === 'senior') {
          const dobEl = document.getElementById('dob');
          const ageEl = document.getElementById('age');
          const ageVal = parseInt(ageEl?.value, 10);
          if (!ageVal || isNaN(ageVal) || ageVal < 60) {
            const errorMsg = window.t ? window.t('error_senior_underage') : 'Age must be 60 or above to register as a Senior Citizen.';
            alertArea.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-bold flex items-center gap-2"><span>⚠️</span> <span>${errorMsg}</span></div>`;
            const ageErr = document.getElementById('ageError');
            if (ageErr) {
              ageErr.textContent = '⚠️ ' + errorMsg;
              ageErr.classList.remove('hidden');
            }
            if (ageEl) {
              ageEl.classList.add('!border-rose-500', '!bg-rose-50');
              ageEl.focus();
            }
            return;
          }

          const seniorDocInput = document.getElementById('seniorIdCard');
          if (seniorDocInput && seniorDocInput.files && seniorDocInput.files[0]) {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('phone', phone);
            formData.append('address', address);
            formData.append('role', role);
            formData.append('language', document.querySelector('input[name="language"]:checked')?.value || 'en');
            formData.append('dob', dobEl?.value || '');
            formData.append('age', ageVal);
            formData.append('gender', document.querySelector('input[name="gender"]:checked')?.value || 'Male');
            formData.append('idDocType', document.getElementById('idDocType')?.value || 'Aadhaar Card');
            formData.append('emergencyContact', document.getElementById('emergencyContact').value.trim());
            formData.append('seniorIdCard', seniorDocInput.files[0]);
            payload = formData;
          } else {
            body.dob = dobEl?.value || '';
            body.age = ageVal;
            body.gender = document.querySelector('input[name="gender"]:checked')?.value || 'Male';
            body.idDocType = document.getElementById('idDocType')?.value || 'Aadhaar Card';
            body.emergencyContact = document.getElementById('emergencyContact').value.trim();
            payload = body;
          }
        } else if (role === 'family') {
          body.linkedSeniorEmail = document.getElementById('linkedSeniorEmail').value.trim();
          body.relationship      = document.getElementById('relationship').value.trim();
          payload = body;
        }
      }

      const res = await apiCall('/auth/register', 'POST', payload);

      if (res.ok && res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        alertArea.innerHTML = `<div class="alert alert-success">Registration successful! ${role === 'volunteer' ? 'Your KYC documents are submitted for Admin & Police review.' : ''} Redirecting...</div>`;
        setTimeout(() => {
          redirectToDashboard(res.data.user.role);
        }, 1500);
      } else {
        alertArea.innerHTML = `<div class="alert alert-danger">${res.data.message || 'Registration failed'}</div>`;
      }
    });

    // Sync registration page UI on live language preference select
    const langChoices = document.querySelectorAll('input[name="language"]');
    langChoices.forEach(radio => {
      radio.addEventListener('change', (e) => {
        // Remove class from all labels first
        document.querySelectorAll('.lang-choice').forEach(lbl => lbl.classList.remove('selected'));
        // Add class to parent label
        radio.closest('.lang-choice').classList.add('selected');
        // Live translation preview
        if (typeof setLang === 'function') {
          setLang(e.target.value);
        }
      });
    });
  }

  // --- Login Page Logic ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    // Show session expired message if redirected
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('message') === 'session_expired') {
      const alertArea = document.getElementById('alertArea');
      alertArea.innerHTML = `<div class="alert alert-danger">Your session has expired. Please login again.</div>`;
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      const alertArea = document.getElementById('alertArea');
      alertArea.innerHTML = '';

      const res = await apiCall('/auth/login', 'POST', { email, password });

      if (res.ok && res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        alertArea.innerHTML = `<div class="alert alert-success">Login successful! Welcome back.</div>`;
        setTimeout(() => {
          redirectToDashboard(res.data.user.role);
        }, 1200);
      } else {
        alertArea.innerHTML = `<div class="alert alert-danger">${res.data.message || 'Invalid email or password'}</div>`;
      }
    });
  }
});


