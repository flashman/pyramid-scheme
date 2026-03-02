// ── FILE: ui/dev-panel.js ─────────────────────────────────
// Developer panel for testing — realm teleports, flag toggles,
// state cheats, and (when authenticated) backend recruit simulation.
// Toggle with the [⚠ DEV] button or backtick key.

import { G }               from '../game/state.js';
import { earthLayout }     from '../game/recruits.js';
import { Flags }           from '../engine/flags.js';
import { RealmManager }    from '../engine/realm.js';
import { Api }             from '../game/api.js';
import { updateStats, updateSlots, log } from './panels.js';
import { GND }             from '../worlds/earth/constants.js';
import { mkPyr, addLayer } from '../game/pyramids.js';

// ── DOM scaffold ─────────────────────────────────────────

const PANEL_HTML = `
<div id="dev-panel">
  <div id="dev-header">
    <span>⚠ DEV PANEL</span>
    <button id="dev-close" title="Close (backtick)">✕</button>
  </div>

  <div class="dev-section" id="dev-sim-section" style="display:none">
    <div class="dev-section-title">🤖 SIMULATE RECRUITS
      <span id="dev-sim-mode-badge" style="margin-left:8px;font-size:6px;
        color:#40d080;border:1px solid #40d080;padding:1px 5px">BACKEND</span>
    </div>
    <div style="color:#604020;font-size:6px;margin-bottom:8px;line-height:1.8">
      Fires the real chain-walk on the server — DB writes, WS events,
      payout credits — just like a real user buying in.
    </div>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
      <label style="color:#907050;font-size:6px;letter-spacing:1px">DEPTH</label>
      <select id="dev-sim-depth" style="font:7px monospace;background:#0d0800;
        color:#d0a060;border:1px solid #503010;padding:2px 4px">
        <option value="1">D1 — direct recruit</option>
        <option value="2">D2 — under your D1</option>
        <option value="3">D3 — under your D2</option>
      </select>
      <label style="color:#907050;font-size:6px;letter-spacing:1px">DELAY</label>
      <select id="dev-sim-delay" style="font:7px monospace;background:#0d0800;
        color:#d0a060;border:1px solid #503010;padding:2px 4px">
        <option value="2">2 s</option>
        <option value="5" selected>5 s</option>
        <option value="10">10 s</option>
        <option value="0">instant</option>
      </select>
    </div>
    <div class="dev-btn-row">
      <button class="dev-btn" id="dev-sim-btn">► SIM RECRUIT</button>
      <button class="dev-btn danger" id="dev-sim-clear">🗑 CLEAR SIMS</button>
    </div>
    <div id="dev-sim-log" style="margin-top:8px;font-size:6px;color:#506050;
      line-height:2;max-height:80px;overflow-y:auto"></div>
  </div>

  <div class="dev-section">
    <div class="dev-section-title">REALM TELEPORT</div>
    <div class="dev-btn-row" id="dev-realms"></div>
  </div>

  <div class="dev-section">
    <div class="dev-section-title">PROGRESSION FLAGS</div>
    <div id="dev-flags"></div>
  </div>

  <div class="dev-section">
    <div class="dev-section-title">STATE CHEATS</div>
    <div class="dev-btn-row" id="dev-cheats"></div>
  </div>

  <div class="dev-section">
    <div class="dev-section-title">ACTIVE FLAGS</div>
    <div id="dev-flag-dump" class="dev-dump"></div>
  </div>
</div>
`;

const PANEL_CSS = `
#dev-toggle {
  position: fixed;
  bottom: 8px;
  left: 8px;
  z-index: 9999;
  font: 600 9px/1 monospace;
  padding: 4px 7px;
  background: #1a0a00;
  color: #ff9030;
  border: 1px solid #ff6010;
  cursor: pointer;
  letter-spacing: 1px;
}
#dev-toggle:hover { background:#2a1400; }

#dev-panel {
  display: none;
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9998;
  width: 620px;
  max-height: 80vh;
  overflow-y: auto;
  background: #0d0800;
  border: 2px solid #ff6010;
  font: 9px/1 monospace;
  color: #d0a060;
  box-shadow: 0 0 40px #ff601040;
}
#dev-panel.open { display: block; }

#dev-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: #1a0800;
  border-bottom: 1px solid #ff6010;
  font-size: 10px;
  color: #ff9030;
  letter-spacing: 2px;
}
#dev-close {
  background: none; border: none; color: #ff6010; cursor: pointer;
  font-size: 12px; padding: 0;
}
#dev-close:hover { color: #ff2000; }

.dev-section {
  padding: 8px 10px;
  border-bottom: 1px solid #2a1800;
}
.dev-section:last-child { border-bottom: none; }
.dev-section-title {
  color: #ff7020;
  font-size: 8px;
  letter-spacing: 2px;
  margin-bottom: 6px;
}

.dev-btn-row { display: flex; flex-wrap: wrap; gap: 5px; }

button.dev-btn {
  font: 8px/1 monospace;
  padding: 4px 8px;
  cursor: pointer;
  border: 1px solid #503010;
  background: #1a0e00;
  color: #c08040;
  letter-spacing: 0.5px;
}
button.dev-btn:hover { background: #2a1800; border-color: #ff8030; color: #ffa050; }
button.dev-btn:disabled { opacity: 0.4; cursor: default; }
button.dev-btn.active { background: #1a2a00; border-color: #60c020; color: #80e030; }
button.dev-btn.danger { border-color: #a01010; color: #e04040; }
button.dev-btn.danger:hover { background: #2a0000; border-color: #ff2020; }
button.dev-btn.realm { border-color: #2050a0; color: #5090e0; }
button.dev-btn.realm:hover { background: #0a1830; border-color: #60a0ff; color: #80c0ff; }
button.dev-btn.realm.current { background: #0a1830; border-color: #60a0ff; color: #ffffff; }

.dev-flag-row {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 0;
  border-bottom: 1px solid #1a1000;
  flex-wrap: wrap;
}
.dev-flag-row:last-child { border-bottom: none; }
.dev-flag-label { color: #907050; font-size: 7px; min-width: 160px; }
button.dev-flag-btn {
  font: 7px/1 monospace; padding: 2px 6px; cursor: pointer;
  border: 1px solid #402000; background: #120800; color: #704020;
}
button.dev-flag-btn:hover { background: #200e00; }
button.dev-flag-btn.on { border-color: #40c040; background: #0a1a00; color: #60e060; }

.dev-dump {
  font-size: 6px; color: #504030; line-height: 2;
  max-height: 120px; overflow-y: auto;
  white-space: pre-wrap; word-break: break-all;
}
`;

// ── Realm definitions ─────────────────────────────────────

const REALMS = [
  {
    id: 'world', label: '🌍 EARTH',
    setup() {
      if (!G.bought) _grantBuyIn();
      G.px  = 2450; G.py = GND; G.pZ = 0;
      G.camX = Math.max(0, G.px - 390);
    },
  },
  {
    id: 'chamber', label: '⚰ CRYPT',
    setup() {
      if (!G.bought) _grantBuyIn();
      Flags.set('seven_heavens_done', true);
      Flags.set('crypt_entered', true);
      _ensurePlayerPyramid();
    },
  },
  {
    id: 'council', label: '🌌 COUNCIL',
    setup() {
      if (!G.bought) _grantBuyIn();
      _unlockCouncil();
    },
  },
];

// ── Flag toggles ──────────────────────────────────────────

const FLAG_GROUPS = [
  {
    label: 'Quest gates',
    flags: [
      { key: 'seven_heavens_done',  label: 'Seven Heavens done', side: _sideEffectSH  },
      { key: 'cosmic_upline_done',  label: 'Cosmic Upline done', side: _sideEffectCU  },
      { key: 'tier_omega_done',     label: 'Tier Omega done',    side: null           },
      { key: 'tier_omega_accepted', label: 'Tier Omega accepted',side: null           },
    ],
  },
  {
    label: 'Council',
    flags: [
      { key: 'archon_spoken',       label: 'Archon spoken'        },
      { key: 'council_entered',     label: 'Council entered'      },
    ],
  },
  {
    label: 'Crypt / Chief',
    flags: [
      { key: 'crypt_entered',    label: 'Crypt entered'      },
      { key: 'chief_spoken',     label: 'Chief spoken'       },
      { key: 'upline_accepted',  label: 'Upline accepted'    },
    ],
  },
];

function _sideEffectSH() {
  if (G.pyramids.length === 0) _ensurePlayerPyramid();
}
function _sideEffectCU() {
  Flags.set('seven_heavens_done', true);
}

// ── State cheat helpers ───────────────────────────────────

function _grantBuyIn() {
  G.bought = true;
  G.invested = 10;
  G.invitesLeft = 4;
  _ensurePlayerPyramid();
  updateStats(); updateSlots();
  log('[DEV] Granted buy-in.', '');
}

function _ensurePlayerPyramid() {
  if (!G.pyramids.find(p => p.isPlayer)) {
    const pp = mkPyr('player', 2450, 'YOU', true, 0);
    G.pyramids.push(pp);
    addLayer('player', 0, 'YOU');
  }
}

function _unlockCouncil() {
  _ensurePlayerPyramid();
  Flags.set('seven_heavens_done', true);
  Flags.set('cosmic_upline_done', true);
  Flags.set('upline_accepted', true);
  Flags.set('chief_spoken', true);
  Flags.set('crypt_entered', true);
}

function _grantWealth() {
  G.bought = true; G.invested = 10;
  G.earned += 500;
  _ensurePlayerPyramid();
  updateStats(); updateSlots();
  log('[DEV] +$500 earned.', '');
}

function _addLocalRecruit() {
  const depth = 1;
  const id    = 'dev_recruit_' + (G.recruits.length + 1);
  const r     = { name: 'DEV_' + (G.recruits.length + 1), depth, wx: 2450 + G.recruits.length * 80 };
  G.recruits.push(r);
  const rp = mkPyr(id, r.wx, r.name, false, 0);
  G.pyramids.push(rp);
  addLayer(id, depth, r.name);
  updateStats();
  log('[DEV] Added local recruit (no server write).', '');
}

function _growPlayerPyramid() {
  const pp = G.pyramids.find(p => p.isPlayer);
  if (!pp) { _ensurePlayerPyramid(); return; }
  const target = Math.min(pp.layers + 2, 20);
  while (pp.layers < target) addLayer(pp.id, 1, 'DEV');
  updateStats();
  log(`[DEV] Pyramid layers → ${pp.layers}`, '');
}

function _meetAllGods() {
  Flags.set('gods_met', 7);
  for (const g of ['ra','thoth','horus','anubis','shu','nut','amun']) {
    Flags.set(`${g}_spoken`, true);
  }
  log('[DEV] All gods met.', '');
}

function _resetAll() {
  Object.keys(Flags._store).forEach(k => delete Flags._store[k]);
  G.bought = false; G.invested = 0; G.earned = 0; G.invitesLeft = 0;
  G.recruits = []; G.pyramids = [];
  earthLayout.reset();
  G.px = 2450; G.py = GND; G.camX = 1970;
  updateStats(); updateSlots();
  RealmManager.transitionTo('world');
  log('[DEV] Full reset.', '');
  refreshPanel();
}

// ── Simulation helpers ────────────────────────────────────

let _simBusy = false;

function _simLog(msg, colour = '#506050') {
  const logEl = document.getElementById('dev-sim-log');
  if (!logEl) return;
  const line = document.createElement('div');
  line.style.color = colour;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.prepend(line);
  // Cap log at 20 lines
  while (logEl.children.length > 20) logEl.lastChild.remove();
}

async function _runSimRecruit() {
  if (_simBusy) return;
  if (!Api.hasToken()) {
    _simLog('Not authenticated — log in first.', '#e04040');
    return;
  }
  if (!G.bought) {
    _simLog('Buy in first before simulating recruits.', '#e04040');
    return;
  }

  const depth = parseInt(document.getElementById('dev-sim-depth').value, 10);
  const delay = parseFloat(document.getElementById('dev-sim-delay').value);
  const btn   = document.getElementById('dev-sim-btn');

  _simBusy      = true;
  btn.disabled  = true;
  btn.textContent = '⏳ SENDING…';

  try {
    const result = await Api.post('/api/dev/sim-recruit', {
      target_depth:  depth,
      delay_seconds: delay,
    });

    if (result.ok) {
      _simLog(`${result.message}`, '#a0c080');
      _simLog(`Watching for WS event in ~${delay}s…`, '#506050');
    } else {
      _simLog(`Error: ${result.detail || JSON.stringify(result)}`, '#e04040');
    }
  } catch (e) {
    _simLog(`Request failed: ${e.message}`, '#e04040');
  } finally {
    // Re-enable after the expected delay + a small buffer
    setTimeout(() => {
      _simBusy        = false;
      btn.disabled    = false;
      btn.textContent = '► SIM RECRUIT';
    }, (delay + 1) * 1000);
  }
}

async function _clearSimRecruits() {
  if (!Api.hasToken()) return;
  try {
    const result = await Api.del('/api/dev/sim-users');
    _simLog(`Cleared ${result.deleted ?? '?'} sim recruit row(s).`, '#c08040');
  } catch (e) {
    _simLog(`Clear failed: ${e.message}`, '#e04040');
  }
}

// ── Panel render ──────────────────────────────────────────

function refreshPanel() {
  const realmContainer = document.getElementById('dev-realms');
  if (realmContainer) {
    realmContainer.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('current', btn.dataset.realm === RealmManager.currentId);
    });
  }

  document.querySelectorAll('button.dev-flag-btn').forEach(btn => {
    const val = Flags.get(btn.dataset.flag);
    btn.classList.toggle('on', !!val);
    btn.textContent = val ? '✓ ON' : '✗ OFF';
  });

  const dump = document.getElementById('dev-flag-dump');
  if (dump) {
    const entries = Object.entries(Flags._store);
    dump.textContent = entries.length === 0
      ? '(no flags set)'
      : entries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n');
  }
}

// ── Public: called from main.js after auth ────────────────

/**
 * Call after login to show the simulation section and wire WS feedback.
 * @param {boolean} hasDebugEndpoint — true if /api/health returned debug:true
 */
export function devPanelSetAuthMode(hasDebugEndpoint) {
  const simSection = document.getElementById('dev-sim-section');
  if (!simSection) return;

  if (hasDebugEndpoint) {
    simSection.style.display = 'block';
    _simLog('Backend debug mode active — sim recruits enabled.', '#40d080');
  } else {
    simSection.style.display = 'block';
    document.getElementById('dev-sim-mode-badge').textContent = 'PROD';
    document.getElementById('dev-sim-mode-badge').style.color = '#e04040';
    document.getElementById('dev-sim-mode-badge').style.borderColor = '#e04040';
    document.getElementById('dev-sim-btn').disabled = true;
    document.getElementById('dev-sim-btn').title = '/api/dev/* not available in production';
    _simLog('Production mode — simulation disabled.', '#e04040');
  }
}

// ── Init ──────────────────────────────────────────────────

export function initDevPanel() {
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.id = 'dev-toggle';
  toggle.textContent = '⚠ DEV';
  document.body.appendChild(toggle);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = PANEL_HTML;
  document.body.appendChild(wrapper.firstElementChild);

  const panel = document.getElementById('dev-panel');

  // ── Simulation buttons ───────────────────────────────────
  document.getElementById('dev-sim-btn').addEventListener('click', _runSimRecruit);
  document.getElementById('dev-sim-clear').addEventListener('click', _clearSimRecruits);

  // ── Realm buttons ────────────────────────────────────────
  const realmRow = document.getElementById('dev-realms');
  for (const r of REALMS) {
    const btn = document.createElement('button');
    btn.className = 'dev-btn realm';
    btn.dataset.realm = r.id;
    btn.textContent = r.label;
    btn.onclick = () => {
      r.setup();
      RealmManager.transitionTo(r.id);
      log(`[DEV] Teleported to ${r.id}.`, '');
      refreshPanel();
    };
    realmRow.appendChild(btn);
  }

  // ── Flag toggles ─────────────────────────────────────────
  const flagsContainer = document.getElementById('dev-flags');
  for (const group of FLAG_GROUPS) {
    const groupEl = document.createElement('div');
    groupEl.style.cssText = 'margin-bottom:6px';
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#604020;font-size:6px;letter-spacing:1px;margin-bottom:3px';
    titleEl.textContent = group.label.toUpperCase();
    groupEl.appendChild(titleEl);

    for (const f of group.flags) {
      const row = document.createElement('div');
      row.className = 'dev-flag-row';
      const label = document.createElement('span');
      label.className = 'dev-flag-label';
      label.textContent = f.key;
      const btn = document.createElement('button');
      btn.className = 'dev-flag-btn';
      btn.dataset.flag = f.key;
      btn.textContent = Flags.get(f.key) ? '✓ ON' : '✗ OFF';
      if (Flags.get(f.key)) btn.classList.add('on');
      btn.onclick = () => {
        const newVal = !Flags.get(f.key);
        Flags.set(f.key, newVal);
        if (newVal && f.side) f.side();
        refreshPanel();
        log(`[DEV] ${f.key} → ${newVal}`, '');
      };
      row.appendChild(label);
      row.appendChild(btn);
      groupEl.appendChild(row);
    }
    flagsContainer.appendChild(groupEl);
  }

  // ── State cheat buttons ──────────────────────────────────
  const cheats = [
    { label: '💰 GRANT BUY-IN',     fn: _grantBuyIn          },
    { label: '💸 +$500 EARNED',     fn: _grantWealth         },
    { label: '👤 ADD LOCAL REC',    fn: _addLocalRecruit     },
    { label: '🔺 GROW PYRAMID +2',  fn: _growPlayerPyramid   },
    { label: '🌙 MEET ALL GODS',    fn: _meetAllGods         },
    { label: '💀 FULL RESET',       fn: _resetAll, danger: true },
  ];

  const cheatRow = document.getElementById('dev-cheats');
  for (const c of cheats) {
    const btn = document.createElement('button');
    btn.className = 'dev-btn' + (c.danger ? ' danger' : '');
    btn.textContent = c.label;
    btn.onclick = () => { c.fn(); refreshPanel(); };
    cheatRow.appendChild(btn);
  }

  // ── Toggle logic ──────────────────────────────────────────
  const openPanel  = () => { panel.classList.add('open');    refreshPanel(); };
  const closePanel = () =>   panel.classList.remove('open');
  const isOpen     = () =>   panel.classList.contains('open');

  toggle.onclick = () => isOpen() ? closePanel() : openPanel();
  document.getElementById('dev-close').onclick = closePanel;
  document.addEventListener('keydown', e => {
    if (e.key === '`') { isOpen() ? closePanel() : openPanel(); }
  });

  window.addEventListener('flag:change', refreshPanel);

  const origTransition = RealmManager.transitionTo.bind(RealmManager);
  RealmManager.transitionTo = (id) => {
    origTransition(id);
    if (isOpen()) refreshPanel();
  };

  log('[DEV] Dev panel loaded. Press ` to toggle.', '');
}
