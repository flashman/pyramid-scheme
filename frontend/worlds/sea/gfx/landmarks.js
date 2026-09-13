// ── FILE: worlds/sea/gfx/landmarks.js ────────────────────
// Things to pass on the way, and the destination: a half-sunk wreck with bobbing
// JUST POTS crates, a lone rock with a signal fire, and Crete — Mount Ida above a
// natural rocky bay: two headlands stepping down from cliffs to sea stacks, a
// cliff-backed cove beach, boulders at the waterline, and high on the mountain
// the dark mouth of a cave with something glowing inside.

import * as THREE from 'three';
import { LANDMARKS, CRETE_ISLAND, COURSE_HEADING, courseToWorld } from '../constants.js';
import { heightAt } from '../waves.js';

const stone = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
const glow  = (color) => new THREE.MeshBasicMaterial({ color });

/** Seeded PRNG so the coastline is laid out identically on every load. */
function rng32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, position-hashed jitter — shared vertices move together, so no cracks. */
function roughen(geo, amount) {
  const p = geo.attributes.position;
  const h = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) - 0.5; };
  for (let i = 0; i < p.count; i++) {
    const x = +p.getX(i).toFixed(3), y = +p.getY(i).toFixed(3), z = +p.getZ(i).toFixed(3);
    p.setXYZ(i, x + h(x, y, z) * amount, y + h(y, z, x) * amount, z + h(z, x, y) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

function wreck() {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 15), stone(0x3a2a1a));
  hull.position.y = -0.6;
  hull.rotation.set(0.18, 0.4, 0.55);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 5.5, 6), stone(0x2e2216));
  mast.position.set(0.8, 2.2, 2);
  mast.rotation.z = -0.7;
  group.add(hull, mast);
  const crates = [];
  for (let i = 0; i < 6; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), stone(0x7a5a2e));
    crate.userData.off = { x: Math.cos(i * 2.1) * (6 + i * 1.5), z: Math.sin(i * 2.1) * (6 + i * 1.5) };
    crates.push(crate);
    group.add(crate);
  }
  return { group, crates };
}

function signalRock() {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(roughen(new THREE.DodecahedronGeometry(14, 1), 2.5), stone(0x2a2824));
  rock.scale.set(1, 1.3, 0.9);
  rock.position.y = 4;
  const fire  = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), glow(0xff8a30));
  fire.position.y = 21.5;
  const light = new THREE.PointLight(0xff7a2a, 600, 240, 2);
  light.position.y = 23;
  group.add(rock, fire, light);
  return { group, fire, light };
}

/** A faceted rock mass: a unit dodecahedron, roughened, then stretched to size. */
function rockMass(rnd, rx, ry, rz, material) {
  const m = new THREE.Mesh(roughen(new THREE.DodecahedronGeometry(1, 2), 0.18), material);
  m.scale.set(rx, ry, rz);
  m.rotation.y = rnd() * Math.PI;
  return m;
}

/** Crete. Local −z faces the bay; the island is a cone scaled (1.3, 1, 0.8). The
    bay centre sits at local z ≈ −1100 with a 520 m sailing boundary, so every
    rock below stays outside that circle — the ship can't sail into stone. */
function crete() {
  const group = new THREE.Group();
  const { radius: r, height: h } = CRETE_ISLAND;
  const rnd = rng32(1450);
  const landY  = (x, z) => Math.max(0, h * (1 - Math.hypot(x / (1.3 * r), z / (0.8 * r))) - 40);
  const slopeZ = (x, rho) => -Math.sqrt(Math.max(0, rho * rho - (x / (1.3 * r)) ** 2)) * 0.8 * r;
  const rockMats = [stone(0x5a524a), stone(0x4a4540), stone(0x6a625a), stone(0x3e3a36)];
  const pick = () => rockMats[Math.floor(rnd() * rockMats.length)];

  // ── The island and Mount Ida ──
  const land = new THREE.Mesh(roughen(new THREE.ConeGeometry(r, h, 48, 10), 30), stone(0x24211e));
  land.position.y = h / 2 - 40;
  land.scale.set(1.3, 1, 0.8);
  const ida = new THREE.Mesh(roughen(new THREE.ConeGeometry(r * 0.35, h * 0.9, 24, 6), 18), stone(0x1e1c1a));
  ida.position.set(r * 0.2, h * 0.9, -r * 0.1);
  group.add(land, ida);

  // ── Two headlands: tall cliffs where they leave the island, low rocks at the tips ──
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const size = 90 * (1 - t) + 25;
      const ry = 0.6 * (120 * (1 - t) + 18);
      const rock = rockMass(rnd, size * (0.8 + rnd() * 0.4), ry, size * (0.7 + rnd() * 0.4), pick());
      rock.position.set(side * (540 + 220 * t * t) + (rnd() - 0.5) * 30, ry * 0.4 - 8, -600 - 650 * t);
      group.add(rock);
    }
    // Sea stacks standing off the headland tip.
    for (let i = 0; i < 3; i++) {
      const sh = 45 + rnd() * 35;
      const stack = new THREE.Mesh(roughen(new THREE.ConeGeometry(10 + rnd() * 6, sh, 7, 4), 4), pick());
      stack.position.set(side * (720 + rnd() * 80), sh / 2 - 6, -1190 - rnd() * 120);
      group.add(stack);
    }
  }

  // ── Cliffs along the back of the bay, broken by a small cove beach in the middle ──
  for (let i = 0; i <= 12; i++) {
    const x = -440 + i * 73;
    if (Math.abs(x) < 120) continue;
    const ry = 25 + rnd() * 30;
    const cliff = rockMass(rnd, 40 + rnd() * 15, ry, 30 + rnd() * 15, pick());
    cliff.position.set(x, ry * 0.4 - 8, slopeZ(x, 0.93));
    group.add(cliff);
  }
  const cove = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 32), stone(0xb8a878));
  cove.scale.set(150, 1, 55);
  cove.position.set(0, 0.2, slopeZ(0, 0.95));
  group.add(cove);

  // ── Boulders at the waterline ──
  for (let i = 0; i < 40; i++) {
    const x = (rnd() - 0.5) * 1100;
    const z = Math.abs(x) > 480 ? -620 - rnd() * 600 : slopeZ(x, 0.95) - rnd() * 40;
    const s = 3 + rnd() * 7;
    const boulder = rockMass(rnd, s, s * 0.7, s, pick());
    boulder.position.set(x, -1, z);
    group.add(boulder);
  }

  // ── High on the mountain: a cave mouth, and something glowing inside ──
  const lx = -70, lz = slopeZ(lx, 0.5) - 6;
  const mouth = new THREE.Group();
  mouth.position.set(lx, landY(lx, lz + 6), lz);
  const lip = new THREE.Mesh(roughen(new THREE.TorusGeometry(12, 4, 8, 20, Math.PI), 2), stone(0x2e2a26));
  const dark = new THREE.Mesh(new THREE.CircleGeometry(12, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050303 }));
  dark.rotation.y = Math.PI;
  dark.position.z = 1;
  const ember = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), glow(0x6a1008));
  ember.position.set(0, 5, 3);
  const caveLight = new THREE.PointLight(0xb02010, 300, 70, 2);
  caveLight.position.set(0, 5, -2);
  mouth.add(lip, dark, ember, caveLight);
  group.add(mouth);

  return { group, caveLight };
}

export function createLandmarks() {
  const group = new THREE.Group();
  const at = Object.fromEntries(LANDMARKS.map(l => [l.id, courseToWorld(l.along, l.lateral)]));

  const w = wreck();
  w.group.position.set(at.wreck.x, 0, at.wreck.z);
  const s = signalRock();
  s.group.position.set(at.signal_rock.x, 0, at.signal_rock.z);
  const c = crete();
  const cp = courseToWorld(CRETE_ISLAND.along, CRETE_ISLAND.lateral);
  c.group.position.set(cp.x, 0, cp.z);
  c.group.rotation.y = COURSE_HEADING;
  group.add(w.group, s.group, c.group);

  return {
    group,
    update(v, comps) {
      w.crates.forEach((crate, i) => {
        const o = crate.userData.off;
        crate.position.set(o.x, heightAt(comps, at.wreck.x + o.x, at.wreck.z + o.z, v.t) + 0.2, o.z);
        crate.rotation.set(Math.sin(v.t * 0.9 + i) * 0.25, i, Math.cos(v.t * 0.7 + i) * 0.25);
      });
      s.light.intensity = 600 + Math.sin(v.t * 13) * 120 + Math.sin(v.t * 7.3) * 90;
      s.fire.scale.setScalar(1 + Math.sin(v.t * 17) * 0.15);
      c.caveLight.intensity = 300 + Math.sin(v.t * 0.7) * 150;
    },
  };
}
