// ── FILE: game/astral.js ──────────────────────────────────
// AstralSession — lifecycle manager for astral projection.
//
// Activation: player presses 'a' while owning astral_lens.
//   Opens a canvas downline overlay; player selects an online recruit and
//   confirms with Enter. Sends {type:"project_start"} over WS.
//
// Deactivation: player presses Escape during session, or server sends
//   projection_ended (180s server-side timer or target disconnects).
//
// Pose broadcast: 100ms interval while session is active.

import { G }             from './state.js';
import { Api }           from './api.js';
import { gameSocket }    from './ws.js';
import { AstralChat }    from './astral-chat.js';
import { PresenceStore } from './presence.js';
import { Inventory }     from './inventory.js';
import { Events }        from '../engine/events.js';
import { X, CW, CH }     from '../engine/canvas.js';
import { COL }           from '../engine/colors.js';
import { RealmManager }  from '../engine/realm.js';

const POSE_INTERVAL_MS    = 100;
const SESSION_DURATION_MS = 180_000;

class _AstralSession {
  constructor() {
    this._active      = false;
    this._overlayOpen = false;
    this._downline    = [];
    this._selectedIdx = 0;
    this._poseTimer   = null;
    this._sessionTimer = null;
  }

  get isActive()    { return this._active; }
  get overlayOpen() { return this._overlayOpen; }

  init() {
    Events.on('ws:projection_ended', () => this._deactivate());
    Events.on('ws:host_realm_changed', ({ realm, world_state }) => {
      if (!this._active) return;
      RealmManager.transitionTo(realm);
      if (world_state) Events.emit('astral:world_state', world_state);
    });
    Events.on('ws:chat_message', ({ from_username, text }) => {
      if (!this._active) return;
      AstralChat.append(from_username, text);
    });
  }

  onKeyDown(key) {
    if (AstralChat.isInputOpen()) return false;
    if (this._overlayOpen)        return this._overlayKeyDown(key);
    if (this._active && key === 'Escape') { this._end(); return true; }
    if (!this._active && (key === 'a' || key === 'A')) {
      if (Inventory.owned('astral_lens')) { this._openOverlay(); return true; }
    }
    return false;
  }

  _openOverlay() {
    Api.get('/astral/downline').then(({ downline }) => {
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

  _start(targetUserId) {
    this._overlayOpen = false;
    gameSocket.send({ type: 'project_start', target_user_id: targetUserId });
    this._activate();
  }

  _activate() {
    this._active = true;
    AstralChat.show();
    this._poseTimer    = setInterval(() => this._broadcastPose(), POSE_INTERVAL_MS);
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
    AstralChat.hide();
    AstralChat.clear();
    PresenceStore.clear();
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
