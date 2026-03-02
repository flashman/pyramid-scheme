// ── FILE: ui/modal.js ────────────────────────────────────
// Two overlay types:
//  1. showModal(h, b)   — announcement / story modal (existing)
//  2. showPrompt(...)   — single input modal for email etc.

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
    document.getElementById('cfg-panel').style.display = 'none';
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
