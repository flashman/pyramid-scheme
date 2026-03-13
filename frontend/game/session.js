// ── FILE: game/session.js ─────────────────────────────────
// GameSession — owns the entire authenticated-user lifecycle.
//
// Responsibilities:
//   • Hydrating G + Flags from /api/me
//   • Restoring the player's pyramid and recruits from the server
//   • Wiring WebSocket events onto the Events bus
//   • Scheduling debounced state-sync pushes to /api/state
//   • Loading the invite panel
//   • Checking backend debug mode for the dev panel
//
// Usage (called once from main.js after requireAuth resolves):
//   import { GameSession } from './game/session.js';
//   await new GameSession(token).start();

import { Events }              from '../engine/events.js';
import { Flags }               from '../engine/flags.js';
import { CW }                  from '../engine/canvas.js';
import { G }                   from './state.js';
import { Api }                 from './api.js';
import { gameSocket }          from './ws.js';
import { loadConfig }          from './config.js';
import { addRecruit, restoreRecruits } from './recruits.js';
import { renderPayoutTable }   from '../ui/config-editor.js';
import { updateStats, updateSlots, log, updateInvitePanel } from '../ui/panels.js';
import { devPanelSetAuthMode } from '../ui/dev-panel.js';

export class GameSession {
  constructor(token) {
    this._token     = token;
    this._syncTimer = null;
  }

  // ── Public entry point ───────────────────────────────────
  async start() {
    Api.setToken(this._token);
    G.isGuest = false;

    // Show profile button in title bar
    const profBtn = document.getElementById('profile-btn');
    if (profBtn) profBtn.style.display = 'inline-block';

    // Server-authoritative config must load before the payout table renders.
    await loadConfig(Api);
    renderPayoutTable();

    const me = await Api.loadMe();
    this._hydrateState(me);

    if (G.bought) {
      await this._restorePlayerWorld();
    }

    this._wireStateSyncEvents();
    this._wireBeforeUnload();
    this._wireWsEvents();

    // Non-critical: invite panel and dev-panel mode; don't await.
    Api.getInvites()
      .then(data => { if (data.invites) updateInvitePanel(data.invites); })
      .catch(() => {});

    Api.get('/api/health')
      .then(h => devPanelSetAuthMode(h.debug === true))
      .catch(() => devPanelSetAuthMode(false));
  }

  // ── State hydration ──────────────────────────────────────
  // Populates G and Flags from the /api/me response.

  _hydrateState(me) {
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

  // ── World restoration ────────────────────────────────────
  // Re-places the player's pyramid and all recruits from the server.

  async _restorePlayerWorld() {
    const { mkPyr, addLayer } = await import('./pyramids.js');
    const { GND }             = await import('../worlds/earth/constants.js');

    if (!G.pyramids.find(p => p.isPlayer)) {
      const pyr = mkPyr('player', 2520, 'YOU', true);
      G.pyramids.unshift(pyr);
      addLayer('player', 1, 'YOU');
      G.px = 2450; G.py = GND; G.camX = 2450 - CW / 2; G.facing = 1;
      document.getElementById('bi').disabled = true;
      document.getElementById('rb').disabled = false;
      const il = document.getElementById('il');
      if (il) il.style.display = 'block';
    }

    const recruitsData = await Api.loadRecruits();
    if (recruitsData?.recruits) {
      restoreRecruits(recruitsData.recruits);
      if (recruitsData.recruits.length > 0) {
        log(`Restored ${recruitsData.recruits.length} recruit(s) from the server.`, '');
      }
    }
  }

  // ── State sync ───────────────────────────────────────────
  // Debounced push of client-owned state to /api/state.
  // Consolidates rapid flag:change storms (e.g. quest completion)
  // into a single PUT.

  _scheduleSyncState() {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => {
      Api.syncState({ flags: Flags._store }).catch(() => {/* non-fatal */});
    }, 1500);
  }

  _wireStateSyncEvents() {
    const sync = () => this._scheduleSyncState();
    Events.on('flag:change', sync);
    Events.on('recruit',     sync);
    Events.on('buyin',       sync);
  }

  _wireBeforeUnload() {
    window.addEventListener('beforeunload', () => {
      // Only flags are client-settable; bought/earned/invites_left are server-owned.
      const payload = JSON.stringify({ flags: Flags._store });
      navigator.sendBeacon('/api/state', new Blob([payload], { type: 'application/json' }));
    });
  }

  // ── WebSocket events ─────────────────────────────────────
  // All real-time backend → frontend handlers.

  _wireWsEvents() {
    gameSocket.connect(this._token);

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
      Api.getInvites()
        .then(data => { if (data.invites) updateInvitePanel(data.invites); })
        .catch(() => {});
    });
  }
}
