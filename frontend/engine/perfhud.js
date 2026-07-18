// ── FILE: engine/perfhud.js ──────────────────────────────
// Throwaway performance overlay for the Mario-physics slowdown hunt
// (branch fix/mario-physics). NOT part of the shipped game — remove before
// merge. Answers one question: when the player jumps and the sky pans in,
// does frame time / collision-solid count spike, or does the loop stay flat?
//
// Because the game loop is frame-based (px/frame, no dt — see main.js), a
// real compute spike shows up as a longer inter-frame interval AND slower
// movement. So we measure two separate things:
//   • dt   — wall-clock interval between rAF callbacks (real fps the user feels)
//   • work — time spent inside update()+render() only (our compute cost,
//            isolated from vsync / browser throttling)
// Each keeps a rolling max over ~3s so a brief jump-spike lingers long enough
// to read or screenshot, then clears on its own.
//
// Toggle with the '\' key. Default ON on this branch.

import { X } from './canvas.js';
import { G } from '../game/state.js';

const WINDOW = 180;   // ~3s at 60fps — rolling-max horizon

class PerfHud {
  constructor() {
    this.on       = true;
    this._lastTs  = 0;
    this._dtRing  = [];   // recent inter-frame intervals (ms)
    this._workRing = [];  // recent update+render times (ms)
    this._workStart = 0;
    this._solids  = 0;    // last-seen solid count (set by main loop)
  }

  toggle() { this.on = !this.on; }

  /** Call at the very top of the frame with the rAF timestamp. */
  frame(ts) {
    if (this._lastTs) this._push(this._dtRing, ts - this._lastTs);
    this._lastTs = ts;
  }

  /** Bracket the update+render section. */
  workBegin() { this._workStart = performance.now(); }
  workEnd()   { this._push(this._workRing, performance.now() - this._workStart); }

  /** Report the current realm's solid count (0 if the realm has none). */
  setSolids(n) { this._solids = n; }

  _push(ring, v) { ring.push(v); if (ring.length > WINDOW) ring.shift(); }
  _avg(ring)     { return ring.length ? ring.reduce((a, b) => a + b, 0) / ring.length : 0; }
  _max(ring)     { return ring.length ? Math.max(...ring) : 0; }

  draw() {
    if (!this.on) return;
    const dt   = this._avg(this._dtRing),   dtMax   = this._max(this._dtRing);
    const work = this._avg(this._workRing), workMax = this._max(this._workRing);
    const dtNow   = this._dtRing[this._dtRing.length - 1]     || 0;   // this frame
    const workNow = this._workRing[this._workRing.length - 1] || 0;
    const gap  = Math.max(0, dtNow - workNow);   // off-JS time: GPU/composite/idle/vsync
    const fps  = dt ? 1000 / dt : 0;
    const parts = G.particles ? G.particles.length : 0;

    const lines = [
      `PERF  fps ${fps.toFixed(0).padStart(3)}  now ${(dtNow ? 1000 / dtNow : 0).toFixed(0)}   \\ = toggle`,
      `dt    ${dt.toFixed(1)}ms  max ${dtMax.toFixed(1)}`,
      `work  ${work.toFixed(1)}ms  max ${workMax.toFixed(1)}  (JS only)`,
      `gap   ${gap.toFixed(1)}ms  <- GPU/composite/idle (NOT js)`,
      `parts ${parts}   solids ${this._solids}   vy ${G.pvy.toFixed(1)}`,
    ];

    X.save();
    X.font = '11px monospace';
    X.textBaseline = 'top';
    const w = 320, h = 8 + lines.length * 14;
    X.globalAlpha = 0.82;
    X.fillStyle = '#000';
    X.fillRect(6, 6, w, h);
    X.globalAlpha = 1;
    // Red banner when a recent frame blew past the 60fps budget (16.7ms).
    const hot = dtMax > 20 || workMax > 12;
    lines.forEach((ln, i) => {
      X.fillStyle = i === 0 ? (hot ? '#ff5555' : '#55ff88') : '#cfe8ff';
      X.fillText(ln, 12, 11 + i * 14);
    });
    X.restore();
  }
}

export const PerfHUD = new PerfHud();
