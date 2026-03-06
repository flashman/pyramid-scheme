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

/* ── Terms of Use modal ─────────────────────────────── */
#tos-overlay {
  position: fixed; inset: 0; z-index: 20000;
  background: rgba(0,0,0,0.92);
  display: none; align-items: center; justify-content: center;
  font-family: monospace;
}
#tos-overlay.active { display: flex; }
#tos-box {
  width: min(680px, 96vw);
  max-height: 90vh;
  display: flex; flex-direction: column;
  border: 2px solid var(--gold-dim, #8a6a20);
  background: #09060f;
  box-shadow: 0 0 80px #c8901440;
}
#tos-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #3a2800;
  flex-shrink: 0;
}
#tos-header h1 {
  color: var(--gold, #f0c020);
  font-size: 11px;
  letter-spacing: 3px;
  margin: 0 0 3px 0;
  text-align: center;
}
#tos-header .tos-org {
  color: #6a5030; font-size: 6px;
  letter-spacing: 2px; text-align: center;
}
#tos-scroll {
  overflow-y: auto; flex: 1;
  padding: 18px 22px;
  scrollbar-width: thin;
  scrollbar-color: #3a2800 #09060f;
}
#tos-scroll::-webkit-scrollbar { width: 6px; }
#tos-scroll::-webkit-scrollbar-track { background: #09060f; }
#tos-scroll::-webkit-scrollbar-thumb { background: #3a2800; }
.tos-section { margin-bottom: 18px; }
.tos-section h2 {
  color: var(--gold, #f0c020); font-size: 7px;
  letter-spacing: 2px; margin: 0 0 6px 0;
  padding-bottom: 3px; border-bottom: 1px solid #2a1800;
}
.tos-section p, .tos-section li {
  color: #b09060; font-size: 6px;
  line-height: 2.1; margin: 0 0 5px 0;
}
.tos-section ul { padding-left: 14px; margin: 0 0 5px 0; }
.tos-section li { list-style: disc; }
.tos-highlight {
  color: #f0e080; font-size: 7px;
  text-align: center;
  background: #1a0e00; border: 1px solid #3a2800;
  padding: 10px 14px; margin: 10px 0;
  letter-spacing: 0.5px; line-height: 2.2;
  display: block;
}
.tos-warning { color: #e08030; }
#tos-footer {
  padding: 12px 20px;
  border-top: 1px solid #3a2800;
  flex-shrink: 0;
  text-align: right;
}
#tos-close {
  padding: 6px 18px;
  font: 700 8px/1 monospace;
  letter-spacing: 2px; cursor: pointer;
  background: #1a0e00;
  border: 1px solid var(--gold-dim, #8a6a20);
  color: var(--gold-dim, #8a6a20);
}
#tos-close:hover { background: #2a1800; color: var(--gold, #f0c020); }
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
      <div id="auth-tos-row" style="display:none;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <input type="checkbox" id="auth-tos-check"
            style="margin-top:2px;flex-shrink:0;accent-color:var(--gold,#f0c020);cursor:pointer;" />
          <label for="auth-tos-check"
            style="font-size:5px;color:#6a5030;line-height:2;cursor:pointer;letter-spacing:0.5px;">
            I have read and agree to the
            <span id="auth-tos-open"
              style="color:var(--gold-dim,#8a6a20);text-decoration:underline;cursor:pointer;">
              Terms of Participation
            </span>
          </label>
        </div>
      </div>
    </div>
    <button id="auth-submit">► ENTER THE DESERT</button>
    <div id="auth-error"></div>
    <div id="auth-demo">[ play as guest — no account needed ]</div>
  </div>
</div>
`;

// ── Terms of Use HTML ─────────────────────────────────────

const TOS_HTML = `
<div id="tos-overlay">
  <div id="tos-box">
    <div id="tos-header">
      <h1>TERMS OF PARTICIPATION</h1>
      <div class="tos-org">PYRAMID SCHEME™ ENTERTAINMENT GROUP &nbsp;·&nbsp; EFFECTIVE DATE: 2025</div>
    </div>
    <div id="tos-scroll">

      <div class="tos-section">
        <p class="tos-highlight">
          ⚠ IMPORTANT NOTICE ⚠<br>
          PYRAMID SCHEME™ IS A WORK OF FICTION AND SATIRE.<br>
          IT IS A GAME FOR ENTERTAINMENT PURPOSES ONLY.<br>
          IT IS NOT AN INVESTMENT VEHICLE, FINANCIAL PRODUCT,<br>
          OR SOLICITATION OF ANY KIND.
        </p>
      </div>

      <div class="tos-section">
        <h2>1. NATURE OF THE GAME</h2>
        <p>PYRAMID SCHEME™ (the "Game") is an online entertainment experience operated by the
        Pyramid Scheme Entertainment Group (the "Operator"). The Game is a satirical simulation
        designed to entertain and educate players about multi-level marketing structures,
        economic dynamics, and game theory. Any resemblance to actual financial schemes,
        investment programs, or illegal activities is entirely satirical in nature.</p>
        <p>The Game depicts a fictional universe in which player characters ("Pharaohs") build
        fictional hierarchical structures ("Pyramids") by recruiting other player characters
        ("Recruits"). This mechanic exists solely as a game design element and carries no
        real-world legal or financial weight beyond what is explicitly stated herein.</p>
      </div>

      <div class="tos-section">
        <h2>2. PARTICIPATION FEE & WHAT IT COVERS</h2>
        <p>Any buy-in, entry fee, or in-game purchase made by a player ("Participant") constitutes
        payment for <span class="tos-warning">access to the Game and its entertainment features only</span>.
        Such payments are analogous to purchasing a licence to use software or paying for access
        to an online game platform. They are not investments, deposits, contributions to a fund,
        or purchases of any financial instrument.</p>
        <ul>
          <li>Fees grant access to gameplay, cosmetic features, and platform use.</li>
          <li>Fees do not constitute an investment in any enterprise or fund.</li>
          <li>Fees are non-refundable except as required by applicable consumer protection law.</li>
          <li>No fee guarantees any return, reward, or monetary benefit of any kind.</li>
        </ul>
      </div>

      <div class="tos-section">
        <h2>3. GAME ACHIEVEMENTS & DISCRETIONARY REWARDS</h2>
        <p>Certain in-game achievements ("Achievements") may, entirely at the sole and
        absolute discretion of the Operator, result in real-world rewards, credits, or
        payments (collectively, "Discretionary Rewards"). Participants expressly acknowledge
        and agree to the following:</p>
        <ul>
          <li>No Discretionary Reward is guaranteed, promised, or implied by participation.</li>
          <li>The Operator reserves the right to withhold, modify, or cancel any reward
              programme at any time without prior notice.</li>
          <li>Any Discretionary Reward is a voluntary gesture by the Operator, not a
              contractual obligation.</li>
          <li>Receipt of a reward in the past does not create any expectation or right to
              receive future rewards.</li>
          <li>Discretionary Rewards, if any, are subject to all applicable taxes, which
              are the sole responsibility of the Participant.</li>
        </ul>
        <p class="tos-highlight">
          IN PLAIN TERMS: THERE IS NO GUARANTEED PAYOUT.<br>
          DO NOT SPEND MORE THAN YOU CAN AFFORD TO LOSE ON GAME ACCESS.
        </p>
      </div>

      <div class="tos-section">
        <h2>4. THIS IS NOT A PYRAMID SCHEME</h2>
        <p>Despite its satirical name, PYRAMID SCHEME™ is not, and does not operate as, an
        illegal pyramid scheme, Ponzi scheme, chain letter, or any other fraudulent arrangement
        prohibited under the laws of any jurisdiction. Specifically:</p>
        <ul>
          <li><span class="tos-warning">No participant is required to recruit others</span> in
              order to recoup their entry fee or receive any benefit.</li>
          <li>All in-game rewards derive from gameplay mechanics, not solely from the recruitment
              of new Participants.</li>
          <li>The Game does not involve the sale of products or services of inflated or
              dubious value.</li>
          <li>No participant acts as an agent, distributor, or representative of the Operator.</li>
        </ul>
        <p>To the extent the Game incorporates multi-level referral mechanics, those mechanics
        are limited to <span class="tos-warning">players introducing other players to the Game itself</span>
        — a practice common in legitimate referral programmes operated by mainstream gaming
        and software companies worldwide. Participants are, at most, introducing new players
        to a game they themselves enjoy.</p>
      </div>

      <div class="tos-section">
        <h2>5. LIMITATION OF LIABILITY</h2>
        <p>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW:</p>
        <ul>
          <li>THE OPERATOR SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
              CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES ARISING FROM OR RELATED TO
              YOUR PARTICIPATION IN THE GAME.</li>
          <li>THE OPERATOR IS NOT RESPONSIBLE FOR ANY FINANCIAL DECISIONS YOU MAKE
              IN CONNECTION WITH THE GAME, INCLUDING DECISIONS TO PAY ANY ENTRY FEE.</li>
          <li>THE OPERATOR PROVIDES THE GAME "AS IS" WITHOUT WARRANTY OF ANY KIND,
              EXPRESS OR IMPLIED.</li>
          <li>YOUR SOLE REMEDY FOR DISSATISFACTION WITH THE GAME IS TO CEASE
              PARTICIPATION.</li>
        </ul>
        <p>Participants assume all risk associated with their participation. The Operator's
        maximum aggregate liability to any Participant shall not exceed the total fees
        paid by that Participant in the twelve (12) months preceding the claim.</p>
      </div>

      <div class="tos-section">
        <h2>6. PARTICIPANT REPRESENTATIONS</h2>
        <p>By registering, you represent and warrant that:</p>
        <ul>
          <li>You are at least 18 years of age or the age of majority in your jurisdiction.</li>
          <li>You are participating for entertainment purposes and not as a financial investment.</li>
          <li>You understand that any money paid for game access may not be recovered.</li>
          <li>You have not been induced to participate by any promise of guaranteed returns.</li>
          <li>You are not prohibited by the laws of your jurisdiction from participating in
              online games or entertainment platforms of this nature.</li>
          <li>You will not represent this Game as an investment opportunity to others.</li>
        </ul>
      </div>

      <div class="tos-section">
        <h2>7. INTELLECTUAL PROPERTY</h2>
        <p>All content, artwork, music, software, and text within PYRAMID SCHEME™ is the
        exclusive property of the Operator and is protected by applicable intellectual
        property law. You are granted a limited, non-exclusive, non-transferable licence
        to access and use the Game for personal entertainment only.</p>
      </div>

      <div class="tos-section">
        <h2>8. MODIFICATIONS</h2>
        <p>The Operator reserves the right to modify these Terms at any time. Continued
        participation following notification of changes constitutes acceptance of the
        revised Terms. It is your responsibility to review these Terms periodically.</p>
      </div>

      <div class="tos-section">
        <h2>9. GOVERNING LAW & DISPUTES</h2>
        <p>These Terms shall be governed by and construed in accordance with applicable law.
        Any dispute arising from or relating to these Terms or the Game shall be resolved
        by binding arbitration on an individual basis. You waive any right to participate
        in a class action proceeding.</p>
      </div>

      <div class="tos-section">
        <p style="color:#4a3020;font-size:5px;line-height:2;text-align:center;">
          Document reference: PSE-TOS-2025-R1 &nbsp;·&nbsp;
          Pyramid Scheme Entertainment Group &nbsp;·&nbsp;
          All rights reserved. &nbsp;·&nbsp;
          This document does not constitute legal advice.
        </p>
      </div>

    </div><!-- /#tos-scroll -->
    <div id="tos-footer">
      <button id="tos-close">✕ CLOSE</button>
    </div>
  </div>
</div>
`;



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

    // Inject auth HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = HTML;
    document.body.appendChild(wrapper.firstElementChild);

    // Inject ToS HTML
    const tosWrapper = document.createElement('div');
    tosWrapper.innerHTML = TOS_HTML;
    document.body.appendChild(tosWrapper.firstElementChild);

    const overlay  = document.getElementById('auth-overlay');
    const tabs     = document.querySelectorAll('.auth-tab');
    const submit   = document.getElementById('auth-submit');
    const errEl    = document.getElementById('auth-error');
    const userEl   = document.getElementById('auth-user');
    const passEl   = document.getElementById('auth-pass');
    const confirmW = document.getElementById('auth-confirm-wrap');
    const confirmEl= document.getElementById('auth-confirm');
    const demoBtn  = document.getElementById('auth-demo');
    const tosRow   = document.getElementById('auth-tos-row');
    const tosCheck = document.getElementById('auth-tos-check');
    const tosOpen  = document.getElementById('auth-tos-open');
    const tosOverlay = document.getElementById('tos-overlay');
    const tosClose   = document.getElementById('tos-close');

    let mode = 'login'; // 'login' | 'register'

    // Auto-switch to register when arriving via an invite link
    if (_inviteToken) {
      mode = 'register';
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'register'));
      confirmW.style.display = 'block';
      tosRow.style.display   = 'block';
      submit.textContent     = '► FOUND YOUR DYNASTY';
    }

    // ── ToS modal open / close ───────────────────────────
    function openTos() {
      document.getElementById('tos-scroll').scrollTop = 0;
      tosOverlay.classList.add('active');
    }
    tosOpen.addEventListener('click', openTos);
    tosClose.addEventListener('click', () => tosOverlay.classList.remove('active'));

    function setError(msg) { errEl.textContent = msg; }
    function clearError()  { errEl.textContent = '';  }

    // ── Tab switching ────────────────────────────────────
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        const isReg = mode === 'register';
        confirmW.style.display = isReg ? 'block' : 'none';
        tosRow.style.display   = isReg ? 'block' : 'none';
        if (!isReg) tosCheck.checked = false; // reset on leaving register
        submit.textContent = isReg ? '► FOUND YOUR DYNASTY' : '► ENTER THE DESERT';
        clearError();
      });
    });

    // ── Enter key ────────────────────────────────────────
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
        if (!tosCheck.checked) { setError('You must agree to the Terms of Participation.'); return; }
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

    // ── Guest / demo mode ────────────────────────────────
    demoBtn.addEventListener('click', () => {
      _dismiss(overlay);
      resolve(null);
    });

    setTimeout(() => userEl.focus(), 50);
  });
}

function _dismiss(overlay) {
  overlay.style.transition = 'opacity 0.3s';
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.remove();
    document.getElementById('tos-overlay')?.remove();
  }, 320);
}
