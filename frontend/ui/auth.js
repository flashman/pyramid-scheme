// ── FILE: ui/auth.js ─────────────────────────────────────
// Login / register overlay. Resolves a promise with the JWT
// so main.js can await it before starting the game loop.
//
// Usage:
//   import { requireAuth } from './ui/auth.js';
//   const token = await requireAuth();   // blocks until logged in

import { Api } from '../game/api.js';

// ── Styles ───────────────────────────────────────────────

const CSS = `
#auth-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: #0a0500;
  display: flex; align-items: center; justify-content: center;
  font-family: monospace;
}

#auth-box {
  width: 320px;
  border: 2px solid var(--gold-dim, #8a6a20);
  background: #0d0800;
  padding: 22px 24px;
  box-shadow: 0 0 60px #ff600028;
}

#auth-title {
  color: var(--gold, #f0c020);
  font-size: 12px;
  letter-spacing: 3px;
  text-align: center;
  margin-bottom: 4px;
}

#auth-sub {
  color: var(--tan-muted, #6a5030);
  font-size: 6px;
  letter-spacing: 2px;
  text-align: center;
  margin-bottom: 18px;
}

.auth-tabs {
  display: flex; gap: 0; margin-bottom: 16px;
}

.auth-tab {
  flex: 1; padding: 5px; font: 8px/1 monospace;
  border: 1px solid #3a2000; background: #120a00;
  color: #6a4020; cursor: pointer; letter-spacing: 1px;
}
.auth-tab.active {
  border-color: var(--gold-dim, #8a6a20);
  background: #1e1000; color: var(--gold, #f0c020);
}

.auth-field {
  margin-bottom: 10px;
}
.auth-field label {
  display: block; font-size: 6px; letter-spacing: 1px;
  color: #7a5a30; margin-bottom: 3px;
}
.auth-field input {
  width: 100%; box-sizing: border-box;
  background: #0a0600; border: 1px solid #3a2800;
  color: #d0a060; font: 9px/1 monospace;
  padding: 6px 8px; outline: none;
}
.auth-field input:focus { border-color: var(--gold-dim, #8a6a20); }

#auth-submit {
  width: 100%; margin-top: 6px;
  padding: 8px; font: 700 9px/1 monospace;
  letter-spacing: 2px; cursor: pointer;
  background: #1a0e00; border: 1px solid var(--gold-dim, #8a6a20);
  color: var(--gold, #f0c020);
}
#auth-submit:hover { background: #2a1800; }
#auth-submit:disabled { opacity: 0.4; cursor: default; }

#auth-error {
  margin-top: 10px; font-size: 7px;
  color: #e04040; text-align: center; min-height: 12px;
  letter-spacing: 0.5px;
}

#auth-demo {
  margin-top: 12px; text-align: center;
  font-size: 6px; color: #3a2800; cursor: pointer;
  letter-spacing: 1px;
}
#auth-demo:hover { color: #6a4020; }
`;

// ── HTML ─────────────────────────────────────────────────

const HTML = `
<div id="auth-overlay">
  <div id="auth-box">
    <div id="auth-title">⚡ PYRAMID SCHEME™ ⚡</div>
    <div id="auth-sub">★ IDENTIFY YOURSELF, PHARAOH ★</div>
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="login">LOGIN</button>
      <button class="auth-tab"        data-tab="register">REGISTER</button>
    </div>
    <div id="auth-form">
      <div class="auth-field">
        <label>USERNAME</label>
        <input id="auth-user" type="text" autocomplete="username" placeholder="pharaoh_name" maxlength="32" />
      </div>
      <div class="auth-field">
        <label>PASSWORD</label>
        <input id="auth-pass" type="password" autocomplete="current-password" placeholder="••••••••" maxlength="128" />
      </div>
      <div class="auth-field" id="auth-confirm-wrap" style="display:none">
        <label>CONFIRM PASSWORD</label>
        <input id="auth-confirm" type="password" autocomplete="new-password" placeholder="••••••••" maxlength="128" />
      </div>
    </div>
    <button id="auth-submit">► ENTER THE DESERT</button>
    <div id="auth-error"></div>
    <div id="auth-demo">[ play as guest — no account needed ]</div>
  </div>
</div>
`;

// ── Logic ────────────────────────────────────────────────

export async function requireAuth() {
  // Read invite token from URL before showing the overlay.
  // If present, auto-switch to the register tab.
  const _urlParams   = new URLSearchParams(window.location.search);
  const _inviteToken = _urlParams.get('invite') || null;

  // ── Try to restore an existing session ──────────────
  // Skip the auth overlay entirely if a valid stored token exists.
  // Don't attempt restore when arriving via an invite link (force register).
  if (!_inviteToken) {
    const restored = await Api.restoreToken();
    if (restored) return restored;
  }

  return new Promise((resolve) => {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Inject HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = HTML;
    document.body.appendChild(wrapper.firstElementChild);

    const overlay  = document.getElementById('auth-overlay');
    const tabs     = document.querySelectorAll('.auth-tab');
    const submit   = document.getElementById('auth-submit');
    const errEl    = document.getElementById('auth-error');
    const userEl   = document.getElementById('auth-user');
    const passEl   = document.getElementById('auth-pass');
    const confirmW = document.getElementById('auth-confirm-wrap');
    const confirmEl= document.getElementById('auth-confirm');
    const demoBtn  = document.getElementById('auth-demo');

    let mode = 'login'; // 'login' | 'register'

    // Auto-switch to register when arriving via an invite link
    if (_inviteToken) {
      mode = 'register';
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'register'));
      confirmW.style.display = 'block';
      submit.textContent = '► FOUND YOUR DYNASTY';
    }

    function setError(msg) { errEl.textContent = msg; }
    function clearError()  { errEl.textContent = '';  }

    // ── Tab switching ───────────────────────────────────
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        confirmW.style.display = mode === 'register' ? 'block' : 'none';
        submit.textContent = mode === 'login' ? '► ENTER THE DESERT' : '► FOUND YOUR DYNASTY';
        clearError();
      });
    });

    // ── Enter key ───────────────────────────────────────
    [userEl, passEl, confirmEl].forEach(el => {
      el.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
    });

    // ── Submit ───────────────────────────────────────────
    async function doSubmit() {
      clearError();
      const username = userEl.value.trim();
      const password = passEl.value;

      if (!username || !password) { setError('All fields required.'); return; }
      if (username.length < 3)    { setError('Username must be 3+ characters.'); return; }
      if (password.length < 6)    { setError('Password must be 6+ characters.'); return; }

      if (mode === 'register') {
        if (password !== confirmEl.value) { setError('Passwords do not match.'); return; }
      }

      submit.disabled = true;
      submit.textContent = '► CONSULTING THE GODS...';

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload  = mode === 'login'
        ? { username, password }
        : { username, password, invite_token: _inviteToken || undefined };
      const result = await Api.post(endpoint, payload);

      if (result.access_token) {
        _dismiss(overlay);
        resolve(result.access_token);
      } else {
        setError(result.detail || result.error || 'Something went wrong.');
        submit.disabled = false;
        submit.textContent = mode === 'login' ? '► ENTER THE DESERT' : '► FOUND YOUR DYNASTY';
      }
    }

    submit.addEventListener('click', doSubmit);

    // ── Guest / demo mode ─────────────────────────────
    demoBtn.addEventListener('click', () => {
      _dismiss(overlay);
      resolve(null); // null token = guest, no server sync
    });

    // Focus username on load
    setTimeout(() => userEl.focus(), 50);
  });
}

function _dismiss(overlay) {
  overlay.style.transition = 'opacity 0.3s';
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 320);
}
