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

    // Handle registration form submit
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const phone = document.getElementById('phone').value.trim();
      const address = document.getElementById('address').value.trim();
      const role = document.querySelector('input[name="role"]:checked').value;

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
      } else if (role === 'volunteer') {
        const checkedSkills = [];
        document.querySelectorAll('input[name="skills"]:checked').forEach(cb => {
          checkedSkills.push(cb.value);
        });
        body.skills = checkedSkills;
      } else if (role === 'family') {
        body.linkedSeniorEmail = document.getElementById('linkedSeniorEmail').value.trim();
        body.relationship      = document.getElementById('relationship').value.trim();
      }

      // Display status feedback
      const alertArea = document.getElementById('alertArea');
      alertArea.innerHTML = '';

      const res = await apiCall('/auth/register', 'POST', body);

      if (res.ok && res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        alertArea.innerHTML = `<div class="alert alert-success">Registration successful! Redirecting...</div>`;
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
