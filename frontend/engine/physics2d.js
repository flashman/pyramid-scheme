// ── FILE: engine/physics2d.js ────────────────────────────
// Solid-list AABB collision core. Pure module: no imports, no DOM, no G —
// node-testable (tests/physics2d.test.js).
//
// Conventions:
//   • Body is feet-center anchored: rect spans [x−w/2, x+w/2] × [y−h, y].
//   • Solid { x, y, w, h } has y = TOP of the rect.
//   • oneWay solids catch a body falling onto their top; never walls/ceilings.
//   • Realms own a SolidSet: static rects + providers (functions returning
//     rects), rebuilt each frame — this is how runtime-grown pyramids and
//     moving croc-backs stay in sync without special-cased physics.

export function makeBody({ x = 0, y = 0, w = 20, h = 34 } = {}) {
  return { x, y, w, h, vx: 0, vy: 0,
           grounded: false, headBonk: false, wallLeft: false, wallRight: false };
}

export class SolidSet {
  constructor()      { this._static = []; this._providers = []; this._all = []; }
  addStatic(rects)   { this._static.push(...rects); return this; }
  addProvider(fn)    { this._providers.push(fn); return this; }
  rebuild()          {
    this._all = [...this._static];
    for (const fn of this._providers) this._all.push(...fn());
    return this._all;
  }
  all()              { return this._all; }
}

/** True if a body of size w×h placed at feet-center (x, y) overlaps no solid. */
function bodyFits(x, y, w, h, solids) {
  const hw = w / 2;
  for (const s of solids) {
    if (s.oneWay) continue;
    if (x + hw > s.x && x - hw < s.x + s.w && y > s.y && y - h < s.y + s.h) return false;
  }
  return true;
}

/**
 * One frame of movement, resolved per axis. Mutates body.
 *   maxStepUp  – auto-climb rises up to this many px while walking (stairs)
 *   externalVx – additive world drift (Nile current): moves the body and is
 *                wall-checked, but never stored into body.vx.
 */
export function resolveMove(body, solids, { maxStepUp = 0, externalVx = 0 } = {}) {
  const hw = body.w / 2;
  body.headBonk = false; body.wallLeft = false; body.wallRight = false;

  // ── Depenetrate: geometry may have grown around us (pyramid layer added) ──
  for (const s of solids) {
    if (s.oneWay) continue;
    if (body.x + hw > s.x && body.x - hw < s.x + s.w &&
        body.y > s.y && body.y - body.h < s.y + s.h) {
      body.y = s.y;                       // stand on the solid that swallowed us
    }
  }

  // ── Horizontal ─────────────────────────────────────────
  const dx = body.vx + externalVx;
  let nx = body.x + dx;
  if (dx !== 0) {
    for (const s of solids) {
      if (s.oneWay) continue;
      // Wall band: solid must overlap the body's interior (feet−1 keeps the
      // tile we stand on from reading as a wall).
      if (!(body.y - 1 > s.y && body.y - body.h + 1 < s.y + s.h)) continue;
      if (dx > 0 && body.x + hw <= s.x && nx + hw > s.x) {
        const rise = body.y - s.y;
        if (rise > 0 && rise <= maxStepUp && bodyFits(nx, s.y, body.w, body.h, solids)) {
          body.y = s.y;                   // auto step-up (pyramid stairs)
          continue;
        }
        nx = s.x - hw; body.vx = 0; body.wallRight = true;
      } else if (dx < 0 && body.x - hw >= s.x + s.w && nx - hw < s.x + s.w) {
        const rise = body.y - s.y;
        if (rise > 0 && rise <= maxStepUp && bodyFits(nx, s.y, body.w, body.h, solids)) {
          body.y = s.y;
          continue;
        }
        nx = s.x + s.w + hw; body.vx = 0; body.wallLeft = true;
      }
    }
  }

  // ── Vertical ───────────────────────────────────────────
  const wasY = body.y;
  let ny = body.y + body.vy;
  if (body.vy >= 0) {
    // Falling / standing: land on the highest top we were above before the move.
    let landY = Infinity;
    for (const s of solids) {
      if (!(nx + hw > s.x && nx - hw < s.x + s.w)) continue;
      if (wasY <= s.y + 1 && ny >= s.y && s.y < landY) landY = s.y;
    }
    if (landY < Infinity) { ny = landY; body.vy = 0; body.grounded = true; }
    else body.grounded = false;
  } else {
    // Rising: clamp the head against the lowest solid bottom we cross.
    let ceilY = -Infinity, hit = null;
    for (const s of solids) {
      if (s.oneWay) continue;
      if (!(nx + hw > s.x && nx - hw < s.x + s.w)) continue;
      const bottom = s.y + s.h;
      if (wasY - body.h >= bottom && ny - body.h < bottom && bottom > ceilY) {
        ceilY = bottom; hit = s;
      }
    }
    if (hit) { ny = ceilY + body.h; body.vy = 0; body.headBonk = true; hit.onBonk?.(body); }
    body.grounded = false;
  }

  body.x = nx; body.y = ny;
  return body;
}

/**
 * Body-vs-body contact classification — the stomp primitive.
 * Returns the side of b that a is touching: 'top' means a rests on b
 * (a falling with vy > 0 + 'top' = stomp; 'left'/'right'/'bottom' = hurt).
 */
export function contactDirection(a, b) {
  const ax1 = a.x - a.w / 2, ax2 = a.x + a.w / 2, ay1 = a.y - a.h, ay2 = a.y;
  const bx1 = b.x - b.w / 2, bx2 = b.x + b.w / 2, by1 = b.y - b.h, by2 = b.y;
  if (ax1 >= bx2 || ax2 <= bx1 || ay1 >= by2 || ay2 <= by1) return null;
  const dx = Math.min(ax2 - bx1, bx2 - ax1);
  const dy = Math.min(ay2 - by1, by2 - ay1);
  if (dy <= dx) return (ay2 + ay1) < (by2 + by1) ? 'top' : 'bottom';
  return (ax2 + ax1) < (bx2 + bx1) ? 'left' : 'right';
}

/**
 * Advance moving solids by their (vx, vy). A grounded body standing on a
 * moving solid is carried by its delta; a solid moving into the body pushes
 * it. Returns true if a push left the body overlapping another solid (squish
 * — the caller decides what that means).
 */
export function moveSolids(solids, body = null) {
  let squished = false;
  for (const s of solids) {
    const svx = s.vx || 0, svy = s.vy || 0;
    if (!svx && !svy) continue;
    const hw = body ? body.w / 2 : 0;
    const riding = body && body.grounded &&
      body.x + hw > s.x && body.x - hw < s.x + s.w && Math.abs(body.y - s.y) <= 1;
    s.x += svx; s.y += svy;
    if (!body) continue;
    if (riding) { body.x += svx; body.y += svy; continue; }
    // Push: solid now overlaps the body → shove along the motion direction.
    if (body.x + hw > s.x && body.x - hw < s.x + s.w &&
        body.y > s.y && body.y - body.h < s.y + s.h) {
      body.x = svx > 0 ? s.x + s.w + hw : s.x - hw;
      if (!bodyFits(body.x, body.y, body.w, body.h, solids.filter(o => o !== s))) squished = true;
    }
  }
  return squished;
}
