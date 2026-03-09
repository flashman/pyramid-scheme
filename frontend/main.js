// ── FILE: main.js ────────────────────────────────────────
// Boot: register realms, quests, event listeners, start game loop.

import { RealmManager }           from './engine/realm.js';
import { Events }                 from './engine/events.js';
import { X, CW, CH }              from './engine/canvas.js';
import { COL }                    from './engine/colors.js';
import { G }                      from './game/state.js';
import { spawnParts, depthHex }   from './draw/utils.js';
import { say, buyIn, recruitFriend, restoreRecruits, addRecruit } from './game/recruits.js';
import { gameSocket }              from './game/ws.js';
import { updateInvitePanel }       from './ui/panels.js';
import { registerAllQuests }      from './game/quests.js';
import { Flags }                  from './engine/flags.js';
import { WorldRealm }             from './worlds/earth/WorldRealm.js';
import { ChamberRealm }           from './worlds/crypt/ChamberRealm.js';
import { CouncilRealm }           from './worlds/council/CouncilRealm.js';
import { OasisRealm }            from './worlds/oasis/OasisRealm.js';
import { VaultRealm }            from './worlds/oasis/VaultRealm.js';
import { AtlantisRealm }         from './worlds/atlantis/AtlantisRealm.js';
import { renderPayoutTable }      from './ui/config-editor.js';
import { loadConfig }             from './game/config.js';
import { updateStats, updateSlots, log } from './ui/panels.js';
import { initDevPanel, devPanelSetAuthMode } from './ui/dev-panel.js';
import { closeModal }             from './ui/modal.js';
import { GND }                    from './worlds/earth/constants.js';
import { LH }                     from './worlds/constants.js';
import { requireAuth }            from './ui/auth.js';
import { Api }                    from './game/api.js';
import { openProfile }            from './ui/profile.js';
import { SoundManager }           from './audio/sound.js';

// ── Realms ────────────────────────────────────────────────
RealmManager
  .register(new WorldRealm())
  .register(new ChamberRealm())
  .register(new CouncilRealm())
  .register(new OasisRealm())
  .register(new VaultRealm())
  .register(new AtlantisRealm());

// ── Quests ────────────────────────────────────────────────
registerAllQuests();

// ── Wire game:log event from engine → UI log function ─────
Events.on('game:log', ({ msg, cls }) => log(msg, cls));

// ── Event listeners (cross-system wiring lives HERE) ─────

Events.on('cosmic_upline_complete', () => {
  setTimeout(() => {
    log('★ Return to your pyramid. Climb to the capstone. Look up.', 'hi');
  }, 1200);
});

Events.on('tier_omega_complete', () => {
  G.shake = 14;
  spawnParts(G.px, G.py - 20, '#aa44ff', 60);
  G.shake = 8;
  spawnParts(G.px, G.py - 20, COL.GOLD, 50);
});

// 'pyramid:layer_added' is emitted by game/pyramids.js addLayer().
// Visual response (particles + screenshake) lives here to keep the game
// layer free of draw-layer imports.
Events.on('pyramid:layer_added', ({ wx, layers, depth, zLayer }) => {
  if (zLayer === 0) {
    G.shake = Math.max(1, 6 - depth * 0.6);
    spawnParts(wx, GND - layers * LH, depthHex(depth), Math.max(4, 22 - depth * 2));
  }
});

Events.on('tier_change', ({ tier }) => {
  if (tier.name !== 'PEASANT') {
    log(`✦ RANK UP: ${tier.name} ✦`, 'hi');
    say(tier.name + '!', 200);
  }
});

// ── Server sync: persist meaningful state changes ─────────
// Only sync events that actually need a server record.
// Don't fire-and-forget on every frame.

Events.on('buyin',    (payload) => Api.hasToken() && Api.logEvent('buyin',    payload));
Events.on('recruit',  (payload) => Api.hasToken() && Api.logEvent('recruit',  payload));
Events.on('milestone',(payload) => Api.hasToken() && Api.logEvent('milestone',payload));

// ── Input ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  G.keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  // Unblock browser autoplay policy on first keypress
  SoundManager.resume();
  // Don't forward key events during a realm transition animation.
  if (!RealmManager.isTransitioning) {
    RealmManager.current.onKeyDown(e.key);
  }
});

// ── Music: change theme when the active realm changes ─────
Events.on('realm:enter', ({ id }) => SoundManager.playRealm(id));
document.addEventListener('keyup', e => { G.keys[e.key] = false; });

// ── Expose UI callbacks referenced by inline HTML handlers ──
window.buyIn          = buyIn;
window.recruitFriend  = recruitFriend;
window.closeModal     = closeModal;
window.openProfile    = () => openProfile(Api, G, () => window.location.reload());

// Expose a quick-mute toggle for the sidebar button (no import needed in HTML)
window.toggleSound = () => {
  SoundManager.setEnabled(!SoundManager.enabled);
  const btn = document.getElementById('sound-btn');
  if (btn) btn.textContent = SoundManager.enabled ? '♪ MUSIC ON' : '✕ MUSIC OFF';
};

// ── Game loop ─────────────────────────────────────────────
function gameLoop(ts) {
  // Only update the current realm when no transition animation is playing.
  if (!RealmManager.isTransitioning) {
    RealmManager.current.update(ts);
  }

  // Tick the transition state machine — fires the actual realm swap when done.
  RealmManager.tickTransition();

  X.save();
  if (G.shake > 0) {
    X.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    G.shake = Math.max(0, G.shake - 0.7);
  }
  X.clearRect(0, 0, CW, CH);
  RealmManager.current.render();

  // Draw the transition overlay (if any) on top of the current render.
  RealmManager.renderTransition();

  X.restore();

  requestAnimationFrame(gameLoop);
}

// ── State hydration from /api/me ──────────────────────────
// Called once after login to restore server-owned state into G + Flags.

function _hydrateState(me) {
  if (!me || me.error) return;
  if (me.invested     != null) G.invested    = me.invested;
  if (me.earned       != null) G.earned      = me.earned;
  if (me.bought       != null) G.bought      = me.bought;
  if (me.invites_left != null) G.invitesLeft = me.invites_left;
  if (me.username)             G.username    = me.username;
  if (me.flags && typeof me.flags === 'object') {
    for (const [k, v] of Object.entries(me.flags)) {
      Flags._store[k] = v;  // bypass event bus to avoid sync-back loop
    }
  }
  log(`Welcome back, ${me.username}!`, 'hi');
}

// ── WebSocket event wiring ────────────────────────────────
// All real-time backend→frontend event handlers live here.
// Called once after login; does nothing if called without a token.

function _wireWsEvents(token) {
  gameSocket.connect(token);

  // A real user bought in somewhere in our downline — add their pyramid.
  Events.on('ws:recruit_joined', (evt) => {
    const parentRec = evt.parent_name
      ? G.recruits.find(r => r.name === evt.parent_name)
      : null;
    addRecruit(evt.name, evt.depth, parentRec, { dbId: evt.db_recruit_id });

    const simLog = document.getElementById('dev-sim-log');
    if (simLog) {
      const line = document.createElement('div');
      line.style.color = '#40d080';
      line.textContent = `[${new Date().toLocaleTimeString()}] ✓ ${evt.name} joined at D${evt.depth} (+$${evt.payout.toFixed(2)})`;
      simLog.prepend(line);
    }
  });

  // Server pushed an authoritative state snapshot (e.g. after buy-in).
  Events.on('ws:state_update', (evt) => {
    if (evt.bought       != null) G.bought      = evt.bought;
    if (evt.earned       != null) G.earned      = evt.earned;
    if (evt.invites_left != null) G.invitesLeft = evt.invites_left;
    if (evt.invested     != null) G.invested    = evt.invested;
    updateStats();
    updateSlots();
  });

  // An invitee registered (but hasn't bought in yet).
  Events.on('ws:invite_accepted', (evt) => {
    log(`✓ ${evt.email} registered as ${evt.recruit_username}!`, 'hi');
    Api.getInvites().then(data => {
      if (data.invites) updateInvitePanel(data.invites);
    }).catch(() => {});
  });
}

// ── State sync helpers ────────────────────────────────────
// Debounced flag/state push — consolidates rapid flag:change storms
// (e.g. quest completion firing 4 flags at once) into a single PUT.

let _syncTimer = null;
function scheduleSyncState() {
  if (!Api.hasToken()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    // Only sync client-driven state. bought/earned/invites_left are
    // server-owned and rejected by PUT /api/state.
    Api.syncState({ flags: Flags._store }).catch(() => {/* non-fatal */});
  }, 1500);
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  initDevPanel();

  // Show auth overlay and wait for login, register, or guest dismissal.
  const token = await requireAuth();

  if (token) {
    Api.setToken(token);
    G.isGuest = false;

    // Show profile button in title bar
    const profBtn = document.getElementById('profile-btn');
    if (profBtn) profBtn.style.display = 'inline-block';

    // Fetch server-owned payout config first, then render the table.
    await loadConfig(Api);
    renderPayoutTable();
    const me = await Api.loadMe();
    _hydrateState(me);

    // ── Restore pyramids and recruits from server ──────
    if (G.bought) {
      // Re-place the player's own capstone pyramid first
      const { mkPyr, addLayer } = await import('./game/pyramids.js');
      const { GND } = await import('./worlds/earth/constants.js');
      if (!G.pyramids.find(p => p.isPlayer)) {
        const pyr = mkPyr('player', 2520, 'YOU', true);
        G.pyramids.unshift(pyr);
        addLayer('player', 1, 'YOU');
        G.px = 2450; G.py = GND; G.camX = 2450 - CW/2; G.facing = 1;
        document.getElementById('bi').disabled = true;
        document.getElementById('rb').disabled = false;
        const il = document.getElementById('il');
        if (il) il.style.display = 'block';
      }

      const recruitsData = await Api.loadRecruits();
      if (recruitsData && recruitsData.recruits) {
        restoreRecruits(recruitsData.recruits);
        if (recruitsData.recruits.length > 0) {
          log(`Restored ${recruitsData.recruits.length} recruit(s) from the server.`, '');
        }
      }
    }

    // ── Wire state sync on meaningful events ──────────
    // Flag changes (quest completions, crypt unlock, milestones, etc.)
    Events.on('flag:change', scheduleSyncState);

    // Sync after recruit (earned total changed)
    Events.on('recruit', scheduleSyncState);

    // Sync invites_left after buy-in
    Events.on('buyin', scheduleSyncState);

    // Last-chance sync before the tab closes
    window.addEventListener('beforeunload', () => {
      if (Api.hasToken()) {
        // Only flags are client-settable; bought/earned/invites_left are server-owned.
        const payload = JSON.stringify({ flags: Flags._store });
        navigator.sendBeacon('/api/state', new Blob([payload], { type: 'application/json' }));
      }
    });

    // ── WebSocket: connect and wire real-time events ───
    _wireWsEvents(token);

    // Load and render invite panel on login
    Api.getInvites().then(data => {
      if (data.invites) updateInvitePanel(data.invites);
    }).catch(() => {});

    // ── Dev panel: check if backend debug mode is on ───
    Api.get('/api/health').then(h => {
      devPanelSetAuthMode(h.debug === true);
    }).catch(() => devPanelSetAuthMode(false));

  } else {
    G.isGuest = true;
    log('Playing as guest — progress will not be saved.', '');
  }

  updateStats();
  updateSlots();
  log('Welcome, future Pharaoh!', 'hi');
  log('Click BUY IN to place your capstone!', '');
  Events.emit('game:started', {});

  // Start the desert theme. The AudioContext may be suspended until the first
  // key/click — SoundManager.resume() handles that transparently.
  SoundManager.playRealm('world');

  requestAnimationFrame(gameLoop);
}

init();
