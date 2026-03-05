// ── FILE: ui/profile.js ──────────────────────────────────
// User profile modal — change username / password / email,
// view monetary stats, and log out.
//
// Usage:
//   import { openProfile } from './ui/profile.js';
//   openProfile(Api, G, onLogout);

import { SoundManager } from '../audio/sound.js';

const CSS = `
#profile-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.82);
  display: flex; align-items: center; justify-content: center;
  font-family: monospace;
}

#profile-box {
  width: 340px;
  border: 2px solid var(--gold-dim, #8a6a20);
  background: #0d0800;
  padding: 22px 24px 18px;
  box-shadow: 0 0 60px #ff600028;
  max-height: 90vh;
  overflow-y: auto;
}

#profile-title {
  color: var(--gold, #f0c020);
  font-size: 11px;
  letter-spacing: 3px;
  text-align: center;
  margin-bottom: 16px;
}

.prof-section {
  border-top: 1px solid #2a1800;
  padding-top: 10px;
  margin-top: 10px;
}

.prof-section-title {
  color: var(--tan-muted, #6a5030);
  font-size: 6px;
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.prof-stat-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.prof-stat-label {
  color: #5a4020;
  font-size: 6px;
  letter-spacing: 1px;
}

.prof-stat-value {
  color: var(--tan, #b08060);
  font-size: 7px;
}

.prof-stat-value.gold { color: var(--gold, #f0c020); }
.prof-stat-value.green { color: #40d080; }
.prof-stat-value.red { color: #e04040; }

.prof-field {
  margin-bottom: 8px;
}

.prof-field label {
  display: block;
  font-size: 6px;
  letter-spacing: 1px;
  color: #7a5a30;
  margin-bottom: 3px;
}

.prof-field input {
  width: 100%;
  box-sizing: border-box;
  background: #0a0600;
  border: 1px solid #3a2800;
  color: #d0a060;
  font: 9px/1 monospace;
  padding: 6px 8px;
  outline: none;
}

.prof-field input:focus { border-color: var(--gold-dim, #8a6a20); }

.prof-btn {
  width: 100%;
  padding: 7px;
  font: 700 8px/1 monospace;
  letter-spacing: 2px;
  cursor: pointer;
  background: #1a0e00;
  border: 1px solid var(--gold-dim, #8a6a20);
  color: var(--gold, #f0c020);
  margin-top: 4px;
}

.prof-btn:hover { background: #2a1800; }
.prof-btn:disabled { opacity: 0.4; cursor: default; }

.prof-btn.danger {
  border-color: #6a1010;
  color: #e04040;
  background: #120000;
}
.prof-btn.danger:hover { background: #220000; }

.prof-msg {
  font-size: 7px;
  text-align: center;
  min-height: 12px;
  margin-top: 5px;
  letter-spacing: 0.5px;
}
.prof-msg.ok  { color: #40d080; }
.prof-msg.err { color: #e04040; }

#profile-close-btn {
  position: absolute;
  top: 0; right: 0;
  padding: 4px 8px;
  font: 700 10px/1 monospace;
  background: none;
  border: none;
  color: #5a3a10;
  cursor: pointer;
}
#profile-close-btn:hover { color: var(--gold, #f0c020); }

#profile-box { position: relative; }
`;

export function openProfile(Api, G, onLogout) {
  // Inject styles once
  if (!document.getElementById('profile-css')) {
    const style = document.createElement('style');
    style.id = 'profile-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ── Build overlay ────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'profile-overlay';

  overlay.innerHTML = `
    <div id="profile-box">
      <button id="profile-close-btn" title="Close">✕</button>
      <div id="profile-title">◈ PHARAOH PROFILE ◈</div>

      <!-- Account info (read-only) -->
      <div class="prof-section">
        <div class="prof-section-title">▶ ACCOUNT</div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">USERNAME</span>
          <span class="prof-stat-value gold" id="prof-disp-username">—</span>
        </div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">EMAIL</span>
          <span class="prof-stat-value" id="prof-disp-email">—</span>
        </div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">MEMBER SINCE</span>
          <span class="prof-stat-value" id="prof-disp-since">—</span>
        </div>
      </div>

      <!-- Monetary stats (read-only) -->
      <div class="prof-section">
        <div class="prof-section-title">▶ FINANCES</div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">BALANCE</span>
          <span class="prof-stat-value gold" id="prof-disp-balance">—</span>
        </div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">TOTAL EARNED</span>
          <span class="prof-stat-value green" id="prof-disp-earned">—</span>
        </div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">TOTAL INVESTED</span>
          <span class="prof-stat-value red" id="prof-disp-invested">—</span>
        </div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">NET P&L</span>
          <span class="prof-stat-value" id="prof-disp-net">—</span>
        </div>
        <div class="prof-stat-row">
          <span class="prof-stat-label">TOTAL RECRUITS</span>
          <span class="prof-stat-value" id="prof-disp-recruits">—</span>
        </div>
      </div>

      <!-- Change username -->
      <div class="prof-section">
        <div class="prof-section-title">▶ CHANGE USERNAME</div>
        <div class="prof-field">
          <label>NEW USERNAME</label>
          <input id="prof-new-username" type="text" maxlength="32" placeholder="new_pharaoh_name" />
        </div>
        <button class="prof-btn" id="prof-save-username">► SAVE USERNAME</button>
        <div class="prof-msg" id="prof-msg-username"></div>
      </div>

      <!-- Change email -->
      <div class="prof-section">
        <div class="prof-section-title">▶ CHANGE EMAIL</div>
        <div class="prof-field">
          <label>NEW EMAIL</label>
          <input id="prof-new-email" type="email" maxlength="128" placeholder="pharaoh@desert.gg" />
        </div>
        <button class="prof-btn" id="prof-save-email">► SAVE EMAIL</button>
        <div class="prof-msg" id="prof-msg-email"></div>
      </div>

      <!-- Change password -->
      <div class="prof-section">
        <div class="prof-section-title">▶ CHANGE PASSWORD</div>
        <div class="prof-field">
          <label>CURRENT PASSWORD</label>
          <input id="prof-cur-pass" type="password" maxlength="128" placeholder="••••••••" />
        </div>
        <div class="prof-field">
          <label>NEW PASSWORD</label>
          <input id="prof-new-pass" type="password" maxlength="128" placeholder="••••••••" />
        </div>
        <div class="prof-field">
          <label>CONFIRM NEW PASSWORD</label>
          <input id="prof-confirm-pass" type="password" maxlength="128" placeholder="••••••••" />
        </div>
        <button class="prof-btn" id="prof-save-password">► SAVE PASSWORD</button>
        <div class="prof-msg" id="prof-msg-password"></div>
      </div>

      <!-- Danger zone -->
      <!-- Sound settings -->
      <div class="prof-section">
        <div class="prof-section-title">▶ SOUND SETTINGS</div>
        <div class="prof-stat-row" style="align-items:center;margin-bottom:8px">
          <span class="prof-stat-label">MUSIC</span>
          <button id="prof-sound-toggle" class="prof-btn" style="padding:4px 10px;min-width:70px">
            ${SoundManager.enabled ? '♪ ON' : '✕ OFF'}
          </button>
        </div>
        <div class="prof-stat-row" style="align-items:center">
          <span class="prof-stat-label">VOLUME</span>
          <input
            type="range" id="prof-volume-slider"
            min="0" max="100"
            value="${Math.round(SoundManager.volume * 100)}"
            style="flex:1;margin-left:12px;accent-color:var(--gold,#f0c020);cursor:pointer"
          >
        </div>
        <div class="prof-stat-row" style="margin-top:4px">
          <span></span>
          <span id="prof-volume-label" style="color:var(--tan,#b08060);font-size:6px;letter-spacing:1px">
            ${Math.round(SoundManager.volume * 100)}%
          </span>
        </div>
      </div>

      <!-- Log out -->
      <div class="prof-section">
        <button class="prof-btn danger" id="prof-logout-btn">⚡ LOG OUT</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── Load profile data ────────────────────────────────
  Api.getProfile().then(data => {
    if (!data || data.error || data.detail) return;

    document.getElementById('prof-disp-username').textContent = data.username;
    document.getElementById('prof-disp-email').textContent    = data.email || '(none)';

    if (data.created_at) {
      const d = new Date(data.created_at);
      document.getElementById('prof-disp-since').textContent =
        d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    const bal  = parseFloat(data.balance  || 0);
    const earn = parseFloat(data.earned   || 0);
    const inv  = parseFloat(data.invested || 0);
    const net  = earn - inv;

    document.getElementById('prof-disp-balance').textContent  = `$${bal.toFixed(2)}`;
    document.getElementById('prof-disp-earned').textContent   = `$${earn.toFixed(2)}`;
    document.getElementById('prof-disp-invested').textContent = `$${inv.toFixed(2)}`;

    const netEl = document.getElementById('prof-disp-net');
    netEl.textContent  = `${net >= 0 ? '+' : ''}$${net.toFixed(2)}`;
    netEl.className    = 'prof-stat-value ' + (net > 0 ? 'green' : net < 0 ? 'red' : '');

    document.getElementById('prof-disp-recruits').textContent = data.recruits ?? 0;

    // Pre-fill email input with current value for easy editing
    if (data.email) document.getElementById('prof-new-email').value = data.email;
  }).catch(() => {});

  // ── Close button ─────────────────────────────────────
  function dismiss() {
    overlay.style.transition = 'opacity 0.2s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 220);
  }

  document.getElementById('profile-close-btn').addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });

  // ── Helper ───────────────────────────────────────────
  function setMsg(id, msg, isOk) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = 'prof-msg ' + (isOk ? 'ok' : 'err');
    if (isOk) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
  }

  // ── Change username ──────────────────────────────────
  document.getElementById('prof-save-username').addEventListener('click', async () => {
    const btn = document.getElementById('prof-save-username');
    const val = document.getElementById('prof-new-username').value.trim();
    if (!val) { setMsg('prof-msg-username', 'Enter a new username.', false); return; }
    if (val.length < 3) { setMsg('prof-msg-username', 'Username must be 3+ characters.', false); return; }

    btn.disabled = true;
    const res = await Api.changeUsername(val);
    btn.disabled = false;

    if (res && res.ok) {
      // Update stored token with fresh one (contains updated username claim)
      Api.setToken(res.new_token);
      if (G) G.username = res.username;
      document.getElementById('prof-disp-username').textContent = res.username;
      document.getElementById('prof-new-username').value = '';
      setMsg('prof-msg-username', '✓ Username updated!', true);
    } else {
      setMsg('prof-msg-username', res?.detail || res?.error || 'Failed.', false);
    }
  });

  // ── Change email ─────────────────────────────────────
  document.getElementById('prof-save-email').addEventListener('click', async () => {
    const btn = document.getElementById('prof-save-email');
    const val = document.getElementById('prof-new-email').value.trim();

    btn.disabled = true;
    const res = await Api.changeEmail(val || null);
    btn.disabled = false;

    if (res && res.ok) {
      document.getElementById('prof-disp-email').textContent = res.email || '(none)';
      setMsg('prof-msg-email', '✓ Email updated!', true);
    } else {
      setMsg('prof-msg-email', res?.detail || res?.error || 'Failed.', false);
    }
  });

  // ── Change password ───────────────────────────────────
  document.getElementById('prof-save-password').addEventListener('click', async () => {
    const btn     = document.getElementById('prof-save-password');
    const curPass = document.getElementById('prof-cur-pass').value;
    const newPass = document.getElementById('prof-new-pass').value;
    const confirm = document.getElementById('prof-confirm-pass').value;

    if (!curPass || !newPass) { setMsg('prof-msg-password', 'All fields required.', false); return; }
    if (newPass.length < 6)   { setMsg('prof-msg-password', 'New password must be 6+ characters.', false); return; }
    if (newPass !== confirm)  { setMsg('prof-msg-password', 'Passwords do not match.', false); return; }

    btn.disabled = true;
    const res = await Api.changePassword(curPass, newPass);
    btn.disabled = false;

    if (res && res.ok) {
      document.getElementById('prof-cur-pass').value = '';
      document.getElementById('prof-new-pass').value = '';
      document.getElementById('prof-confirm-pass').value = '';
      setMsg('prof-msg-password', '✓ Password changed!', true);
    } else {
      setMsg('prof-msg-password', res?.detail || res?.error || 'Failed.', false);
    }
  });

  // ── Sound settings ────────────────────────────────────
  document.getElementById('prof-sound-toggle').addEventListener('click', () => {
    SoundManager.setEnabled(!SoundManager.enabled);
    document.getElementById('prof-sound-toggle').textContent =
      SoundManager.enabled ? '♪ ON' : '✕ OFF';
    // Keep sidebar button in sync
    const sideBtn = document.getElementById('sound-btn');
    if (sideBtn) sideBtn.textContent = SoundManager.enabled ? '♪ MUSIC ON' : '✕ MUSIC OFF';
  });

  document.getElementById('prof-volume-slider').addEventListener('input', e => {
    const pct = parseInt(e.target.value, 10);
    SoundManager.setVolume(pct / 100);
    document.getElementById('prof-volume-label').textContent = `${pct}%`;
  });

  // ── Log out ───────────────────────────────────────────
  document.getElementById('prof-logout-btn').addEventListener('click', () => {
    dismiss();
    setTimeout(() => {
      Api.clearToken();
      if (typeof onLogout === 'function') onLogout();
      else window.location.reload();
    }, 250);
  });
}
