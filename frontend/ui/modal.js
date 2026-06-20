// ── FILE: ui/modal.js ────────────────────────────────────
// Overlay types:
//  1. showModal(h, b)        — announcement / story modal
//  2. showPrompt(...)        — single input modal for email etc.
//  3. showBuyInDialog(guest) — buy-in confirmation with QR for guests

// ── Announcement modal ────────────────────────────────────

export function showModal(h, b) {
  document.getElementById('mh').textContent = h;
  document.getElementById('mb').textContent = b;
  document.getElementById('mo').classList.add('show');
}

export function closeModal() {
  document.getElementById('mo').classList.remove('show');
}

document.addEventListener('keydown', e => {
  const modal = document.getElementById('mo');
  if ((e.key === 'Escape' || e.key === 'Enter') && modal.classList.contains('show')) {
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.key === 'Escape') {
    _dismissPrompt(null);
  }
});


// ── Prompt modal (single-field input) ─────────────────────
//
// Usage:
//   const value = await showPrompt('SEND SCROLL', 'Enter email:', 'friend@example.com');
//   if (value === null) { /* user cancelled */ }

let _promptResolve = null;

const PROMPT_CSS = `
#pm-overlay {
  position:fixed;inset:0;z-index:20000;
  background:rgba(0,0,0,0.78);
  display:flex;align-items:center;justify-content:center;
  font-family:monospace;
}
#pm-box {
  width:300px;background:#0d0800;
  border:2px solid var(--gold-dim,#8a6a20);
  padding:20px 22px;box-shadow:0 0 50px #ff600020;
}
#pm-title {
  color:var(--gold,#f0c020);font-size:10px;letter-spacing:3px;
  text-align:center;margin-bottom:12px;
}
#pm-body {
  color:var(--tan,#c0a060);font-size:6px;letter-spacing:1px;
  margin-bottom:8px;
}
#pm-input {
  width:100%;box-sizing:border-box;background:#0a0600;
  border:1px solid #3a2800;color:#d0a060;
  font:9px/1 monospace;padding:7px 8px;outline:none;
}
#pm-input:focus { border-color:var(--gold-dim,#8a6a20); }
#pm-err {
  min-height:12px;font-size:6px;color:#e04040;
  margin-top:5px;text-align:center;
}
.pm-btns {
  display:flex;gap:8px;margin-top:12px;
}
.pm-btns .btn { flex:1;font-size:6px;padding:6px; }
`;

function _ensurePromptDOM() {
  if (document.getElementById('pm-overlay')) return;

  const style = document.createElement('style');
  style.textContent = PROMPT_CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'pm-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div id="pm-box">
      <div id="pm-title">SEND SCROLL</div>
      <div id="pm-body">Enter email:</div>
      <input id="pm-input" type="email" autocomplete="email" spellcheck="false"/>
      <div id="pm-err"></div>
      <div class="pm-btns">
        <button class="btn" id="pm-cancel">CANCEL</button>
        <button class="btn g" id="pm-ok">SEND ►</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById('pm-cancel').addEventListener('click', () => _dismissPrompt(null));
  document.getElementById('pm-ok').addEventListener('click', _submitPrompt);
  document.getElementById('pm-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _submitPrompt(); }
    if (e.key === 'Escape') _dismissPrompt(null);
  });
}

function _submitPrompt() {
  const val = document.getElementById('pm-input').value.trim();
  const errEl = document.getElementById('pm-err');
  if (!val) { errEl.textContent = 'Enter an email address.'; return; }
  if (!val.includes('@')) { errEl.textContent = 'Not a valid email.'; return; }
  _dismissPrompt(val);
}

function _dismissPrompt(value) {
  const overlay = document.getElementById('pm-overlay');
  if (overlay) overlay.style.display = 'none';
  if (_promptResolve) {
    const fn = _promptResolve;
    _promptResolve = null;
    fn(value);
  }
}

/**
 * Shows a modal with a text input and returns a Promise that resolves to
 * the entered value, or null if cancelled.
 */
export function showPrompt(title, body, placeholder = '') {
  _ensurePromptDOM();
  document.getElementById('pm-title').textContent = title;
  document.getElementById('pm-body').textContent  = body;
  document.getElementById('pm-input').value       = '';
  document.getElementById('pm-input').placeholder = placeholder;
  document.getElementById('pm-err').textContent   = '';
  document.getElementById('pm-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('pm-input')?.focus(), 50);

  return new Promise(resolve => { _promptResolve = resolve; });
}


// ── Buy-in confirmation dialog ────────────────────────────
//
// Guest path:  cheeky QR + satirical copy, confirms before simulation
// Auth path:   real payment instructions + QR; resolves false (no auto-confirm)

import { PAYMENT_QR_DATA }        from '../game/payment.js';
import { drawQR, decodeQRString, randomQRMatrix } from './qr.js';

let _buyInResolve = null;
let _buyInIsGuest = false;

const BUYIN_CSS = `
#bi-overlay {
  position:fixed;inset:0;z-index:20000;
  background:rgba(0,0,0,0.82);
  display:flex;align-items:center;justify-content:center;
  font-family:monospace;
}
#bi-box {
  width:240px;background:#0d0800;
  border:2px solid var(--gold-dim,#8a6a20);
  padding:18px 20px;box-shadow:0 0 60px #f0c02018;
  text-align:center;
}
#bi-title {
  color:var(--gold,#f0c020);font-size:10px;letter-spacing:3px;
  margin-bottom:10px;
}
#bi-body {
  color:var(--tan,#c0a060);font-size:6px;letter-spacing:1px;
  line-height:2;white-space:pre-line;margin-bottom:8px;
}
#bi-qr {
  display:block;margin:8px auto;
  border:1px solid #3a2800;
}
#bi-code {
  font-size:20px;letter-spacing:6px;
  padding:8px 4px;margin:8px 0;
}
#bi-sub {
  color:#806040;font-size:5px;letter-spacing:1px;
  line-height:1.8;white-space:pre-line;margin-bottom:10px;
}
.bi-btns { display:flex;gap:8px;margin-top:10px; }
.bi-btns .btn { flex:1;font-size:6px;padding:6px; }
`;

function _ensureBuyInDOM() {
  if (document.getElementById('bi-overlay')) return;
  const style = document.createElement('style');
  style.textContent = BUYIN_CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'bi-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div id="bi-box">
      <div id="bi-title"></div>
      <div id="bi-body"></div>
      <canvas id="bi-qr"></canvas>
      <div id="bi-code"></div>
      <div id="bi-sub"></div>
      <div class="bi-btns">
        <button class="btn" id="bi-cancel">CANCEL</button>
        <button class="btn g" id="bi-ok">CONFIRM ►</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('bi-cancel').addEventListener('click', () => _dismissBuyIn(false));
  document.getElementById('bi-ok').addEventListener('click',     () => _dismissBuyIn(true));
}

function _dismissBuyIn(confirmed) {
  const ov = document.getElementById('bi-overlay');
  if (ov) ov.style.display = 'none';
  if (_buyInResolve) { const fn = _buyInResolve; _buyInResolve = null; fn(confirmed); }
}

document.addEventListener('keydown', e => {
  const ov = document.getElementById('bi-overlay');
  if (!ov || ov.style.display === 'none') return;
  if (e.key === 'Enter')  { e.preventDefault(); _dismissBuyIn(_buyInIsGuest); }
  if (e.key === 'Escape') { e.preventDefault(); _dismissBuyIn(false); }
});

/**
 * Shows a buy-in overlay.
 * Guests: satirical QR + confirm button → resolves true (simulated buy-in).
 * Auth users: real payment QR + offering code + GOT IT only → resolves false (no auto-confirm).
 * `offeringCode` is the server-canonical code from /api/me (G.offeringCode) —
 * never computed client-side (see app/offering.py).
 */
export function showBuyInDialog(isGuest, offeringCode = '') {
  _ensureBuyInDOM();
  _buyInIsGuest = isGuest;
  const qr   = document.getElementById('bi-qr');
  const code = document.getElementById('bi-code');
  if (isGuest) {
    document.getElementById('bi-ok').style.display   = '';
    document.getElementById('bi-ok').textContent     = 'CONFIRM ►';
    document.getElementById('bi-cancel').textContent = 'CANCEL';
    document.getElementById('bi-title').textContent  = '💸 THE OFFERING';
    document.getElementById('bi-body').textContent   =
      'THE PYRAMID HUNGERS.\n\nScan the Sacred Glyph™\nand sacrifice to the gods:';
    document.getElementById('bi-sub').textContent    =
      '— or just press confirm —\nThe Pharaoh is patient.\nAll debts settle\nin the next life.\n\n★ TOTALLY LEGAL ™ ★';
    code.style.display = 'none';
    const matrix = decodeQRString(PAYMENT_QR_DATA) ?? randomQRMatrix();
    qr.style.display = 'block';
    setTimeout(() => drawQR(qr, matrix), 10);
  } else {
    // Auth user: payment is real and manual — show instructions only, no auto-confirm.
    document.getElementById('bi-ok').style.display   = 'none';
    document.getElementById('bi-cancel').textContent = 'SO IT IS WRITTEN';
    document.getElementById('bi-title').textContent  = '⚡ THE TITHE AWAITS ⚡';
    document.getElementById('bi-body').textContent   =
      'You have been measured, Pharaoh.\n\nScan the glyph. $10.\nSpeak nothing. Write only your mark.\nThe ledger needs no other context.';
    code.textContent   = offeringCode;
    code.style.display = 'block';
    document.getElementById('bi-sub').textContent    =
      'The gate opens when the coin crosses.\nNot before. Not after.\n\nDo not lose your mark.\n\n★ THE LEDGER IS ETERNAL ★';
    const matrix = decodeQRString(PAYMENT_QR_DATA) ?? randomQRMatrix();
    qr.style.display = 'block';
    setTimeout(() => drawQR(qr, matrix), 10);
  }
  document.getElementById('bi-overlay').style.display = 'flex';
  return new Promise(resolve => { _buyInResolve = resolve; });
}
