// ── FILE: main.js ────────────────────────────────────────
// Boot: register realms, quests, wire cross-system events, start game loop.
// Authenticated session setup lives in game/session.js.

import { RealmManager }           from './engine/realm.js';
import { Events }                 from './engine/events.js';
import { X, CW, CH }              from './engine/canvas.js';
import { COL }                    from './engine/colors.js';
import { G }                      from './game/state.js';
import { spawnParts, depthHex }   from './draw/utils.js';
import { say, buyIn, recruitFriend } from './game/recruits.js';
import { GameSession }            from './game/session.js';
import { registerAllQuests }      from './game/quests.js';
import { ALL_REALMS }             from './worlds/manifest.js';
import { updateStats, updateSlots, log } from './ui/panels.js';
import { initDevPanel, devPanelSetAuthMode } from './ui/dev-panel.js';
import { closeModal }             from './ui/modal.js';
import { GND }                    from './worlds/earth/constants.js';
import { LH }                     from './worlds/constants.js';
import { requireAuth }            from './ui/auth.js';
import { waitForBackend }         from './ui/loading-hourglass.js';
import { initMobileControls }    from './ui/mobile-controls.js';
import { Api }                    from './game/api.js';
import { loadConfig }             from './game/config.js';
import { renderPayoutTable }      from './ui/config-editor.js';
import { openProfile }            from './ui/profile.js';
import { SoundManager }           from './audio/sound.js';
import { AstralSession }          from './game/astral.js';
import { gameSocket }             from './game/ws.js';
import { initInventoryPanel }     from './ui/inventory-panel.js';

// ── Realms ────────────────────────────────────────────────
// Realm instances are created in worlds/manifest.js.
// Portal connections are registered inside each realm's constructor.
// To add a new realm, edit manifest.js only — main.js never changes.
ALL_REALMS.forEach(r => RealmManager.register(r));

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
  // Suppress movement-key state while typing an astral message (the keys feed
  // the chat buffer instead — see AstralSession.onKeyDown / _chatKey).
  if (!AstralSession.chatMode) G.keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  // Unblock browser autoplay policy on first keypress
  SoundManager.resume();
  // Don't forward key events during a realm transition animation.
  if (!RealmManager.isTransitioning) {
    // preventDefault on consumed keys so e.g. the 'S' that opens astral chat
    // isn't also typed into the input it just focused.
    if (AstralSession.onKeyDown(e.key)) {
      e.preventDefault();
    } else {
      RealmManager.current.onKeyDown(e.key);
    }
  }
});

// ── Music + WS channel: fire when active realm changes ────
Events.on('realm:enter', ({ id }) => {
  SoundManager.playRealm(id);
  // Suppress realm_enter during projection — admin is in flop's channel and must stay there.
  // _activate() sets isActive before transitionTo fires, so this guard is safe.
  if (G.userId != null && !AstralSession.isActive) {
    gameSocket.send({ type: 'realm_enter', realm: id, owner_id: G.userId });
  }
});
document.addEventListener('keyup', e => { G.keys[e.key] = false; });


// ── Help panel ────────────────────────────────────────────
function _toggleHelp() {
  document.getElementById('help-panel')?.classList.toggle('open');
}
document.addEventListener('keydown', e => {
  // Astral chat rides the global keydown path (no stopPropagation), so guard
  // this listener while typing — otherwise '`' would both type and toggle help.
  if (AstralSession.chatMode) return;
  if (e.key === '`') { e.preventDefault(); _toggleHelp(); return; }
  if (e.key === 'Escape') {
    const hp = document.getElementById('help-panel');
    if (hp?.classList.contains('open')) { hp.classList.remove('open'); e.preventDefault(); }
  }
});

// ── Expose UI callbacks referenced by inline HTML handlers ──
window.buyIn          = buyIn;
window.recruitFriend  = recruitFriend;
window.closeModal     = closeModal;
window.openProfile    = () => openProfile(Api, G, () => window.location.reload());
window.toggleHelp     = _toggleHelp;

// Expose a quick-mute toggle for the sidebar button (no import needed in HTML)
window.toggleSound = () => {
  SoundManager.setEnabled(!SoundManager.enabled);
  const on = SoundManager.enabled;
  const note  = document.getElementById('sound-note');
  const glyph = document.getElementById('sound-glyph');
  if (note)  { note.textContent = on ? '♪' : '✕'; note.classList.toggle('off', !on); }
  if (glyph) { glyph.classList.toggle('off', !on); }
};

// ── Header button alignment ───────────────────────────────
// Pins #hdr-actions right edge to #rp right edge — even when #rp overflows off-screen.
// Uses getBoundingClientRect() so the 780px canvas border overflow is measured, not guessed.
// No Math.max clamp: negative right values are intentional (pushes buttons off-screen with #rp).
function _alignHdrActions() {
  const rp = document.getElementById('rp');
  const ha = document.getElementById('hdr-actions');
  const tb = document.getElementById('title-bar');
  if (!rp || !ha || !tb) return;
  // right is relative to title-bar's right edge, not window.innerWidth —
  // the body may expand past the viewport when game-wrapper overflows.
  ha.style.right = (tb.getBoundingClientRect().right - rp.getBoundingClientRect().right) + 'px';
}
document.fonts.ready.then(_alignHdrActions);
window.addEventListener('resize', _alignHdrActions);

// ── Game loop ─────────────────────────────────────────────
function gameLoop(ts) {
  // Only update the current realm when no transition animation is playing
  // (RealmManager swaps, or the astral warp wipe).
  if (!RealmManager.isTransitioning && !AstralSession.isWarping) {
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
  AstralSession.renderOverlay();

  // Draw the transition overlay (if any) on top of the current render.
  RealmManager.renderTransition();

  X.restore();

  requestAnimationFrame(gameLoop);
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  await waitForBackend();
  initMobileControls();
  initDevPanel();
  const token = await requireAuth();

  if (token) {
    await new GameSession(token).start();
    AstralSession.init();
  } else {
    G.isGuest = true;
    log('Playing as guest — progress will not be saved.', '');
    await loadConfig(Api);
    renderPayoutTable();
    Api.get('/api/health')
      .then(h => devPanelSetAuthMode(h.debug === true))
      .catch(() => devPanelSetAuthMode(false));
  }

  initInventoryPanel();
  updateStats();
  updateSlots();
  log('Welcome, future Pharaoh!', 'hi');
  log('Click BUY IN to place your capstone!', '');
  Events.emit('game:started', {});

  document.getElementById('boot-screen')?.remove();
  SoundManager.playRealm('world');
  requestAnimationFrame(gameLoop);
}

init();
