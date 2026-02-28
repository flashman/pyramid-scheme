// ── FILE: main.js ────────────────────────────────────────
// Boot: register realms, quests, event listeners, start game loop.

import { RealmManager }           from './engine/realm.js';
import { Events }                 from './engine/events.js';
import { X, CW, CH }              from './engine/canvas.js';
import { COL }                    from './engine/colors.js';
import { G }                      from './game/state.js';
import { spawnParts, depthHex }   from './draw/utils.js';
import { say, buyIn, recruitFriend } from './game/recruits.js';
import { registerAllQuests }      from './game/quests.js';
import { WorldRealm }             from './worlds/earth/WorldRealm.js';
import { ChamberRealm }           from './worlds/crypt/ChamberRealm.js';
import { CouncilRealm }           from './worlds/council/CouncilRealm.js';
import { renderPayoutTable }      from './ui/config-editor.js';
import { openConfig, closeConfig, validateConfig, applyConfig } from './ui/config-editor.js';
import { updateStats, updateSlots, log } from './ui/panels.js';
import { initDevPanel }           from './ui/dev-panel.js';
import { closeModal }             from './ui/modal.js';
import { GND }                    from './worlds/earth/constants.js';
import { LH }                     from './worlds/constants.js';
import { requireAuth }            from './ui/auth.js';
import { Api }                    from './game/api.js';

// ── Realms ────────────────────────────────────────────────
RealmManager
  .register(new WorldRealm())
  .register(new ChamberRealm())
  .register(new CouncilRealm());

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
  // Don't forward key events during a realm transition animation.
  if (!RealmManager.isTransitioning) {
    RealmManager.current.onKeyDown(e.key);
  }
});
document.addEventListener('keyup', e => { G.keys[e.key] = false; });

// ── Expose UI callbacks referenced by inline HTML handlers ──
window.buyIn          = buyIn;
window.recruitFriend  = recruitFriend;
window.openConfig     = openConfig;
window.closeConfig    = closeConfig;
window.validateConfig = validateConfig;
window.applyConfig    = applyConfig;
window.closeModal     = closeModal;

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

// ── Init ──────────────────────────────────────────────────
async function init() {
  renderPayoutTable();
  initDevPanel();

  // Show auth overlay and wait for login, register, or guest dismissal.
  const token = await requireAuth();

  if (token) {
    Api.setToken(token);
    G.isGuest = false;

    // Load saved state from server and merge into G.
    const me = await Api.loadMe();
    if (me && !me.error) {
      if (me.invested     != null) G.invested    = me.invested;
      if (me.earned       != null) G.earned      = me.earned;
      if (me.bought       != null) G.bought      = me.bought;
      if (me.invites_left != null) G.invitesLeft = me.invites_left;  // snake_case from server
      if (me.username)             G.username    = me.username;
      log(`Welcome back, ${me.username}!`, 'hi');
    }
  } else {
    G.isGuest = true;
    log('Playing as guest — progress will not be saved.', '');
  }

  updateStats();
  updateSlots();
  log('Welcome, future Pharaoh!', 'hi');
  log('Click BUY IN to place your capstone!', '');
  Events.emit('game:started', {});
  requestAnimationFrame(gameLoop);
}

init();
