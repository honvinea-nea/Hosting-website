// Simple localStorage auth (demo customer authentication)

const AUTH_KEY = 'bb_users';
const SESSION_KEY = 'bb_session';

const DEFAULT_DEMO_USER = {
  name: 'Sophia Laurent',
  email: 'demo@example.com',
  password: 'password123'
};

function getUsers() {
  try {
    const list = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
    if (!Array.isArray(list) || !list.length) {
      localStorage.setItem(AUTH_KEY, JSON.stringify([DEFAULT_DEMO_USER]));
      return [DEFAULT_DEMO_USER];
    }
    return list;
  } catch {
    return [DEFAULT_DEMO_USER];
  }
}

function saveUsers(users) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function setSession(user) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: user.email, name: user.name }));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function register(name, email, password) {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'Email already registered.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  users.push({ name, email, password });
  saveUsers(users);
  setSession({ name, email });
  return { ok: true };
}

function login(email, password) {
  const users = getUsers();
  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  setSession(user);
  return { ok: true };
}

function logout() {
  setSession(null);
  window.location.href = 'login.html';
}

// Require login — call on protected pages
function requireLogin() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function updateNav() {
  const session = getSession();
  const loginLink = document.getElementById('login-link');
  const registerLink = document.getElementById('register-link');
  const logoutBtn = document.getElementById('logout-btn');
  const greeting = document.getElementById('user-greeting');

  if (session) {
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
    if (logoutBtn) {
      logoutBtn.style.display = 'inline-flex';
      logoutBtn.className = 'user-logout-btn';
      logoutBtn.title = 'Sign out';
      logoutBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right: 4px;">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span>Logout</span>
      `;
      logoutBtn.onclick = logout;
    }
    if (greeting) {
      greeting.style.display = 'inline-flex';
      greeting.className = 'user-chip';
      const initial = (session.name || 'U').trim().charAt(0).toUpperCase();
      const firstName = (session.name || 'Friend').trim().split(' ')[0];
      greeting.innerHTML = `
        <span class="user-avatar-badge">${initial}</span>
        <span class="user-first-name">${firstName}</span>
      `;
    }
  } else {
    if (loginLink) loginLink.style.display = '';
    if (registerLink) registerLink.style.display = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (greeting) {
      greeting.style.display = 'none';
      greeting.innerHTML = '';
    }
  }
}

document.addEventListener('DOMContentLoaded', updateNav);
