// ── FILE: game/astral.js ──────────────────────────────────
// AstralSession — lifecycle manager for astral projection.
//
// Activation: player clicks astral_lens in inventory panel.
//   Opens a canvas downline overlay; player selects an online recruit and
//   confirms with Enter. Sends {type:"project_start"} over WS.
//
// Chat: Space when near a peer ghost opens the main #dlg window for a
//   one-shot message. Incoming messages from either party display there too.
//
// Deactivation: player presses Escape during session, or server sends
//   projection_ended (180s server-side timer or target disconnects).
//
// Pose broadcast: 100ms interval while session is active.

import { G }                from './state.js';
import { Api }              from './api.js';
import { gameSocket }       from './ws.js';
import { PresenceStore }    from './presence.js';
import { Inventory }        from './inventory.js';
import { mkPyr }            from './pyramids.js';
import { Events }           from '../engine/events.js';
import { X, CW, CH }        from '../engine/canvas.js';
import { COL }              from '../engine/colors.js';
import { RealmManager }     from '../engine/realm.js';
import { DialogueManager }  from '../engine/dialogue.js';
import { GND }              from '../worlds/earth/constants.js';

const POSE_INTERVAL_MS    = 100;
const SESSION_DURATION_MS = 180_000;

class _AstralSession {
  constructor() {
    this._active        = false;
    this._overlayOpen   = false;
    this._downline      = [];
    this._selectedIdx   = 0;
    this._poseTimer     = null;
    this._sessionTimer  = null;
    this._homeRealm     = null;
    this._hostMode      = false;
    this._hostPoseTimer = null;
    this._savedPyramids = null;
    this._savedPx       = null;
    this._savedPy       = null;
    this._savedCamX     = null;
  }

  get isActive()    { return this._active; }
  get overlayOpen() { return this._overlayOpen; }

  init() {
    // ── Projector side ────────────────────────────────────────
    Events.on('ws:world_state', ({ realm, owner_username, recruits }) => {
      if (!this._active) this._activate();
      this._openAstralDlg(owner_username);
      this._buildProjectedWorld(recruits, owner_username, realm || 'world');
      RealmManager.transitionTo(realm || 'world');
      Events.emit('game:log', { msg: `🔮 Projecting into ${owner_username}'s world...`, cls: 'hi' });
      Events.emit('game:log', { msg: 'ENTER to chat  •  ESC to return home', cls: '' });
    });

    Events.on('ws:host_realm_changed', ({ realm, world_state }) => {
      if (!this._active) return;
      if (world_state) this._buildProjectedWorld(world_state.recruits, world_state.owner_username, realm);
      RealmManager.transitionTo(realm);
    });

    // ── Host side (downline receiving a visitor) ───────────────
    Events.on('ws:projection_started', ({ from_username }) => {
      this._hostMode = true;
      this._hostPoseTimer = setInterval(() => this._broadcastPose(), POSE_INTERVAL_MS);
      this._openAstralDlg(from_username);
      Events.emit('game:log', { msg: `🔮 ${from_username} is watching...`, cls: 'hi' });
      Events.emit('game:log', { msg: 'ENTER to chat with them', cls: '' });
    });

    // ── Shared ────────────────────────────────────────────────
    Events.on('ws:projection_ended', ({ from_username }) => {
      if (this._hostMode) {
        this._hostMode = false;
        clearInterval(this._hostPoseTimer);
        this._hostPoseTimer = null;
        PresenceStore.clear();
        this._closeDlg();
        Events.emit('game:log', { msg: `🔮 ${from_username} has returned to their realm.`, cls: '' });
      }
      this._deactivate();
    });

    Events.on('ws:chat_message', ({ from_username, text }) => {
      if (!this._active && !this._hostMode) return;
      this._appendChat(from_username, text);
    });

    // Peer presence — gated on session state so stale events after session end
    // don't re-populate PresenceStore (prevents ghost staying visible on exit).
    Events.on('ws:peer_entered', ({ username, px, py, pZ, facing, frame }) => {
      if (this._active || this._hostMode)
        PresenceStore.upsert(username, { px, py, pZ, facing, frame });
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
  }

  onKeyDown(key) {
    if (this._chatInputOpen()) return false;  // DOM input handles Enter/Escape via stopPropagation
    if (this._overlayOpen)     return this._overlayKeyDown(key);
    if (this._active || this._hostMode) {
      if (key === 'Enter' && !DialogueManager.isActive()) {
        // Re-focus the always-visible input if the user clicked away from it.
        const inp = document.getElementById('dlg-choices')?.querySelector('input');
        if (inp) { inp.focus(); return true; }
      }
      if (key === 'Escape' && this._active) { this._end(); return true; }
    }
    return false;
  }

  // ── Persistent chat log in #dlg ──────────────────────────

  _openAstralDlg(peerName) {
    if (DialogueManager.isActive()) return;
    const el        = document.getElementById('dlg');
    const speakerEl = document.getElementById('dlg-speaker');
    const textEl    = document.getElementById('dlg-text');
    const choicesEl = document.getElementById('dlg-choices');
    const hintEl    = document.getElementById('dlg-hint');
    if (!el) return;

    DialogueManager.lockDlg();
    speakerEl.textContent = `🔮 ${peerName}`;
    textEl.innerHTML      = '';
    textEl.style.cssText  = 'max-height:80px;overflow-y:auto;';
    hintEl.textContent    = 'ESC to leave';
    el.classList.add('active');

    // Always-visible input — focus immediately so typing works right away.
    choicesEl.innerHTML = '';
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.maxLength   = 200;
    inp.placeholder = 'say something...';
    inp.style.cssText = [
      'width:100%', 'background:transparent', 'border:none',
      'color:#ffe066', 'outline:none', 'font-size:11px',
      'font-family:monospace', 'caret-color:#ffe066',
    ].join(';');
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Escape') e.stopPropagation(); // let Escape bubble for session end
      if (e.key === 'Enter') {
        const text = inp.value.trim().slice(0, 200);
        inp.value = '';
        if (text) gameSocket.send({ type: 'chat', text });
      } else if (e.key === 'Escape') {
        inp.blur();
      }
    });
    choicesEl.appendChild(inp);
    inp.focus();
  }

  _appendChat(speaker, text) {
    if (DialogueManager.isActive()) return;
    const textEl = document.getElementById('dlg-text');
    if (!textEl) return;
    const line = document.createElement('div');
    line.textContent   = `${speaker}: ${text}`;
    line.style.cssText = 'margin-bottom:2px;';
    textEl.appendChild(line);
    textEl.scrollTop = textEl.scrollHeight;
    // Re-focus input after incoming message so typing continues uninterrupted.
    document.getElementById('dlg-choices')?.querySelector('input')?.focus();
  }

  _closeDlg() {
    if (DialogueManager.isActive()) return;
    DialogueManager.unlockDlg();
    const el = document.getElementById('dlg');
    if (!el) return;
    el.classList.remove('active');
    const choicesEl = document.getElementById('dlg-choices');
    if (choicesEl) { choicesEl.innerHTML = ''; }
    const textEl = document.getElementById('dlg-text');
    if (textEl) { textEl.innerHTML = ''; textEl.style.cssText = ''; }
  }

  _chatInputOpen() {
    const inp = document.getElementById('dlg-choices')?.querySelector('input');
    return inp === document.activeElement;
  }

  // ── Overlay ───────────────────────────────────────────────

  _openOverlay() {
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
      if (target?.online) this._start(target.user_id);
      return true;
    }
    return false;
  }

  // ── Projected world ───────────────────────────────────────

  _buildProjectedWorld(recruits, ownerUsername, realm) {
    // Save projector's current state for restoration on exit.
    this._savedPyramids = G.pyramids;
    this._savedPx       = G.px;
    this._savedPy       = G.py;
    this._savedCamX     = G.camX;

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
    if (this._savedPyramids !== null) {
      G.pyramids = this._savedPyramids;
      this._savedPyramids = null;
    }
    if (this._savedPx !== null) {
      G.px   = this._savedPx;
      G.py   = this._savedPy;
      G.camX = this._savedCamX;
      this._savedPx = this._savedPy = this._savedCamX = null;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────

  _start(targetUserId) {
    this._homeRealm   = RealmManager.currentId;
    this._overlayOpen = false;
    gameSocket.send({ type: 'project_start', target_user_id: targetUserId });
    // _activate() fires on ws:world_state confirmation, not here.
  }

  _activate() {
    this._active    = true;
    this._poseTimer = setInterval(() => this._broadcastPose(), POSE_INTERVAL_MS);
    this._sessionTimer = setTimeout(() => this._deactivate(), SESSION_DURATION_MS);
  }

  _end() {
    if (!this._active) return;
    gameSocket.send({ type: 'project_end' });
    this._deactivate();
  }

  _deactivate() {
    if (!this._active && !this._overlayOpen) return;
    this._active      = false;
    this._overlayOpen = false;
    clearInterval(this._poseTimer);
    clearTimeout(this._sessionTimer);
    this._poseTimer    = null;
    this._sessionTimer = null;
    PresenceStore.clear();
    DialogueManager.unlockDlg();
    document.getElementById('dlg')?.classList.remove('active');
    this._restoreWorld();
    if (this._homeRealm) {
      RealmManager.transitionTo(this._homeRealm);
      this._homeRealm = null;
      Events.emit('game:log', { msg: 'Returned to your realm.', cls: '' });
    }
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
    if (!this._overlayOpen) return;

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
    X.fillText('ASTRAL LENS — SELECT RECRUIT', ox + pad, oy + pad + 8);

    if (this._downline.length === 0) {
      X.fillStyle = '#777';
      X.font = '6px monospace';
      X.fillText('no recruits online', ox + pad, oy + pad + 28);
    } else {
      this._downline.forEach((r, i) => {
        const y   = oy + pad + 24 + i * lineH;
        const sel = i === this._selectedIdx;
        X.fillStyle = sel ? COL.GOLD : (r.online ? '#aaa' : '#555');
        X.font = '6px monospace';
        const marker = sel ? '▶ ' : '  ';
        const status = r.online ? `[${r.realm || '?'}]` : '(offline)';
        X.fillText(`${marker}${r.username}  ${status}`, ox + pad, y);
      });
    }

    X.fillStyle = '#444';
    X.font = '5px monospace';
    X.fillText('↑↓ navigate  ENTER project  ESC cancel', ox + pad, oy + h - pad + 2);
  }
}

export const AstralSession = new _AstralSession();
