// ── FILE: worlds/sea/gfx/delta.js ────────────────────────
// Where the voyage begins: the Nile Delta behind the departing ship — two low,
// marshy lobes split by the river mouth the ship has just left, fringed with
// papyrus and date palms — and the pyramids of Giza standing against the amber
// sky far upriver. Static scenery (no per-frame update).
// Built in course space: the group is turned to the course, so local z = along
// (negative = behind the departure point) and local x = −lateral.

import * as THREE from 'three';
import { DEPARTURE, COURSE_HEADING } from '../constants.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra });

/** Seeded PRNG so the Delta is laid out identically on every load. */
function rng32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coastline wobble at angle a — shared by the land mesh and the reed placement. */
const coast = (a, seed) => 0.86 + 0.1 * Math.sin(a * 5 + seed) + 0.05 * Math.sin(a * 13 + seed * 2);

/** A flat lobe of land with a ragged coastline. */
function lobe(rx, rz, height, color, seed) {
  const g = new THREE.CylinderGeometry(1, 1, height, 64, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), f = coast(Math.atan2(z, x), seed);
    p.setXYZ(i, x * f * rx, p.getY(i), z * f * rz);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color));
}

export function createDelta() {
  const group = new THREE.Group();
  group.position.set(DEPARTURE.x, 0, DEPARTURE.z);
  group.rotation.y = COURSE_HEADING;
  const rnd = rng32(3100);

  const reedGeo = new THREE.ConeGeometry(0.5, 3.5, 5);
  reedGeo.translate(0, 1.75, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 10, 6);
  trunkGeo.translate(0, 5, 0);
  const crownGeo = new THREE.ConeGeometry(4.5, 2.2, 8);
  crownGeo.translate(0, 10.6, 0);
  const reeds  = new THREE.InstancedMesh(reedGeo, mat(0x6a7a3a), 700);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x5a4630), 48);
  const crowns = new THREE.InstancedMesh(crownGeo, mat(0x2e4a26), 48);
  for (const im of [reeds, trunks, crowns]) im.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let nReed = 0, nPalm = 0;

  // Two lobes either side of the river mouth. Their near shore sits ~450 m behind
  // the departure point, beyond the voyage's back wall (BACK_LIMIT = −300 m).
  for (const [side, seed] of [[-1, 1.3], [1, 4.1]]) {
    const cx = side * 1050, cz = -1300, rx = 900, rz = 850;
    const sand  = lobe(rx * 1.04, rz * 1.04, 1.2, 0xb8a070, seed);
    sand.position.set(cx, 0.1, cz);
    const marsh = lobe(rx, rz, 3, 0x4a5a2c, seed);
    marsh.position.set(cx, 0.8, cz);
    group.add(sand, marsh);

    for (let i = 0; i < 350; i++) {                                   // papyrus along the waterline
      const a = rnd() * Math.PI * 2, f = coast(a, seed) * (0.9 + rnd() * 0.12);
      dummy.position.set(cx + Math.cos(a) * rx * f, 0.5, cz + Math.sin(a) * rz * f);
      dummy.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
      dummy.scale.setScalar(0.7 + rnd() * 0.8);
      dummy.updateMatrix();
      reeds.setMatrixAt(nReed++, dummy.matrix);
    }
    for (let i = 0; i < 24; i++) {                                    // date palms inland
      const a = rnd() * Math.PI * 2, f = coast(a, seed) * (0.2 + rnd() * 0.65);
      dummy.position.set(cx + Math.cos(a) * rx * f, 2.3, cz + Math.sin(a) * rz * f);
      dummy.rotation.set((rnd() - 0.5) * 0.15, rnd() * Math.PI, (rnd() - 0.5) * 0.15);
      dummy.scale.setScalar(0.8 + rnd() * 0.5);
      dummy.updateMatrix();
      trunks.setMatrixAt(nPalm, dummy.matrix);
      crowns.setMatrixAt(nPalm, dummy.matrix);
      nPalm++;
    }
  }
  reeds.count = nReed;
  trunks.count = crowns.count = nPalm;
  group.add(reeds, trunks, crowns);

  // The pyramids of Giza, ~5 km upriver at true scale (the Great Pyramid is 146 m;
  // its corner radius is ~1.1× its height). Unfogged so they read as silhouettes
  // against the amber band; the low sun behind them leaves the near faces dark.
  const limestone = mat(0x9a7a52, { fog: false });
  for (const [lateral, along, height] of [[-900, -5200, 146], [-1250, -5450, 136], [-1500, -5650, 65]]) {
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(height * 1.1, height, 4, 1), limestone);
    pyramid.rotation.y = Math.PI / 4;
    pyramid.position.set(-lateral, height / 2 - 2, along);
    group.add(pyramid);
  }
  return group;
}
