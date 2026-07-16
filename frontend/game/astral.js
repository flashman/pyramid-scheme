// ── FILE: game/astral.js ──────────────────────────────────
// AstralSession — lifecycle manager for astral projection.
//
// Activation: player clicks a relic (astral_lens) in the inventory panel.
//   Opens a canvas downline overlay; player selects a recruit and confirms
//   with Enter/Space. Online recruits are projected into; offline recruits
//   are beckoned by email. Sends {type:"project_start"} over WS.
//
// Chat: passive by default — the #dlg panel shows a running log and the
//   player stays in movement mode. Press S (or click the panel) to
//   "speak": a text input is focused. Escape leaves chat mode (back to
//   walking) WITHOUT ending the session. A second Escape (projector only)
//   ends the session.
//
// NPC dialogue takeover: when a god/NPC dialogue opens, it owns #dlg.
//   Astral chat steps aside and buffers incoming messages; when the
//   dialogue closes, the chat panel reappears with the buffered lines.
//
// Deactivation: projector presses Escape while not typing, or the server
//   sends projection_ended (server-side expiry timer or target disconnects).
//
// Pose broadcast: 100ms interval while session is active.

import { G }                from './state.js';
import { Api }              from './api.js';
import { gameSocket }       from './ws.js';
import { PresenceStore }    from './presence.js';
import { mkPyr }            from './pyramids.js';
import { Events }           from '../engine/events.js';
import { X, CW, CH }        from '../engine/canvas.js';
import { COL }              from '../engine/colors.js';
import { RealmManager }     from '../engine/realm.js';
import { DialogueManager }  from '../engine/dialogue.js';
import { InAppKeyboard }    from '../ui/in-app-keyboard.js';
import { GND }              from '../worlds/earth/constants.js';

const IS_TOUCH = () => navigator.maxTouchPoints > 0;

const POSE_INTERVAL_MS = 100;
const MAX_CHAT_LINES   = 60;
// Session expiry is server-authoritative (ws.py schedules the timer and emits
// ws:projection_ended). The client ends only on that event or on ESC — no local
// countdown, so there's a single source of truth for "session over".
// PROJECTION_TTL_MS MUST match ws.py PROJECTION_TTL_SECONDS; the warning fires
// 15s before the end. These drive the upfront notice + the "vision thins" nudge.
const PROJECTION_TTL_MS  = 60_000;
const PROJECTION_WARN_MS = PROJECTION_TTL_MS - 15_000;
const PROJECTION_SECS    = Math.round(PROJECTION_TTL_MS / 1000);

class _AstralSession {
  constructor() {
    this._active        = false;
    this._overlayOpen   = false;
    this._downline      = [];
    this._selectedIdx   = 0;
    this._beckonStatus  = {};     // user_id → status string shown in overlay
    this._overlayCloseRect = null; // canvas hit-rect for the overlay's ✕ (set on render)
    this._poseTimer     = null;   // one pose loop, shared by host + projector modes
    this._warnTimer     = null;   // client-side "vision thins" pre-expiry nudge
    this._homeRealm     = null;
    this._hostMode      = false;
    this._saved         = null;   // snapshot of the projector's real world while away
    this._warp          = null;   // active gold-iris transition { startT, duration, pinchAt, onPinch, pinched }
    // Chat state
    this._peerName      = null;   // name shown in the chat panel header
    this._chatMode      = false;  // true while the text input is focused (typing)
    this._godActive     = false;  // true while a game dialogue has taken over #dlg
    this._dlgClaimed    = false;  // #dlg owned by another system (NPC/shop/riddle), session or not
    this._chatLines     = [];     // model of the chat log; survives the takeover
  }

  get isActive()    { return this._active; }
  get overlayOpen() { return this._overlayOpen; }

  init() {
    // ── Projector side ────────────────────────────────────────
    Events.on('ws:world_state', ({ realm, owner_username, recruits }) => {
      if (!this._active) this._activate();
      this._showChatPanel(owner_username);
      const target = realm || 'world';
      // Gold-iris warp: build + swap at the pinch so the effect covers the cut.
      this._startWarp(820, () => {
        this._buildProjectedWorld(recruits, owner_username, target);
        RealmManager.transitionTo(target);
      });
      Events.emit('game:log', { msg: `${this._speakVerb()} to speak  •  ESC to return`, cls: '' });
      Events.emit('game:log', { msg: '◈ you leave your body unattended', cls: 'mystic' });
      Events.emit('game:log', { msg: `◈ astral-projecting into ${owner_username}'s world…`, cls: 'mystic' });
      Events.emit('game:log', { msg: `◈ the lens holds ${PROJECTION_SECS} seconds — you bought the cheap one`, cls: 'mystic' });
    });

    Events.on('ws:host_realm_changed', ({ realm, world_state }) => {
      if (!this._active) return;
      // Snappier warp when following the host across a boundary.
      this._startWarp(560, () => {
        if (world_state) this._buildProjectedWorld(world_state.recruits, world_state.owner_username, realm);
        RealmManager.transitionTo(realm);
      });
    });

    // ── Host side (downline receiving a visitor) ───────────────
    Events.on('ws:projection_started', ({ from_username }) => {
      this._hostMode = true;
      this._startPose();
      this._armExpiryWarning();
      this._showChatPanel(from_username);
      Events.emit('game:log', { msg: `${this._speakVerb()} to speak with them`, cls: '' });
      Events.emit('game:log', { msg: `◈ the watcher lingers but ${PROJECTION_SECS} seconds`, cls: 'mystic' });
      Events.emit('game:log', { msg: `◈ ${from_username} is watching. for support.`, cls: 'mystic' });
      Events.emit('game:log', { msg: '◈ a presence stirs nearby…', cls: 'mystic' });
    });

    // ── Shared ────────────────────────────────────────────────
    Events.on('ws:projection_ended', ({ from_username }) => {
      if (this._hostMode) {
        this._hostMode = false;
        this._stopPose();
        this._clearExpiryWarning();
        PresenceStore.remove(from_username);   // fade the ghost out (don't pop)
        this._closeDlg();
        Events.emit('game:log', { msg: `◈ ${from_username} has left the meeting`, cls: 'mystic' });
      }
      this._deactivate();
    });

    Events.on('ws:chat_message', ({ from_username, text }) => {
      if (!this._active && !this._hostMode) return;
      this._appendChat(from_username, text);
    });

    // ── Game-dialogue takeover ────────────────────────────────
    // Any game dialogue that drives #dlg (gods/NPCs via DialogueManager, the
    // Nile shop, the Sphinx riddle) emits dialogue:start/end. It owns #dlg
    // exclusively while up; astral chat steps aside and buffers (the model
    // keeps recording; the DOM log is rebuilt when the dialogue closes).
    // Tracked unconditionally so a projection that *starts* mid-dialogue yields.
    Events.on('dialogue:start', () => {
      this._dlgClaimed = true;
      if (this._active || this._hostMode) {
        this._godActive = true;
        this._exitChatMode();
      }
    });
    Events.on('dialogue:end', () => {
      this._dlgClaimed = false;
      if (this._active || this._hostMode) {
        this._godActive = false;
        this._showChatPanel(this._peerName);
      }
    });

    // Peer presence — gated on session state so stale events after session end
    // don't re-populate PresenceStore (prevents ghost staying visible on exit).
    Events.on('ws:peer_entered', ({ username, px, py, pZ, facing, frame, is_projector }) => {
      if (this._active || this._hostMode)
        PresenceStore.upsert(username, { px, py, pZ, facing, frame, isProjector: !!is_projector });
    });
    Events.on('ws:peer_pose', ({ username, px, py, pZ, facing, frame }) => {
      if (this._active || this._hostMode)
        PresenceStore.upsert(username, { px, py, pZ, facing, frame });
    });
    Events.on('ws:peer_left', ({ username }) => {
      PresenceStore.remove(username);  // always remove — cleanup is idempotent
    });

    // Relic click in inventory panel.
    Events.on('inventory:use', ({ item_id }) => {
      if (item_id === 'astral_lens') this._openOverlay();
    });

    // Click / tap the chat panel to start speaking (mobile has no Enter key).
    document.getElementById('dlg')?.addEventListener('click', () => {
      if ((this._active || this._hostMode) && !this._godActive && !this._chatMode)
        this._enterChatMode();
    });

    // Click / tap the downline overlay's ✕ to close it (maps client→canvas coords
    // so it works under the CSS scaling the 780×540 canvas gets on small screens).
    document.getElementById('c')?.addEventListener('click', (e) => {
      const r = this._overlayCloseRect;
      if (!this._overlayOpen || !r) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (CW / rect.width);
      const py = (e.clientY - rect.top)  * (CH / rect.height);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)
        this._overlayOpen = false;
    });
  }

  onKeyDown(key) {
    if (this._warp)        return true;   // swallow input during the warp wipe
    if (this._overlayOpen) return this._overlayKeyDown(key);
    if (this._godActive)   return false;  // NPC dialogue owns input this frame
    if (this._chatMode)    return false;  // focused text input handles its own keys
    if (this._active || this._hostMode) {
      if (key === 's' || key === 'S') { this._enterChatMode(); return true; }
      if (key === 'Escape' && this._active) { this._end(); return true; }
    }
    return false;
  }

  // ── Chat panel in #dlg ────────────────────────────────────

  // Show the passive chat panel (log only, no focused input). Rebuilds the
  // visible log from the model so messages received during an NPC takeover
  // reappear when the dialogue closes.
  _showChatPanel(peerName) {
    this._peerName = peerName;
    // If a game dialogue currently owns #dlg, defer — dialogue:end re-shows us.
    if (this._dlgClaimed || DialogueManager.isActive()) { this._godActive = true; return; }

    const el        = document.getElementById('dlg');
    const speakerEl = document.getElementById('dlg-speaker');
    const textEl    = document.getElementById('dlg-text');
    const choicesEl = document.getElementById('dlg-choices');
    if (!el) return;

    DialogueManager.lockDlg();
    speakerEl.textContent = `🔮 ${peerName}`;
    textEl.style.cssText  = 'max-height:80px;overflow-y:auto;';
    textEl.innerHTML      = '';
    for (const ln of this._chatLines) this._appendLogLine(ln.speaker, ln.text);
    if (choicesEl) choicesEl.innerHTML = '';
    el.classList.add('active');
    this._chatMode = false;
    this._setPassiveHint();
  }

  // 'TAP' on touch (no S key), 'S' on desktop.
  _speakVerb() { return IS_TOUCH() ? 'TAP' : 'S'; }

  _setPassiveHint() {
    const hintEl = document.getElementById('dlg-hint');
    const speak  = `${this._speakVerb()} speak`;
    if (hintEl) hintEl.textContent = this._active ? `${speak}  •  ESC leave` : speak;
  }

  // Enter "speak" mode — show a text field and an on-screen keyboard.
  // Desktop: a focused <input> captures keys (stopPropagation). Touch: the
  // shared InAppKeyboard QWERTY drives a buffer (the same path the Sphinx
  // riddle uses — reliable on a canvas game where native focus is flaky).
  _enterChatMode() {
    if (this._godActive || this._chatMode) return;
    if (!this._active && !this._hostMode) return;
    const choicesEl = document.getElementById('dlg-choices');
    const textEl    = document.getElementById('dlg-text');
    const hintEl    = document.getElementById('dlg-hint');
    if (!textEl) return;

    this._chatMode = true;
    if (choicesEl) choicesEl.innerHTML = '';
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.maxLength    = 200;
    inp.placeholder  = '';   // wordless — just the native blinking caret
    // Same size as the sent lines, and pinned to the bottom of the log so it
    // reads as the next line of the conversation.
    inp.style.cssText = [
      'width:100%', 'background:transparent', 'border:none', 'padding:0',
      'display:block', 'color:#ffe066', 'outline:none', 'font-size:6px',
      'line-height:1.9', 'font-family:monospace', 'caret-color:#ffe066',
    ].join(';');
    textEl.appendChild(inp);
    textEl.scrollTop = textEl.scrollHeight;

    if (IS_TOUCH()) {
      // The native keyboard would fight the canvas — drive a buffer from the
      // in-app QWERTY instead and mirror it into the (read-only) display field.
      inp.readOnly = true;
      let buf = '', cur = 0;
      const sync = () => { inp.value = buf; };
      InAppKeyboard.open({
        onChar: (ch) => {
          if (ch === '\b') { if (cur > 0) { buf = buf.slice(0, cur - 1) + buf.slice(cur); cur--; } }
          else if (buf.length < 200) { buf = buf.slice(0, cur) + ch + buf.slice(cur); cur++; }
          sync();
        },
        onSubmit: () => {
          const text = buf.trim().slice(0, 200);
          buf = ''; cur = 0; sync();
          if (text) gameSocket.send({ type: 'chat', text });
        },
        onEscape: () => this._exitChatMode(),
        onCursor: (dir) => {
          if (dir === 'left')  cur = Math.max(0, cur - 1);
          if (dir === 'right') cur = Math.min(buf.length, cur + 1);
        },
      });
    } else {
      inp.addEventListener('keydown', e => {
        e.stopPropagation();  // keep typing out of the game's global key handler
        if (e.key === 'Enter') {
          const text = inp.value.trim().slice(0, 200);
          inp.value = '';
          if (text) gameSocket.send({ type: 'chat', text });
        } else if (e.key === 'Escape') {
          inp.blur();  // blur handler returns us to movement mode (session lives on)
        }
      });
      inp.addEventListener('blur', () => this._exitChatMode());
      inp.focus();
    }
    if (hintEl) hintEl.textContent = 'ENTER send  •  ESC done';
  }

  _exitChatMode() {
    if (!this._chatMode) return;
    this._chatMode = false;
    if (IS_TOUCH()) InAppKeyboard.close();
    document.getElementById('dlg-text')?.querySelector('input')?.remove();
    const choicesEl = document.getElementById('dlg-choices');
    if (choicesEl) choicesEl.innerHTML = '';
    this._setPassiveHint();
  }

  // Append to the model (always) and to the visible log (only when we own #dlg).
  _appendChat(speaker, text) {
    this._chatLines.push({ speaker, text });
    if (this._chatLines.length > MAX_CHAT_LINES) this._chatLines.shift();
    if (!this._godActive && !DialogueManager.isActive())
      this._appendLogLine(speaker, text);
  }

  _appendLogLine(speaker, text) {
    const textEl = document.getElementById('dlg-text');
    if (!textEl) return;
    const line = document.createElement('div');
    line.textContent   = `${speaker}: ${text}`;
    line.style.cssText = 'margin-bottom:2px;';
    const inp = textEl.querySelector('input');   // keep the input pinned below the messages
    if (inp) textEl.insertBefore(line, inp);
    else     textEl.appendChild(line);
    textEl.scrollTop = textEl.scrollHeight;
  }

  _closeDlg() {
    this._exitChatMode();   // tears down the on-screen keyboard if open
    DialogueManager.unlockDlg();
    this._chatMode  = false;
    this._godActive = false;
    this._chatLines = [];
    this._peerName  = null;
    const el = document.getElementById('dlg');
    if (el) el.classList.remove('active');
    const choicesEl = document.getElementById('dlg-choices');
    if (choicesEl) choicesEl.innerHTML = '';
    const textEl = document.getElementById('dlg-text');
    if (textEl) { textEl.innerHTML = ''; textEl.style.cssText = ''; }
  }

  // ── Overlay ───────────────────────────────────────────────

  _openOverlay() {
    this._beckonStatus = {};
    Api.get('/api/astral/downline').then(({ downline }) => {
      this._downline    = downline || [];
      this._selectedIdx = 0;
      this._overlayOpen = true;
    }).catch(() => {});
  }

  _overlayKeyDown(key) {
    const n = this._downline.length;
    if (key === 'Escape') { this._overlayOpen = false; return true; }
    if (key === 'ArrowUp')   { this._selectedIdx = ((this._selectedIdx - 1) + n) % Math.max(n, 1); return true; }
    if (key === 'ArrowDown') { this._selectedIdx = (this._selectedIdx + 1) % Math.max(n, 1); return true; }
    if (key === 'Enter' || key === ' ') {
      const target = this._downline[this._selectedIdx];
      if (!target) return true;
      if (target.online) this._start(target.user_id);
      else               this._beckon(target);
      return true;
    }
    return false;
  }

  // Email an offline recruit to come online. Server rate-limits to 1/hr.
  _beckon(target) {
    if (this._beckonStatus[target.user_id] === 'summoning...') return;
    this._beckonStatus[target.user_id] = 'summoning...';
    Api.post('/api/astral/beckon', { target_user_id: target.user_id })
      .then(res => {
        this._beckonStatus[target.user_id] = res?.ok ? 'summons sent' : (res?.detail || 'no answer');
        if (res?.ok)
          Events.emit('game:log', { msg: `◈ a vision is sent to ${target.username}`, cls: 'mystic' });
      })
      .catch(() => { this._beckonStatus[target.user_id] = 'no answer'; });
  }

  // ── Projected world ───────────────────────────────────────

  _buildProjectedWorld(recruits, ownerUsername, realm) {
    // Snapshot the projector's real world once, on first entry. Host realm
    // changes re-enter this to rebuild the projected scene, so guard against
    // clobbering the original snapshot with already-projected state.
    if (!this._saved) {
      this._saved = { pyramids: G.pyramids, px: G.px, py: G.py, camX: G.camX };
    }

    // Teleport projector to stand near the host's player pyramid.
    G.px   = 2350;
    G.py   = GND;
    G.camX = G.px - CW / 2;

    if (realm !== 'world') return;  // pyramids only live in the Desert

    // Build the host's pyramid set silently (direct mutation, no addLayer calls,
    // so particles/screenshake don't fire during a passive projection view).
    const hostPyr = mkPyr('proj_host', 2520, ownerUsername, true, 0);
    // Seed the capstone — the host is bought in so they always have at least 1 layer.
    hostPyr.layers = 1; hostPyr.tiers.push(1); hostPyr.names.push(ownerUsername);
    const newPyrs = [hostPyr];

    for (const r of (recruits || [])) {
      const { pid, wx, zLayer } = r.meta || {};
      if (!pid || wx == null) continue;
      if (newPyrs.find(p => p.id === pid)) continue;
      newPyrs.push(mkPyr(pid, wx, r.name, false, zLayer ?? 0));
    }

    for (const r of (recruits || [])) {
      const { pid, rootPid } = r.meta || {};
      const d = r.depth;

      const ownPyr = pid && newPyrs.find(p => p.id === pid);
      if (ownPyr) { ownPyr.layers++; ownPyr.tiers.push(d); ownPyr.names.push(r.name); }

      hostPyr.layers++; hostPyr.tiers.push(d); hostPyr.names.push(r.name);

      if (rootPid && rootPid !== pid) {
        const rp = newPyrs.find(p => p.id === rootPid);
        if (rp) { rp.layers++; rp.tiers.push(d); rp.names.push(r.name); }
      }
    }

    G.pyramids = newPyrs;
  }

  _restoreWorld() {
    if (!this._saved) return;
    G.pyramids = this._saved.pyramids;
    G.px       = this._saved.px;
    G.py       = this._saved.py;
    G.camX     = this._saved.camX;
    G.pvx      = 0;
    G.pvy      = 0;
    this._saved = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────

  // Single pose loop, shared by host and projector modes (start is idempotent).
  _startPose() {
    if (!this._poseTimer)
      this._poseTimer = setInterval(() => this._broadcastPose(), POSE_INTERVAL_MS);
  }

  _stopPose() {
    clearInterval(this._poseTimer);
    this._poseTimer = null;
  }

  _start(targetUserId) {
    this._homeRealm   = RealmManager.currentId;
    this._overlayOpen = false;
    gameSocket.send({ type: 'project_start', target_user_id: targetUserId });
    // _activate() fires on ws:world_state confirmation, not here.
  }

  _activate() {
    this._active = true;
    G.astralProjecting = true;   // render the local player as a spirit too
    this._startPose();
    this._armExpiryWarning();
  }

  // The session expiry is server-authoritative (ws.py). This is only a soft
  // heads-up 15s before that, on both sides — not a second source of truth.
  _armExpiryWarning() {
    this._clearExpiryWarning();
    this._warnTimer = setTimeout(() => {
      // POV-correct per side: the projector holds the failing lens; the host is
      // merely being visited.
      if (this._active)
        Events.emit('game:log', { msg: '◈ the lens is failing — circle back later', cls: 'mystic' });
      else if (this._hostMode)
        Events.emit('game:log', { msg: '◈ the presence grows faint…', cls: 'mystic' });
    }, PROJECTION_WARN_MS);
  }

  _clearExpiryWarning() {
    clearTimeout(this._warnTimer);
    this._warnTimer = null;
  }

  _end() {
    if (!this._active) return;
    gameSocket.send({ type: 'project_end' });
    this._deactivate();
  }

  _deactivate() {
    if (!this._active && !this._overlayOpen) return;
    const wasActive = this._active;
    this._active      = false;
    this._overlayOpen = false;
    this._stopPose();
    this._clearExpiryWarning();
    this._closeDlg();
    if (wasActive && this._homeRealm) {
      // Warp home: keep the host's world (and their ghost) visible through the
      // iris-close, then restore + swap at the pinch.
      const home = this._homeRealm;
      this._homeRealm = null;
      this._startWarp(820, () => {
        PresenceStore.clear();
        this._restoreWorld();
        G.astralProjecting = false;   // back in the flesh at the pinch
        RealmManager.transitionTo(home);
        Events.emit('game:log', { msg: '◈ you snap back into your body', cls: 'mystic' });
      });
    } else {
      G.astralProjecting = false;
      PresenceStore.clear();
      this._restoreWorld();
    }
  }

  // ── Gold-iris warp ────────────────────────────────────────
  // A self-contained transition: the scarab-gold eye closes over the world
  // you're leaving, swaps at the pinch (onPinch), then opens on the new world.
  // (RealmManager.scheduleTransition only does a one-way cover, so we render
  // our own two-phase iris in renderOverlay.)
  get isWarping() { return this._warp != null; }

  _startWarp(duration, onPinch) {
    // If a warp is still mid-flight and hasn't swapped yet, run its pending
    // swap now so superseding it can't drop a realm change.
    if (this._warp && !this._warp.pinched) this._warp.onPinch?.();
    this._warp = { startT: Date.now(), duration, pinchAt: 0.46, onPinch, pinched: false };
  }

  _renderWarp() {
    const w = this._warp;
    if (!w) return;
    const p = Math.min(1, (Date.now() - w.startT) / w.duration);

    // Fire the swap exactly once, at the pinch (screen fully covered).
    if (!w.pinched && p >= w.pinchAt) { w.pinched = true; w.onPinch?.(); }

    // Iris openness: closeFrac 0 = open (world visible), 1 = shut (covered).
    const closeFrac = p < w.pinchAt
      ? p / w.pinchAt
      : 1 - (p - w.pinchAt) / (1 - w.pinchAt);
    const s    = closeFrac * closeFrac * (3 - 2 * closeFrac);   // smoothstep
    const cx   = CW / 2, cy = CH / 2;
    const maxR = Math.hypot(CW, CH) / 2 + 8;
    const R    = Math.max(0, maxR * (1 - s));

    X.save();
    // Opaque warm cover everywhere outside the iris circle.
    X.beginPath();
    X.rect(0, 0, CW, CH);
    X.arc(cx, cy, R, 0, Math.PI * 2);
    X.fillStyle = 'rgba(10,6,0,0.97)';
    X.fill('evenodd');

    // Iris ring + glow at the eye's edge.
    if (R > 0.5) {
      X.beginPath();
      X.arc(cx, cy, R, 0, Math.PI * 2);
      X.lineWidth   = 5;
      X.strokeStyle = COL.GOLD;
      X.shadowColor = COL.GOLD_BRIGHT;
      X.shadowBlur  = 18;
      X.stroke();
      X.shadowBlur  = 0;
      X.lineWidth   = 1.5;
      X.strokeStyle = COL.GOLD_BRIGHT;
      X.stroke();
    }

    // Scarab-gold motes orbiting the iris edge.
    const tt = Date.now() / 1000;
    for (let i = 0; i < 16; i++) {
      const a  = (i / 16) * Math.PI * 2 + tt * 1.3 + i;
      const rr = R + Math.sin(tt * 2 + i) * 6;
      const mx = cx + Math.cos(a) * rr;
      const my = cy + Math.sin(a) * rr;
      X.fillStyle = i % 2 ? COL.GOLD_BRIGHT : COL.GOLD;
      const sz = i % 3 === 0 ? 2 : 1;
      X.fillRect(mx - sz / 2, my - sz / 2, sz, sz);
    }
    X.restore();

    if (p >= 1) this._warp = null;
  }

  _broadcastPose() {
    if (!gameSocket.isOpen) return;
    gameSocket.send({
      type:   'pose_update',
      px:     Math.round(G.px),
      py:     Math.round(G.py),
      pZ:     G.pZ,
      facing: G.facing,
      frame:  G.pframe,
    });
  }

  // Canvas overlay — drawn by whichever realm is active, after all scene content.
  renderOverlay() {
    if (this._overlayOpen) this._renderDownlineOverlay();
    this._renderWarp();   // on top of everything, including the overlay
  }

  _renderDownlineOverlay() {
    const lineH = 16;
    const pad   = 10;
    const rows  = Math.max(this._downline.length, 1);
    const w     = 320;
    const h     = pad * 2 + 20 + rows * lineH + 14;
    const ox    = Math.round((CW - w) / 2);
    const oy    = Math.round((CH - h) / 2);

    X.fillStyle = 'rgba(0,0,0,0.88)';
    X.fillRect(ox, oy, w, h);
    X.strokeStyle = COL.GOLD_DIM;
    X.lineWidth = 1;
    X.strokeRect(ox + 0.5, oy + 0.5, w - 1, h - 1);

    X.font = '7px monospace';
    X.fillStyle = COL.GOLD;
    X.fillText('ASTRAL LENS — PROJECT OR BECKON', ox + pad, oy + pad + 8);

    // Close ✕ (top-right) — clickable via the canvas handler in init().
    const clX = ox + w - 16, clY = oy + 5;
    this._overlayCloseRect = { x: clX - 4, y: clY, w: 20, h: 16 };
    X.font = '9px monospace';
    X.fillStyle = COL.GOLD_DIM;
    X.fillText('✕', clX, clY + 11);

    if (this._downline.length === 0) {
      X.fillStyle = '#777';
      X.font = '6px monospace';
      X.fillText('the sands are still — no soul stirs below you', ox + pad, oy + pad + 28);
    } else {
      this._downline.forEach((r, i) => {
        const y   = oy + pad + 24 + i * lineH;
        const sel = i === this._selectedIdx;
        X.fillStyle = sel ? COL.GOLD : (r.online ? '#aaa' : '#555');
        X.font = '6px monospace';
        const marker = sel ? '▶ ' : '  ';
        const status = r.online
          ? `[${r.realm || '?'}]`
          : (this._beckonStatus[r.user_id] || '(offline — ENTER to beckon)');
        X.fillText(`${marker}${r.username}  ${status}`, ox + pad, y);
      });
    }

    X.fillStyle = '#444';
    X.font = '5px monospace';
    X.fillText('↑↓ navigate   ENTER project / beckon   ✕ / ESC close', ox + pad, oy + h - pad + 2);
  }
}

export const AstralSession = new _AstralSession();
