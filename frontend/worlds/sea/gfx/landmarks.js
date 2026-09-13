// ── FILE: worlds/sea/gfx/landmarks.js ────────────────────
// Things to pass on the way, and the destination: a half-sunk wreck with bobbing
// JUST POTS crates, a lone rock with a signal fire, and Crete — Mount Ida above a
// natural rocky bay with a hidden mouth: a long hooked headland and a short one, stacks screening the way in, a
// cliff-backed landing beach (timber rollers, stone anchors, boats hauled up), boulders at the waterline, Knossos' tiered red colonnades on the slope above the
// cove, and high on the mountain
// the dark mouth of a cave with something glowing inside.

import * as THREE from 'three';
import { LANDMARKS, CRETE_ISLAND, COURSE_HEADING, BEACH, beachY, courseToWorld } from '../constants.js';
import { heightAt } from '../waves.js';
import { CRETE_ROCKS } from '../coast.js';

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

/** The Minoan horns of consecration — a stylised pair of bull's horns on a plinth. */
function hornsOfConsecration(x, y, z, m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.8), m));
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6), m);
    horn.position.set(s * 0.9, 1.0, 0);
    horn.rotation.z = -s * 0.25;                                   // tips splay outward
    g.add(horn);
  }
  g.position.set(x, y, z);
  return g;
}

/** Crete. Local −z faces the bay; the island is a cone scaled (1.3, 1, 0.8). The
    bay centre sits at local z ≈ −1100 with a 520 m sailing boundary, so every
    rock below stays outside that circle — the ship can't sail into stone. */
function crete() {
  const group = new THREE.Group();
  const { radius: r, height: h } = CRETE_ISLAND;
  const landY  = (x, z) => Math.max(0, h * (1 - Math.hypot(x / (1.3 * r), z / (0.8 * r))) - 40);
  const slopeZ = (x, rho) => -Math.sqrt(Math.max(0, rho * rho - (x / (1.3 * r)) ** 2)) * 0.8 * r;

  // ── The island and Mount Ida ──
  const land = new THREE.Mesh(roughen(new THREE.ConeGeometry(r, h, 48, 10), 30), stone(0x24211e));
  land.position.y = h / 2 - 40;
  land.scale.set(1.3, 1, 0.8);
  const ida = new THREE.Mesh(roughen(new THREE.ConeGeometry(r * 0.35, h * 0.9, 24, 6), 18), stone(0x1e1c1a));
  ida.position.set(r * 0.2, h * 0.9, -r * 0.1);
  group.add(land, ida);

  // ── The bay's rocks, drawn from coast.js — exactly the layout the voyage collides with ──
  const rockMats = [stone(0x5a524a), stone(0x4a4540), stone(0x6a625a), stone(0x3e3a36)];
  for (const rk of CRETE_ROCKS) {
    let mesh;
    if (rk.kind === 'stack') {
      mesh = new THREE.Mesh(roughen(new THREE.ConeGeometry(rk.rad, rk.h, 7, 4), 3.5), rockMats[rk.mat]);
      mesh.position.set(rk.x, rk.h / 2 - 6, rk.z);
    } else {
      mesh = new THREE.Mesh(roughen(new THREE.DodecahedronGeometry(1, 2), 0.18), rockMats[rk.mat]);
      mesh.scale.set(rk.rx, rk.ry, rk.rz);
      mesh.position.set(rk.x, rk.y, rk.z);
    }
    mesh.rotation.y = rk.yaw;
    group.add(mesh);
  }

  // The landing beach (its waterline is BEACH.along ≈ local z −700): dry sand, a darker wet
  // strip at the water, timber rollers down the landing lane, pierced stone anchors, and two
  // small boats already hauled up — how Bronze Age crews landed, as at Knossos's harbour, Amnisos.
  const beach = new THREE.Group();
  // One sloped sheet of sand, shaped by beachY() — the same profile the keel rides up. Dark and wet
  // at the water, dry above; it tucks under the cliffs at either side.
  const D0 = BEACH.along - CRETE_ISLAND.along;                        // local z of the waterline
  const beachAt = (x, d) => {
    const u = Math.min(1, Math.max(0, (Math.abs(x) - BEACH.halfWidth + 10) / 35));
    return beachY(d) + (d > 1 ? 0.05 * Math.sin(x * 0.7) * Math.sin(d * 0.9) : 0) - 4 * u * u * (3 - 2 * u);
  };
  const sandGeo = new THREE.PlaneGeometry(2 * BEACH.halfWidth + 50, 100, 60, 50);
  const sp = sandGeo.attributes.position, colors = [];
  const wetC = new THREE.Color(0x6e5f45), dryC = new THREE.Color(0xb8a67c), c = new THREE.Color();
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), d = sp.getY(i) + 20;                          // d runs −30 (under the bay) … 70 (the berm)
    const y = beachAt(x, d);
    sp.setXYZ(i, x, y, D0 + d);
    c.copy(wetC).lerp(dryC, Math.min(1, Math.max(0, (y - 0.1) / 0.6)));
    colors.push(c.r, c.g, c.b);
  }
  sandGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  sandGeo.computeVertexNormals();
  const sandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  beach.add(new THREE.Mesh(sandGeo, sandMat));
  const timber = stone(0x5a3e22);
  for (let d = 0; d <= 33; d += 3) {                                  // the rollers she's hauled up on
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 8), timber);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(0, beachY(d) + 0.1, D0 + d);
    beach.add(roller);
  }
  const anchorStone = stone(0x6a6660), hole = new THREE.MeshBasicMaterial({ color: 0x1a1816 });
  for (const [x, d, lean] of [[-14, 10, 0.2], [-22, 18, -0.3], [17, 12, 0.1], [26, 21, 0.35], [-30, 6, -0.15]]) {
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.35), anchorStone);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), hole);
    bore.position.set(0, 0.25, 0.18);
    anchor.add(bore);
    anchor.position.set(x, beachY(d) + 0.45, D0 + d);
    anchor.rotation.set(0, lean * 3, lean);
    beach.add(anchor);
  }
  const boatHull = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  for (const [x, d, yaw, tilt] of [[-48, 16, 0.2, 0.12], [52, 20, -0.15, -0.1]]) {
    const boat = new THREE.Group();
    const hullMesh = new THREE.Mesh(boatHull, stone(0x5a4630));
    hullMesh.scale.set(1.5, 1.1, 6);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), timber);   // unstepped, lying along the hull
    mast.rotation.x = Math.PI / 2;
    mast.position.set(0.3, 0.3, 0.5);
    boat.add(hullMesh, mast);
    boat.position.set(x, beachY(d) + 0.95, D0 + d);
    boat.rotation.set(-Math.atan(BEACH.slope), yaw, tilt);
    beach.add(boat);
  }
  group.add(beach);

  // ── Knossos on the slope above the cove: a limestone platform, two tiers of red colonnades, a grand stair ──
  const palace = new THREE.Group();
  const pz = slopeZ(0, 0.72);
  palace.position.set(0, landY(0, pz), pz);
  const red = stone(0x8a2a1a), black = stone(0x1a1410), ochre = stone(0xb89868), limestone = stone(0xc8bca0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(130, 50, 70), limestone);
  base.position.y = -22;
  palace.add(base);
  for (const t of [{ y: 3, z: -30, n: 14, span: 118, colH: 12 }, { y: 18, z: -8, n: 9, span: 80, colH: 10 }]) {
    for (let i = 0; i < t.n; i++) {
      const cx = -t.span / 2 + (i + 0.5) * (t.span / t.n);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.85, t.colH, 10), red);   // Minoan: wider at the top
      col.position.set(cx, t.y + t.colH / 2, t.z);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.9, 10), black);
      cap.position.set(cx, t.y + t.colH + 0.2, t.z);
      palace.add(col, cap);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(t.span + 6, 2.2, 22), ochre);
    roof.position.set(0, t.y + t.colH + 1.6, t.z + 8);
    const back = new THREE.Mesh(new THREE.BoxGeometry(t.span + 6, t.colH + 3, 14), limestone);
    back.position.set(0, t.y + (t.colH + 3) / 2, t.z + 14);
    palace.add(roof, back);
    for (let i = 0; i < 7; i++) {
      palace.add(hornsOfConsecration(-t.span / 2 + (i + 0.5) * (t.span / 7), t.y + t.colH + 2.7, t.z - 2, ochre));
    }
  }
  for (let s = 0; s < 10; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(24, 2.5, 5), limestone);
    step.position.set(0, 1.75 - s * 2.5, -37.5 - s * 5);
    palace.add(step);
  }
  for (const x of [-50, -30, -12, 12, 30, 50]) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), glow(0xffa040));
    flame.position.set(x, 7, -33);
    palace.add(flame);
  }
  const palaceLight = new THREE.PointLight(0xff9a40, 2500, 420, 2);
  palaceLight.position.set(0, 12, -45);
  palace.add(palaceLight);
  group.add(palace);

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

  return { group, caveLight, palaceLight };
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
      c.palaceLight.intensity = 2500 + Math.sin(v.t * 11) * 300;       // torchlight flicker
    },
  };
}
