// ── FILE: worlds/sea/coast.js ────────────────────────────
// Where the rocks are — pure data, laid out once from seeded random numbers.
// gfx/landmarks.js draws exactly these, and voyage.js collides with exactly these,
// so what you see is what you hit. Imports only constants.js; touches no DOM.
//
// Crete's rocks are in the island's local frame (x across, −z toward the bay — the
// same frame as the island group in landmarks.js). Each also carries its world
// position (wx, wz) and the radius it presents at the waterline (r).

import { COURSE_HEADING, CRETE_ISLAND, LANDMARKS, courseToWorld } from './constants.js';

function rng32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform Catmull-Rom through 2D points; t runs 0..1 across the whole chain. */
function catmullRom(points, t) {
  const n = points.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n)), u = t * n - seg;
  const p0 = points[Math.max(0, seg - 1)], p1 = points[seg], p2 = points[seg + 1], p3 = points[Math.min(n, seg + 2)];
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

const { radius: R } = CRETE_ISLAND;
const CENTER = courseToWorld(CRETE_ISLAND.along, CRETE_ISLAND.lateral);
const COS = Math.cos(COURSE_HEADING), SIN = Math.sin(COURSE_HEADING);

/** Crete-local (x, z) → world, matching the island group's rotation.y = COURSE_HEADING. */
export function creteToWorld(x, z) {
  return { x: CENTER.x + x * COS + z * SIN, z: CENTER.z - x * SIN + z * COS };
}

/** Local z on the island's bay-facing slope at normalised radius rho, for a given x. */
export const slopeZ = (x, rho) => -Math.sqrt(Math.max(0, rho * rho - (x / (1.3 * R)) ** 2)) * 0.8 * R;

/** Waterline radius of a rock mass — a unit dodecahedron scaled rx·ry·rz with its centre at y. */
function massRadius(rx, ry, rz, y) {
  if (Math.abs(y) >= ry) return 0;                   // entirely above or below the sea
  return 0.5 * (rx + rz) * Math.sqrt(1 - (y / ry) ** 2);
}

/** Crete's rocks: { kind: 'mass'|'stack', x, z, …shape, yaw, mat, r, wx, wz }. */
export const CRETE_ROCKS = (() => {
  const rnd = rng32(1450);
  const rocks = [];
  const mass = (x, z, rx, ry, rz, y = ry * 0.4 - 8) => {
    rocks.push({ kind: 'mass', x, z, y, rx, ry, rz, yaw: rnd() * Math.PI, mat: Math.floor(rnd() * 4), r: massRadius(rx, ry, rz, y) });
  };

  // Two unequal headlands. The eastern arm (+x) runs long and hooks across in front of the
  // cove; the western arm is short and low. The way in is past the western tip and behind
  // the hook, so the cove is hidden from straight offshore.
  const arm = (points, count, size, height) => {
    for (let i = 0; i < count; i++) {
      const t = Math.min(1, (i + rnd() * 0.8) / count);
      const [px, pz] = catmullRom(points, t);
      const fall = 1 - 0.75 * t;                          // big where it leaves the island, ragged at the tip
      const sz = size * fall * (0.6 + rnd() * 0.8);
      const ry = height * fall * (0.5 + rnd() * 0.9);
      mass(px + (rnd() - 0.5) * sz, pz + (rnd() - 0.5) * sz, sz * (0.8 + rnd() * 0.5), ry, sz * (0.7 + rnd() * 0.5));
    }
  };
  arm([[380, -600], [480, -820], [370, -1030], [140, -1110], [-60, -1085]], 16, 95, 130);
  arm([[-420, -590], [-520, -760], [-470, -905]], 7, 80, 90);

  // Sea stacks and reef rocks screening the mouth (cones: base radius `rad` at y = −6).
  for (const [x, z, h, rad] of [[-380, -1180, 75, 12], [-150, -1245, 48, 10], [270, -1205, 30, 9], [-560, -1010, 38, 11], [60, -1180, 22, 8]]) {
    rocks.push({ kind: 'stack', x, z, h, rad, yaw: rnd() * Math.PI, mat: Math.floor(rnd() * 4), r: rad * (1 - 6 / h) });
  }

  // Cliffs along the back of the cove, unevenly spaced, kept well clear of the landing beach.
  for (let x = -440; x <= 440; x += 45 + rnd() * 50) {
    if (Math.abs(x) < 170) continue;
    const ry = 20 + rnd() * 40;
    mass(x, slopeZ(x, 0.92 + rnd() * 0.03), 35 + rnd() * 25, ry, 25 + rnd() * 20);
  }

  // Boulders at the waterline, off the beach.
  for (let i = 0; i < 40; i++) {
    const x = (rnd() - 0.5) * 1100;
    if (Math.abs(x) < 130) continue;
    const z = Math.abs(x) > 480 ? -620 - rnd() * 600 : slopeZ(x, 0.95) - rnd() * 40;
    const s = 3 + rnd() * 7;
    mass(x, z, s, s * 0.7, s, -1);
  }

  for (const rock of rocks) { const w = creteToWorld(rock.x, rock.z); rock.wx = w.x; rock.wz = w.z; }
  return rocks;
})();

/** World → Crete-local (the inverse of creteToWorld). */
export function worldToCrete(x, z) {
  const dx = x - CENTER.x, dz = z - CENTER.z;
  return { x: dx * COS - dz * SIN, z: dx * SIN + dz * COS };
}

// Crete's waterline. The island cone (1.3R × 0.8R footprint in landmarks.js) meets the sea at
// ~0.91 of that footprint; the shore sits a touch inside it, so the hull visibly touches land
// before it stops. The cove and its beach lie outside this ellipse, in the bay.
export const CRETE_SHORE = { ax: 1.3 * R * 0.9, az: 0.8 * R * 0.9 };

/** If world (x, z) is ashore on Crete: roughly how far in (m) and the outward normal (world); else null. */
export function creteShoreContact(x, z) {
  const p = worldToCrete(x, z);
  const u = p.x / CRETE_SHORE.ax, w = p.z / CRETE_SHORE.az;
  const rho = Math.hypot(u, w);
  if (rho >= 1) return null;
  let gx = u / CRETE_SHORE.ax, gz = w / CRETE_SHORE.az;                  // ∇(rho²)/2, local
  const g = Math.hypot(gx, gz) || 1;
  const depth = (1 - rho) * Math.max(rho, 1e-6) / g;                     // (1 − rho) / |∇rho|
  gx /= g; gz /= g;
  return { depth, nx: gx * COS + gz * SIN, nz: -gx * SIN + gz * COS };
}

const AT = Object.fromEntries(LANDMARKS.map(l => [l.id, courseToWorld(l.along, l.lateral)]));

/** Everything solid, as world-space circles { id, x, z, r }. The landing beach is not here — it's safe. */
export const COLLIDERS = [
  ...CRETE_ROCKS.filter(rk => rk.r > 0.5).map((rk, i) => ({ id: `crete_${rk.kind}_${i}`, x: rk.wx, z: rk.wz, r: rk.r })),
  { id: 'signal_rock', x: AT.signal_rock.x, z: AT.signal_rock.z, r: 13 },
  ...[-5, 0, 5].map((k, i) => ({ id: `wreck_${i}`, x: AT.wreck.x + Math.sin(0.4) * k, z: AT.wreck.z + Math.cos(0.4) * k, r: 3 })),
];
