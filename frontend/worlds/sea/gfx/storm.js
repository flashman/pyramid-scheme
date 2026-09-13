// ── FILE: worlds/sea/gfx/storm.js ────────────────────────
// Lightning (flash envelope, a cold directional light, jagged bolts for near
// strikes) and wind-slanted rain in a box that follows the camera.

import * as THREE from 'three';

const RAIN_COUNT = 2400;
const RAIN_BOX   = 30;      // half-size (m) of the rain volume around the camera (dense near the lens)
const BOLT_NEAR  = 1800;    // strikes closer than this draw a visible bolt

function boltGeometry(x, z, rng) {
  let pts = [new THREE.Vector3(x + (rng() - 0.5) * 200, 900, z + (rng() - 0.5) * 200), new THREE.Vector3(x, 0, z)];
  for (let level = 0; level < 6; level++) {           // midpoint displacement → a jagged bolt
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const mid = a.clone().lerp(b, 0.5);
      const jitter = a.distanceTo(b) * 0.18;
      mid.x += (rng() - 0.5) * jitter;
      mid.z += (rng() - 0.5) * jitter;
      next.push(mid, b);
    }
    pts = next;
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function createStorm({ rng = Math.random } = {}) {
  const group = new THREE.Group();

  // ── Rain: line segments wrapped inside a camera-centred box ──
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  const seeds   = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i++) {
    seeds[i * 3]     = rng() * RAIN_BOX * 2 - RAIN_BOX;
    seeds[i * 3 + 1] = rng() * RAIN_BOX;
    seeds[i * 3 + 2] = rng() * RAIN_BOX * 2 - RAIN_BOX;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xb8c2d0, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  // ── Lightning ──
  const flashLight = new THREE.DirectionalLight(0xc8d4ff, 0);
  group.add(flashLight, flashLight.target);
  const flashDir = new THREE.Vector3(0, 1, 0);
  const flashes = [];          // { t0, power, x, z, bolt }
  let clock = 0, flashLevel = 0, rainEnabled = true;

  const wrap = (v, size) => ((v % size) + size * 1.5) % size - size / 2;

  return {
    group, flashDir,
    get flashLevel() { return flashLevel; },

    disableRain() { rainEnabled = false; rain.visible = false; },

    flash(evt) {
      const f = { t0: clock, power: evt.power, x: evt.x, z: evt.z, bolt: null };
      if (evt.distance < BOLT_NEAR) {
        f.bolt = new THREE.Line(boltGeometry(evt.x, evt.z, rng),
          new THREE.LineBasicMaterial({ color: 0xeef2ff, transparent: true, opacity: 1 }));
        f.bolt.frustumCulled = false;
        group.add(f.bolt);
      }
      flashes.push(f);
    },

    update(dt, v, camera) {
      clock += dt;

      // Flash envelope: a strike, a flicker ~160 ms later, then a fade.
      flashLevel = 0;
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], age = clock - f.t0;
        const env = f.power * (Math.exp(-age / 0.09) + 0.6 * Math.exp(-Math.abs(age - 0.16) / 0.05));
        if (env > flashLevel) {
          flashLevel = env;
          flashDir.set(f.x - camera.position.x, 350, f.z - camera.position.z).normalize();
        }
        if (f.bolt) f.bolt.material.opacity = age < 0.22 ? (Math.sin(age * 90) > -0.3 ? 1 : 0.2) : 0;
        if (age > 1.2) {
          if (f.bolt) { group.remove(f.bolt); f.bolt.geometry.dispose(); f.bolt.material.dispose(); }
          flashes.splice(i, 1);
        }
      }
      flashLight.intensity = flashLevel * 4;
      flashLight.position.copy(camera.position).addScaledVector(flashDir, 500);
      flashLight.target.position.copy(camera.position);

      // Rain fades in from storm 0.5 to 0.7.
      const level = rainEnabled ? Math.min(1, Math.max(0, (v.storm - 0.5) / 0.2)) : 0;
      rain.visible = level > 0;
      if (level === 0) return;
      rainMat.opacity = 0.7 * level;
      const fall = 26;
      const wx = Math.sin(v.windAngle) * 6, wz = Math.cos(v.windAngle) * 6;
      const { x: cx, y: cy, z: cz } = camera.position;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const k = i * 3, o = i * 6;
        const x = cx + wrap(seeds[k] + v.t * wx, RAIN_BOX * 2);
        const y = cy + wrap(seeds[k + 1] - v.t * fall, RAIN_BOX);
        const z = cz + wrap(seeds[k + 2] + v.t * wz, RAIN_BOX * 2);
        rainPos[o]     = x;              rainPos[o + 1] = y;       rainPos[o + 2] = z;
        rainPos[o + 3] = x - wx * 0.1;   rainPos[o + 4] = y + 2.6; rainPos[o + 5] = z - wz * 0.1;
      }
      rainGeo.attributes.position.needsUpdate = true;
    },
  };
}
