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
    const seniorFields = document.getElementById('seniorFields');
    const volunteerFields = document.getElementById('volunteerFields');
    const familyFields = document.getElementById('familyFields');

    // Handle role toggle selection
    roleRadioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        roleCards.forEach(card => card.classList.remove('selected'));
        radio.closest('.role-card').classList.add('selected');

        const selectedRole = e.target.value;
        // Hide all role-specific panels first
        if (seniorFields)    seniorFields.style.display    = 'none';
        if (volunteerFields) volunteerFields.style.display = 'none';
        if (familyFields)    familyFields.style.display    = 'none';

        if (selectedRole === 'senior') {
          seniorFields.style.display = 'block';
          document.getElementById('emergencyContact').setAttribute('required', 'true');
        } else if (selectedRole === 'volunteer') {
          volunteerFields.style.display = 'block';
          document.getElementById('emergencyContact').removeAttribute('required');
        } else if (selectedRole === 'family') {
          familyFields.style.display = 'block';
          document.getElementById('emergencyContact').removeAttribute('required');
        } else {
          document.getElementById('emergencyContact').removeAttribute('required');
        }
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
          role
        };

        if (role === 'senior') {
          body.emergencyContact = document.getElementById('emergencyContact').value.trim();
        } else if (role === 'family') {
          body.linkedSeniorEmail = document.getElementById('linkedSeniorEmail').value.trim();
          body.relationship      = document.getElementById('relationship').value.trim();
        }
        payload = body;
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
