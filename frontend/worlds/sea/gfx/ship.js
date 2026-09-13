// ── FILE: worlds/sea/gfx/ship.js ─────────────────────────
// The pharaoh's papyrus-reed ship from generated geometry (no model files): a
// weathered reed hull riding with real freeboard, a worn and patched linen sail,
// the hooded Shipmaster on his steering oar at the stern, and the player's
// DOWNLINE at the oars — one chained galley slave per recruit, bent over their
// benches, rowing at the effort you set (each a touch out of time with the next)
// while an overseer's whip cracks faster the harder they're driven.
// The pharaoh stands at the prow at true human scale, dressed for the player's
// rank — a bare-headed future pharaoh at first, crowned only at PHARAOH — keeping
// his balance, gazing about, and now and then raising his hand toward Crete.
// Local +z is the bow. Everything that floats sits in `body`, lifted by FREEBOARD.

import * as THREE from 'three';
import { HULL, SAIL } from '../constants.js';
import { wrapAngle } from '../voyage.js';

const FREEBOARD  = 1.0;     // m the gunwale rides above the mean waterline
const HULL_DEPTH = 1.7;     // m from gunwale to keel
const DECK_Y     = -0.2;    // deck height inside the hull (body space)
const SPRAY_MAX  = 180;
export const MAX_ROWERS = 24;                 // 12 benches a side
const PER_SIDE    = MAX_ROWERS / 2;
const BENCH_FROM  = -4.2, BENCH_TO = 3.2;     // z span of the oarlock stations (m)
const OAR_LEN     = 5;                        // oarlock → blade tip
const OAR_INBOARD = 1.1;                      // oarlock → handle (the loom)
const STROKES_AT_FULL = 0.9;                  // strokes per second at full rowing effort; resting at zero
const UPPER_ARM = 0.32, FOREARM = 0.3;
const WHIP_SEGS = 14;

// The game's ranks (game/tiers.js), lowest first — the pharaoh gains regalia as he climbs.
export const RANKS = ['PEASANT', 'SCRIBE', 'ACOLYTE', 'VIZIER', 'HIGH PRIEST', 'PHARAOH'];

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

/** Half-width of the hull at body-space z (matches hullGeometry's taper). */
const halfWidthAt = (z) => HULL.halfBeam * (1 - Math.pow(Math.min(1, Math.abs(z / HULL.halfLen)), 3) * 0.85);

/** Deterministic 0..1 hash, for per-rower variation. */
const hash01 = (n) => { const s = Math.sin(n * 91.345 + 47.853) * 43758.5453; return s - Math.floor(s); };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Seeded PRNG so the weathering is identical on every load. */
function rng32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Merge geometries into one non-indexed geometry (positions + normals), for instancing a body part. */
function mergeGeometries(geos) {
  const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nrm.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}

// Sun-bleached bundled reeds (bow to stern), salt blooms and rot, a dark weed
// line below the waterline, and frayed lashings. v: 0/1 = gunwale, 0.5 = keel.
const reedTexture = () => canvasTexture(1024, 256, (x, w, h) => {
  const r = rng32(7);
  for (let y = 0; y < h; y++) {
    const toKeel = Math.min(y, h - y) / (h / 2);
    const base = 150 - 60 * toKeel;
    x.fillStyle = `rgb(${base + 12}, ${base - 4}, ${Math.round(base * 0.55)})`;
    x.fillRect(0, y, w, 1);
  }
  for (let y = 0; y < h; y += 3) {
    x.fillStyle = `rgba(40, 30, 12, ${0.12 + r() * 0.25})`;
    x.fillRect(0, y, w, r() < 0.3 ? 2 : 1);
  }
  for (let i = 0; i < 260; i++) {
    const px = r() * w, py = r() * h, rad = 4 + r() * 22;
    x.fillStyle = r() < 0.55 ? `rgba(225, 220, 200, ${0.05 + r() * 0.12})` : `rgba(30, 24, 10, ${0.08 + r() * 0.18})`;
    x.beginPath(); x.ellipse(px, py, rad * 2.5, rad * 0.6, 0, 0, Math.PI * 2); x.fill();
  }
  const weed = x.createLinearGradient(0, 0, 0, h);
  weed.addColorStop(0.28, 'rgba(20, 32, 18, 0)');
  weed.addColorStop(0.42, 'rgba(20, 32, 18, 0.55)');
  weed.addColorStop(0.58, 'rgba(20, 32, 18, 0.55)');
  weed.addColorStop(0.72, 'rgba(20, 32, 18, 0)');
  x.fillStyle = weed; x.fillRect(0, 0, w, h);
  for (const u of [0.1, 0.17, 0.24, 0.76, 0.83, 0.9]) {
    x.fillStyle = '#3a2a10'; x.fillRect(u * w - 7, 0, 14, h);
    x.strokeStyle = 'rgba(58, 42, 16, 0.7)'; x.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const yy = r() * h;
      x.beginPath(); x.moveTo(u * w, yy); x.lineTo(u * w + (r() - 0.5) * 40, yy + 10 + r() * 20); x.stroke();
    }
  }
});

// Weathered linen: bleached at the head, grimy at the foot, stained, two sewn
// patches, a faded ochre border, and a ragged tear (alphaTest punches it through).
const sailTexture = () => canvasTexture(512, 512, (x, w, h) => {
  const r = rng32(11);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d8ccac'); g.addColorStop(1, '#a8906a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) { x.fillStyle = 'rgba(90, 64, 34, 0.25)'; x.fillRect(0, y, w, 3); }
  for (let i = 0; i < 140; i++) {
    x.fillStyle = r() < 0.5 ? `rgba(110, 70, 30, ${0.04 + r() * 0.1})` : `rgba(235, 230, 215, ${0.04 + r() * 0.08})`;
    x.beginPath(); x.arc(r() * w, r() * h, 6 + r() * 40, 0, Math.PI * 2); x.fill();
  }
  for (const [px, py, pw, ph] of [[300, 150, 90, 70], [80, 330, 70, 90]]) {
    x.fillStyle = 'rgba(150, 120, 80, 0.85)'; x.fillRect(px, py, pw, ph);
    x.setLineDash([4, 4]); x.strokeStyle = 'rgba(60, 40, 20, 0.8)'; x.lineWidth = 2;
    x.strokeRect(px + 3, py + 3, pw - 6, ph - 6); x.setLineDash([]);
  }
  x.strokeStyle = 'rgba(120, 48, 28, 0.75)'; x.lineWidth = 16; x.strokeRect(8, 8, w - 16, h - 16);
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.moveTo(w * 0.62, h);
  for (let i = 0; i <= 10; i++) x.lineTo(w * (0.62 + i * 0.022), h - 20 - r() * 70 * Math.sin((i / 10) * Math.PI));
  x.lineTo(w * 0.84, h); x.closePath(); x.fill();
  x.globalCompositeOperation = 'source-over';
});

const eyeTexture = () => canvasTexture(128, 64, (x, w, h) => {
  x.fillStyle = '#d8c89a'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#101418'; x.lineWidth = 6;
  x.beginPath(); x.ellipse(64, 26, 34, 14, 0, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#1f4f8a'; x.beginPath(); x.arc(64, 26, 9, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(30, 12); x.lineTo(98, 8); x.stroke();
  x.beginPath(); x.moveTo(56, 40); x.lineTo(50, 60); x.stroke();
  x.beginPath(); x.moveTo(72, 40); x.quadraticCurveTo(98, 64, 108, 44); x.stroke();
});

const nemesTexture = () => canvasTexture(32, 64, (x, w, h) => {
  for (let y = 0; y < h; y += 8) { x.fillStyle = (y / 8) % 2 ? '#1f4f8a' : '#d8b048'; x.fillRect(0, y, w, 8); }
});

/** Bottom half of a unit sphere stretched into a reed hull; both ends sweep up and the stern hooks forward. */
function hullGeometry() {
  const g = new THREE.SphereGeometry(1, 64, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ux = p.getX(i), uy = p.getY(i), zn = p.getZ(i);
    const taper = 1 - Math.pow(Math.abs(zn), 3) * 0.85;
    const lift  = Math.max(0, (Math.abs(zn) - 0.45) / 0.55);
    const y = uy * HULL_DEPTH + lift * lift * (zn < 0 ? 5.2 : 3.0);
    const z = zn * HULL.halfLen + (zn < 0 ? Math.pow(lift, 4) * 2.2 : 0);
    p.setXYZ(i, ux * HULL.halfBeam * taper, y, z);
    uv.setXY(i, (zn + 1) / 2, Math.atan2(uy, ux) / Math.PI + 1);
  }
  g.computeVertexNormals();
  return g;
}

/** The pharaoh, modelled ~3 units tall and scaled to a true 1.8 m. The head and
    the gesturing arm are pivots; every piece of regalia is switchable by rank. */
function pharaoh() {
  const g = new THREE.Group();
  const gold    = mat(0xd4a64a, { metalness: 0.7, roughness: 0.35, emissive: 0x3a2604, emissiveIntensity: 0.6 });
  const linen   = mat(0xf0e9da, { roughness: 0.9 });
  const skin    = mat(0x8a5a38, { roughness: 0.8 });
  const stripes = new THREE.MeshStandardMaterial({ map: nemesTexture(), roughness: 0.6 });
  const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 1.5, 20), linen), 0, 0.75, 0);       // robe
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.55, 20), skin), 0, 1.75, 0);        // chest
  const collar = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.4, 0.14, 28), gold), 0, 1.97, 0);

  const head = put(g, new THREE.Group(), 0, 2.05, 0);                                               // neck pivot
  put(head, new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skin), 0, 0.22, 0.02);
  const nemesGeo = new THREE.CylinderGeometry(0.22, 0.38, 0.42, 4, 1);
  const nemesPlain = put(head, new THREE.Mesh(nemesGeo, linen), 0, 0.22, -0.06);
  nemesPlain.rotation.y = Math.PI / 4;
  const nemesStriped = put(head, new THREE.Mesh(nemesGeo, stripes), 0, 0.22, -0.06);
  nemesStriped.rotation.y = Math.PI / 4;
  const lappets = [-1, 1].map(side =>
    put(head, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.06), stripes), side * 0.24, -0.1, 0.12));
  const whiteCrown = put(head, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.62, 20), linen), 0, 0.7, -0.02);
  const redCrown = put(head, new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.22, 20, 1, true),
    mat(0x9a1c18, { side: THREE.DoubleSide })), 0, 0.5, -0.02);
  const uraeus = put(head, new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 8), gold), 0, 0.4, 0.26);
  uraeus.rotation.x = 0.4;

  const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.75, 10);
  armGeo.translate(0, -0.375, 0);
  const rest = put(g, new THREE.Group(), -0.36, 1.9, 0);
  rest.add(new THREE.Mesh(armGeo, skin));
  rest.rotation.set(-0.2, 0, -0.12);
  const arm = put(g, new THREE.Group(), 0.36, 1.9, 0);
  arm.add(new THREE.Mesh(armGeo, skin));
  const crook = put(arm, new THREE.Group(), 0, -0.72, 0.02);
  crook.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), gold));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI * 1.2), gold);
  hook.position.y = 0.55;
  crook.add(hook);
  crook.rotation.x = 1.2;

  const cape = put(g, new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9, 4, 10),
    mat(0x8a1c16, { side: THREE.DoubleSide })), 0, 1.1, -0.38);
  g.scale.setScalar(1.8 / 3.06);
  return {
    group: g, head, arm, cape, capeBase: cape.geometry.attributes.position.array.slice(),
    regalia: { collar, nemesPlain, nemesStriped, lappets, whiteCrown, redCrown, uraeus, crook, cape },
  };
}

/** Rank → regalia: PEASANT bare-headed · SCRIBE linen headcloth · ACOLYTE striped nemes + cape
    · VIZIER gold collar + crook · HIGH PRIEST red crown + uraeus · PHARAOH the white crown too. */
function dressForRank(regalia, name) {
  const lvl = Math.max(0, RANKS.indexOf(name));
  regalia.nemesPlain.visible   = lvl === 1;
  regalia.nemesStriped.visible = lvl >= 2;
  for (const l of regalia.lappets) l.visible = lvl >= 2;
  regalia.cape.visible   = lvl >= 2;
  regalia.collar.visible = lvl >= 3;
  regalia.crook.visible  = lvl >= 3;
  regalia.redCrown.visible = lvl >= 4;
  regalia.uraeus.visible   = lvl >= 4;
  regalia.whiteCrown.visible = lvl >= 5;
}

/** The Shipmaster: a hooded figure whose face you never quite see. */
function shipmaster() {
  const g = new THREE.Group();
  const cloak = mat(0x23202c, { roughness: 0.95 });
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 1.4, 16), cloak);
  robe.position.y = 0.7;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), cloak);
  shoulders.scale.set(1.2, 0.6, 0.9);
  shoulders.position.y = 1.4;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 14), cloak);
  hood.position.y = 1.72;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0x0c0a08));
  face.position.set(0, 1.62, 0.12);
  g.add(robe, shoulders, hood, face);
  return g;
}

/** The overseer: shaved head, leather kilt and cross-strap, whip in hand. Faces the rowers (+z). */
function overseer() {
  const g = new THREE.Group();
  const skin = mat(0x6a4028), leather = mat(0x3a2414, { roughness: 0.9 });
  const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  for (const x of [-0.14, 0.14]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.85, 8), skin), x, 0.42, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.45, 12), leather), 0, 0.95, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.7, 12), skin), 0, 1.5, 0);
  put(g, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.62), leather), 0, 1.5, 0).rotation.z = 0.6;
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin), 0, 2.0, 0);
  const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.65, 8);
  armGeo.translate(0, -0.325, 0);
  const other = put(g, new THREE.Group(), -0.36, 1.78, 0);
  other.add(new THREE.Mesh(armGeo, skin));
  other.rotation.z = -0.3;
  const arm = put(g, new THREE.Group(), 0.36, 1.78, 0);
  arm.add(new THREE.Mesh(armGeo, skin));
  const whipPos = new Float32Array((WHIP_SEGS + 1) * 3);
  const whipGeo = new THREE.BufferGeometry();
  whipGeo.setAttribute('position', new THREE.BufferAttribute(whipPos, 3));
  const whip = new THREE.Line(whipGeo, new THREE.LineBasicMaterial({ color: 0x1a120a }));
  whip.frustumCulled = false;
  arm.add(whip);
  return { group: g, arm, whipGeo, whipPos };
}

/** A rower's torso, rower-local with the origin at the hip and +z toward the way they face (aft):
    a lathed pelvis→waist→ribcage→shoulders profile, flattened front-to-back, with a neck and deltoids. */
function rowerTorsoGeometry() {
  const profile = [[0.001, -0.02], [0.15, 0.0], [0.16, 0.08], [0.125, 0.22], [0.15, 0.36],
                   [0.18, 0.47], [0.19, 0.55], [0.12, 0.62], [0.05, 0.65], [0.001, 0.66]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(profile, 14);
  torso.scale(1, 1, 0.72);
  torso.computeVertexNormals();
  const neck = new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8);
  neck.translate(0, 0.7, 0.03);
  const deltoids = [-1, 1].map(s => { const d = new THREE.SphereGeometry(0.075, 10, 8); d.translate(s * 0.19, 0.55, 0); return d; });
  return mergeGeometries([torso, neck, ...deltoids]);
}

/** A rower's head, same frame: a longish skull bowed forward, a jaw, and ears. */
function rowerHeadGeometry() {
  const skull = new THREE.SphereGeometry(0.1, 14, 12);
  skull.scale(0.9, 1.12, 1.0);
  skull.translate(0, 0.84, 0.07);
  skull.computeVertexNormals();
  const jaw = new THREE.BoxGeometry(0.12, 0.07, 0.1);
  jaw.translate(0, 0.76, 0.11);
  const ears = [-1, 1].map(s => { const e = new THREE.SphereGeometry(0.022, 6, 5); e.translate(s * 0.09, 0.84, 0.06); return e; });
  return mergeGeometries([skull, jaw, ...ears]);
}

export function createShip({ crew = 0, rank = 'PEASANT' } = {}) {
  const group = new THREE.Group();
  const body  = new THREE.Group();
  body.position.y = FREEBOARD;
  group.add(body);
  const wood = mat(0x6e4a26);

  // ── Hull, deck, eyes ──
  body.add(new THREE.Mesh(hullGeometry(), mat(0xffffff, { map: reedTexture(), roughness: 0.9, side: THREE.DoubleSide })));
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 40), mat(0x6a5630));
  deck.scale.set(HULL.halfBeam * 0.9, 1, HULL.halfLen * 0.62);
  deck.position.y = DECK_Y;
  body.add(deck);
  const eyeMat = new THREE.MeshStandardMaterial({ map: eyeTexture(), roughness: 0.7 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), eyeMat);
    eye.position.set(side * 1.9, 0.1, HULL.halfLen * 0.66);
    eye.rotation.y = side * Math.PI / 2;
    body.add(eye);
  }

  // ── Mast, yards and a wide seagoing sail (the rig pivots at the top yard so furling gathers upward) ──
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9.2, 10), wood);
  mast.position.set(0, 4.4, 1.0);
  body.add(mast);
  const rig = new THREE.Group();
  rig.position.set(0, 8.8, 1.5);                  // hung well forward of the mast so the swung, luffing sail clears it
  const topYard = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 11.6, 8), wood);
  topYard.rotation.z = Math.PI / 2;
  const sailGeo  = new THREE.PlaneGeometry(11, 6, 22, 12);
  const sailBase = sailGeo.attributes.position.array.slice();
  const sail = new THREE.Mesh(sailGeo, mat(0xffffff, { map: sailTexture(), roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 }));
  sail.position.y = -3.0;
  const bottomYard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 11.6, 8), wood);
  bottomYard.rotation.z = Math.PI / 2;
  bottomYard.position.y = -3.0;
  sail.add(bottomYard);
  rig.add(topYard, sail);
  body.add(rig);

  // ── Rigging: stays, halyard, lifts carrying the lower yard, brails down the sail, braces and sheets.
  //    Ends on the yards follow the rig every frame, so furling visibly hauls the lower yard up the lifts. ──
  const rigging = (() => {
    const mastHead = new THREE.Vector3(0, 9.0, 1.0);
    const R = (x, y, z) => ({ rig: new THREE.Vector3(x, y, z) });           // a point in the rig's own frame
    const lines = [
      [mastHead, new THREE.Vector3(0, 2.6, HULL.halfLen * 0.88)],             // forestay to the bow
      [mastHead, new THREE.Vector3(0, 3.6, -HULL.halfLen * 0.82)],            // backstay to the stern
      [R(0, 0.1, 0), mastHead],                                                // halyard up to the masthead…
      [mastHead, new THREE.Vector3(0.3, -0.05, 0.4)],                          // …and down to the pin rail
    ];
    for (const x of [-5.2, -3.4, -1.6, 1.6, 3.4, 5.2]) lines.push([mastHead, R(x, -6, 0)]);   // lifts carry the lower yard
    for (const x of [-4.2, -2.1, 2.1, 4.2]) lines.push([R(x, 0, -0.2), R(x, -6, -0.2)]);      // brails gather the sail as it furls
    for (const side of [-1, 1]) {
      lines.push([R(side * 5.6, 0, 0), new THREE.Vector3(side * 1.7, 0.3, -3.8)]);             // braces: top yard → aft deck
      lines.push([R(side * 5.6, -6, 0), new THREE.Vector3(side * 1.9, 0.1, -1.2)]);            // sheets: lower yard → deck
    }
    const pos = new Float32Array(lines.length * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ropes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x3a2e1e }));
    ropes.frustumCulled = false;
    body.add(ropes);
    const tmp = new THREE.Vector3();
    const end = (e) => (e.rig ? tmp.copy(e.rig).applyMatrix4(rig.matrix) : e);
    return {
      update() {
        rig.updateMatrix();
        lines.forEach(([a, b], i) => {
          const pa = end(a); pos[i * 6] = pa.x; pos[i * 6 + 1] = pa.y; pos[i * 6 + 2] = pa.z;
          const pb = end(b); pos[i * 6 + 3] = pb.x; pos[i * 6 + 4] = pb.y; pos[i * 6 + 5] = pb.z;
        });
        geo.attributes.position.needsUpdate = true;
      },
    };
  })();
  rigging.update();

  // ── Stern: a raised platform, the Shipmaster, and his single steering oar ──
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.6), wood);
  platform.position.set(0, 0.7, -6.0);
  body.add(platform);
  const master = shipmaster();
  master.position.set(0.55, 0.83, -6.0);
  body.add(master);
  const steering = new THREE.Group();
  steering.position.set(halfWidthAt(-6.6) * 0.9, 1.4, -6.6);
  const oarBody = new THREE.Group();
  oarBody.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.25, -0.75, -0.6).normalize());
  const loomGeo = new THREE.CylinderGeometry(0.07, 0.08, 6.5, 8);
  loomGeo.translate(0, 2.05, 0);
  const rudderBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.7), wood);
  rudderBlade.position.y = 4.5;
  oarBody.add(new THREE.Mesh(loomGeo, wood), rudderBlade);
  steering.add(oarBody);
  body.add(steering);

  // ── The overseer, in the aisle aft of the benches, facing the rowers ──
  const ov = overseer();
  ov.group.position.set(0, DECK_Y + 0.06, -5.0);
  body.add(ov.group);

  // ── The rowers: your downline, chained to their benches (instanced) ──
  const slaveSkin = mat(0x7a5236, { roughness: 0.75 }), rag = mat(0x5a4a36, { roughness: 1 });
  const iron = mat(0x55504a, { metalness: 0.6, roughness: 0.5 });
  const clothGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.24, 7);
  clothGeo.translate(0, 0.02, 0);
  const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 7);                 // unit segment, stretched per instance
  const handGeo = new THREE.SphereGeometry(1, 8, 6);
  const benchGeo = new THREE.BoxGeometry(0.9, 0.1, 0.34);
  const shackleGeo = new THREE.TorusGeometry(0.07, 0.02, 6, 10);
  const shaftGeo = new THREE.CylinderGeometry(0.035, 0.035, OAR_LEN + OAR_INBOARD, 6);
  shaftGeo.translate(0, (OAR_LEN - OAR_INBOARD) / 2, 0);
  const bladeGeo = new THREE.BoxGeometry(0.05, 0.9, 0.28);
  bladeGeo.translate(0, OAR_LEN - 0.3, 0);
  const instanced = (geo, m, per = 1) => {
    const im = new THREE.InstancedMesh(geo, m, MAX_ROWERS * per);
    im.frustumCulled = false;
    im.count = 0;
    body.add(im);
    return im;
  };
  const torsos = instanced(rowerTorsoGeometry(), slaveSkin), heads = instanced(rowerHeadGeometry(), slaveSkin);
  const cloths = instanced(clothGeo, rag);
  const benches = instanced(benchGeo, wood), shafts = instanced(shaftGeo, wood), blades = instanced(bladeGeo, wood);
  const upperArms = instanced(limbGeo, slaveSkin, 2), forearms = instanced(limbGeo, slaveSkin, 2);
  const hands = instanced(handGeo, slaveSkin, 2);
  const thighs = instanced(limbGeo, slaveSkin, 2), shins = instanced(limbGeo, slaveSkin, 2);
  const shackles = instanced(shackleGeo, iron, 2), chains = instanced(limbGeo, iron, 2);
  const perRower = [torsos, heads, cloths, benches, shafts, blades];
  const perLimb  = [upperArms, forearms, hands, thighs, shins, shackles, chains];

  const dummy = new THREE.Object3D();
  const UP = new THREE.Vector3(0, 1, 0);
  const segDir = new THREE.Vector3();
  /** Instance i of a unit-segment mesh, running from a to b with radius r. */
  function segment(im, i, a, b, r) {
    segDir.subVectors(b, a);
    const len = segDir.length();
    dummy.position.addVectors(a, b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(UP, segDir.divideScalar(len || 1));
    dummy.scale.set(r, len, r);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }

  const armDir = new THREE.Vector3(), armPole = new THREE.Vector3(), handAt = new THREE.Vector3(), elbow = new THREE.Vector3();
  /** Two-bone arm: shoulder → elbow → hand, the elbow bending down and outward; a fist at the end. */
  function arm(i, shoulderAt, hand, poleX) {
    armDir.subVectors(hand, shoulderAt);
    const d = Math.max(0.05, Math.min(armDir.length(), UPPER_ARM + FOREARM - 1e-3));
    armDir.normalize();
    handAt.copy(shoulderAt).addScaledVector(armDir, d);
    const along = (UPPER_ARM * UPPER_ARM - FOREARM * FOREARM + d * d) / (2 * d);
    const lift  = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - along * along));
    armPole.set(poleX, -1, 0);
    armPole.addScaledVector(armDir, -armPole.dot(armDir)).normalize();
    elbow.copy(shoulderAt).addScaledVector(armDir, along).addScaledVector(armPole, lift);
    segment(upperArms, i, shoulderAt, elbow, 0.055);
    segment(forearms, i, elbow, handAt, 0.045);
    dummy.position.copy(handAt);
    dummy.quaternion.identity();
    dummy.scale.setScalar(0.05);
    dummy.updateMatrix();
    hands.setMatrixAt(i, dummy.matrix);
  }

  let seats = [];
  const hipAt = new THREE.Vector3(), knee = new THREE.Vector3(), foot = new THREE.Vector3(), anchor = new THREE.Vector3(), ankle = new THREE.Vector3();
  /** Seat `n` rowers (0..MAX_ROWERS), filling the middle benches first, alternating sides.
      Legs, benches, shackles and chains don't move, so they're laid out here, once. */
  function setCrew(n) {
    const count = Math.max(0, Math.min(MAX_ROWERS, Math.round(n)));
    const mid = (PER_SIDE - 1) / 2;
    const order = [...Array(PER_SIDE).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    const pitch = (BENCH_TO - BENCH_FROM) / PER_SIDE;
    seats = Array.from({ length: count }, (_, k) => {
      const side = k % 2 ? -1 : 1;
      const z = BENCH_FROM + (order[Math.floor(k / 2)] + 0.5) * pitch;
      const half = halfWidthAt(z);
      return {
        side, z, half,
        hip: new THREE.Vector3(side * (half - 0.75), DECK_Y + 0.35, z + 0.45),
        offset: (hash01(k) - 0.5) * 0.5,          // each rower a touch early or late…
        wander: hash01(k + 17) * Math.PI * 2,     // …drifting slowly in and out of time
      };
    });
    seats.forEach((s, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(s.hip.x, s.hip.y - 0.06, s.hip.z);
      dummy.updateMatrix();
      benches.setMatrixAt(i, dummy.matrix);
      for (const [j, dx] of [[0, -0.1], [1, 0.1]]) {
        hipAt.set(s.hip.x + dx, s.hip.y, s.hip.z);
        knee.set(hipAt.x, hipAt.y + 0.02, hipAt.z - 0.4);
        foot.set(hipAt.x, DECK_Y + 0.05, hipAt.z - 0.48);
        segment(thighs, i * 2 + j, hipAt, knee, 0.075);
        segment(shins, i * 2 + j, knee, foot, 0.06);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.position.set(foot.x, DECK_Y + 0.09, foot.z);
        dummy.updateMatrix();
        shackles.setMatrixAt(i * 2 + j, dummy.matrix);
        ankle.set(foot.x, DECK_Y + 0.07, foot.z);
        anchor.set(s.hip.x, DECK_Y + 0.02, s.hip.z - 0.02);
        segment(chains, i * 2 + j, ankle, anchor, 0.015);
      }
    });
    for (const im of perRower) im.count = count;
    for (const im of perLimb) im.count = count * 2;
    for (const im of [benches, thighs, shins, shackles, chains]) im.instanceMatrix.needsUpdate = true;
  }
  setCrew(crew);

  // ── The pharaoh at the prow, and a lantern so the figure reads in the gloom ──
  const ph = pharaoh();
  ph.group.position.set(0, DECK_Y + 0.1, HULL.halfLen * 0.55);
  body.add(ph.group);
  dressForRank(ph.regalia, rank);
  const lantern = new THREE.PointLight(0xffc070, 12, 12, 2);
  lantern.position.set(0, 2.8, HULL.halfLen * 0.55 + 1.0);
  body.add(lantern);

  // ── Bow spray (world-space particles; added to the scene separately) ──
  const sprayPos  = new Float32Array(SPRAY_MAX * 3).fill(-1e4);
  const sprayVel  = new Float32Array(SPRAY_MAX * 3);
  const sprayLife = new Float32Array(SPRAY_MAX);
  const sprayGeo  = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const spray = new THREE.Points(sprayGeo,
    new THREE.PointsMaterial({ color: 0xdfe8ea, size: 0.35, transparent: true, opacity: 0.8, depthWrite: false }));
  spray.frustumCulled = false;
  let nextSpray = 0, sprayCooldown = 0;

  let strokePhase = 0, whipClock = 0;
  const shoulderAt = new THREE.Vector3(), handTarget = new THREE.Vector3(), oarDir = new THREE.Vector3(), lock = new THREE.Vector3();

  return {
    group, spray, setCrew,
    setRank(name) { dressForRank(ph.regalia, name); },
    update(v, dt) {
      group.position.set(v.x, v.hull.y, v.z);
      group.rotation.set(-v.hull.pitch, v.heading, v.hull.roll, 'YXZ');

      // Sail: furls upward with trim, swings toward the wind, fills when it draws, luffs when it doesn't.
      rig.scale.y    = 0.12 + 0.88 * v.sail;
      rig.rotation.y = Math.max(-0.6, Math.min(0.6, wrapAngle(v.windAngle - v.heading) * 0.5));
      rigging.update();                                                  // ropes follow the yards
      const fill = Math.min(1, v.sailDrive / SAIL.drive);
      const sp = sailGeo.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        const bx = sailBase[i * 3], by = sailBase[i * 3 + 1];
        const u = bx / 5.5, w = by / 3.0;
        const bulge   = (1 - u * u) * (1 - w * w);
        const flutter = Math.sin(v.t * 11 + bx * 1.2 + by) * 0.14 * (1 - fill) * (1 - w) * 0.5;
        sp.setZ(i, bulge * fill * 2.4 + Math.abs(flutter));                // flutter only billows forward, never back into the mast
      }
      sp.needsUpdate = true;
      sailGeo.computeVertexNormals();

      steering.rotation.y = -v.rudder * 0.9;

      // Rowers stroke at the effort you set; each slightly out of time.
      if (v.landed || v.sinking) {
        // Beached or going down: the rowers stop, easing to rest at the top of the stroke with oars lifted clear.
        const rest = Math.round(strokePhase / (Math.PI * 2)) * Math.PI * 2;
        strokePhase += (rest - strokePhase) * (1 - Math.exp(-dt / 0.8));
      } else {
        strokePhase += dt * v.rowing * STROKES_AT_FULL * Math.PI * 2;
      }
      seats.forEach((s, i) => {
        const phase = strokePhase + s.offset + 0.12 * Math.sin(v.t * 0.35 + s.wander);
        const lean  = -0.25 - 0.3 * Math.sin(phase);                     // bent over; reaching aft at the catch
        const sweep = Math.sin(phase) * 0.45;
        const elev  = -0.33 + 0.12 * Math.cos(phase);                    // blades bite sweeping aft, lift on the return
        dummy.scale.set(1, 1, 1);
        dummy.position.copy(s.hip);
        dummy.rotation.set(lean, Math.PI, 0);
        dummy.updateMatrix();
        torsos.setMatrixAt(i, dummy.matrix);
        heads.setMatrixAt(i, dummy.matrix);
        cloths.setMatrixAt(i, dummy.matrix);
        oarDir.set(s.side * Math.cos(elev) * Math.cos(sweep), Math.sin(elev), Math.cos(elev) * Math.sin(sweep)).normalize();
        lock.set(s.side * (s.half - 0.05), 0.3, s.z);
        dummy.position.copy(lock);
        dummy.quaternion.setFromUnitVectors(UP, oarDir);
        dummy.updateMatrix();
        shafts.setMatrixAt(i, dummy.matrix);
        blades.setMatrixAt(i, dummy.matrix);
        const cl = Math.cos(lean), sl = Math.sin(lean);
        for (const [j, dx] of [[0, -0.19], [1, 0.19]]) {
          shoulderAt.set(s.hip.x + dx, s.hip.y + 0.56 * cl, s.hip.z + 0.56 * sl);
          handTarget.copy(lock).addScaledVector(oarDir, -(OAR_INBOARD - 0.12) + (j ? 0.09 : -0.09));
          arm(i * 2 + j, shoulderAt, handTarget, dx * 5);
        }
      });
      for (const im of [torsos, heads, cloths, shafts, blades, upperArms, forearms, hands]) im.instanceMatrix.needsUpdate = true;

      // The overseer's whip: wind up, crack, recover — faster the harder they're driven.
      whipClock += dt;
      if (!v.landed && !v.sinking && whipClock > 5.2 - 3 * v.rowing) whipClock = 0;          // beached: the whip is lowered
      const c = Math.min(1, whipClock / 0.7);
      let swing, bend;
      if (c < 0.45)     { const u = c / 0.45;          swing = 0.2 + 2.4 * u; bend = 1.2 * u; }
      else if (c < 0.6) { const u = (c - 0.45) / 0.15; swing = 2.6 - 3.6 * u; bend = 1.2 - 2.0 * u; }
      else              { const u = (c - 0.6) / 0.4;   swing = -1.0 + 1.2 * u; bend = -0.8 + 1.1 * u; }
      ov.arm.rotation.x = swing;
      for (let k = 0; k <= WHIP_SEGS; k++) {
        const u = k / WHIP_SEGS, ang = bend * u * 1.6;
        ov.whipPos[k * 3]     = 0;
        ov.whipPos[k * 3 + 1] = -0.65 - Math.cos(ang) * u * 1.8;
        ov.whipPos[k * 3 + 2] = Math.sin(ang) * u * 1.8;
      }
      ov.whipGeo.attributes.position.needsUpdate = true;

      // The pharaoh keeps his feet against the swell, gazes about, and every 11 s
      // raises his hand (and, once he has one, the crook) toward Crete.
      ph.group.rotation.x = v.hull.pitch * 0.6;
      ph.group.rotation.z = -v.hull.roll * 0.6;
      ph.head.rotation.y = Math.sin(v.t * 0.21) * 0.55 + Math.sin(v.t * 0.53) * 0.15;
      ph.head.rotation.x = 0.08 * Math.sin(v.t * 0.37);
      const cycle = (v.t % 11) / 11;
      const raise = cycle < 0.62 ? 0 : cycle < 0.72 ? (cycle - 0.62) / 0.1 : cycle < 0.9 ? 1 : 1 - (cycle - 0.9) / 0.1;
      ph.arm.rotation.x = -(0.5 + 1.7 * raise * raise * (3 - 2 * raise));

      const cp = ph.cape.geometry.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        const y = ph.capeBase[i * 3 + 1];
        const amount = (0.95 - y) / 1.9;
        cp.setZ(i, -amount * (0.25 + v.speed * 0.03) + Math.sin(v.t * 7 + y * 4) * 0.08 * amount);
      }
      cp.needsUpdate = true;

      // Bow spray when the hull slams down at speed.
      sprayCooldown -= dt;
      if (v.hull.vy < -1.2 && v.speed > 3 && sprayCooldown <= 0) {
        sprayCooldown = 0.35;
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
        const bx = v.x + fx * HULL.halfLen, bz = v.z + fz * HULL.halfLen, by = v.hull.y + FREEBOARD;
        for (let n = 0; n < 16; n++) {
          const i = nextSpray; nextSpray = (nextSpray + 1) % SPRAY_MAX;
          sprayPos.set([bx + (Math.random() - 0.5) * 2, by, bz + (Math.random() - 0.5) * 2], i * 3);
          sprayVel.set([fx * v.speed * 0.4 + (Math.random() - 0.5) * 4, 3 + Math.random() * 4,
                        fz * v.speed * 0.4 + (Math.random() - 0.5) * 4], i * 3);
          sprayLife[i] = 1.2;
        }
      }
      for (let i = 0; i < SPRAY_MAX; i++) {
        if (sprayLife[i] <= 0) { sprayPos[i * 3 + 1] = -1e4; continue; }
        sprayLife[i] -= dt;
        sprayVel[i * 3 + 1] -= 9.81 * dt;
        sprayPos[i * 3]     += sprayVel[i * 3] * dt;
        sprayPos[i * 3 + 1] += sprayVel[i * 3 + 1] * dt;
        sprayPos[i * 3 + 2] += sprayVel[i * 3 + 2] * dt;
      }
      sprayGeo.attributes.position.needsUpdate = true;
    },
  };
}
