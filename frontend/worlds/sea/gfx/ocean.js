// ── FILE: worlds/sea/gfx/ocean.js ────────────────────────
// The ocean: a camera-following, centre-dense grid displaced by the GENERATED
// Gerstner function (waves.js), shaded with Fresnel sky reflection, crest glow,
// crest + wake foam, lightning glints, and fog into the horizon colour.

import * as THREE from 'three';
import { glslWaves } from '../waves.js';
import { SKY_GLSL } from './sky.js';
import { WAKE } from '../constants.js';

const EXTENT = 4200;   // grid half-size (m)
const SNAP   = 4;      // the grid moves with the camera in whole steps of this

/** (n+1)² vertices; spacing ≈1.2 m under the camera growing to ≈60 m at the edge. */
function buildGrid(n) {
  const pos  = new Float32Array((n + 1) * (n + 1) * 3);
  const warp = (u) => Math.sign(u) * (0.04 * Math.abs(u) + 0.96 * Math.pow(Math.abs(u), 2.6)) * EXTENT;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = (j * (n + 1) + i) * 3;
      pos[k] = warp(i / n * 2 - 1); pos[k + 1] = 0; pos[k + 2] = warp(j / n * 2 - 1);
    }
  }
  const idx = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createOcean(windAngle, { grid = 280 } = {}) {
  const uniforms = {
    uTime: { value: 0 }, uStorm: { value: 0.1 }, uSkyTime: { value: 0 },
    uWindAngle: { value: windAngle }, uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
    uOffset: { value: new THREE.Vector2() }, uCamPos: { value: new THREE.Vector3() }, uShip: { value: new THREE.Vector2() },
    uDeep:  { value: new THREE.Color(0.004, 0.020, 0.028) },
    uCrest: { value: new THREE.Color(0.030, 0.160, 0.140) },
    uWake:  { value: Array.from({ length: WAKE.max }, () => new THREE.Vector3(0, 1e4, 1e4)) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: glslWaves(windAngle) + /* glsl */`
      uniform vec2 uOffset;
      uniform vec3 uCamPos;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vFold;
      void main() {
        vec2 p = position.xz + uOffset;
        float atten = 1.0 - smoothstep(900.0, 3600.0, length(p - uCamPos.xz));
        vec3 N; float fold;
        vec3 w = gerstner(p, atten, N, fold);
        vWorld = w; vNormal = N; vFold = fold;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      uniform vec3 uCamPos;
      uniform vec3 uDeep;
      uniform vec3 uCrest;
      uniform vec2 uShip;
      uniform vec3 uWake[${WAKE.max}];
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vFold;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 toCam = uCamPos - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);

        // Body colour: near-black depths, a green-teal glow through high crests.
        vec3 col = mix(uDeep, uCrest, clamp(vWorld.y / (0.8 + 2.5 * uStorm), 0.0, 1.0) * 0.7);
        col = mix(col, skyColorCheap(R), fres);
        col += vec3(0.8, 0.85, 1.0) * pow(max(dot(R, uFlashDir), 0.0), 80.0) * uFlash * 2.5;

        // Crest foam where the surface pinches (fold < 1), broken up by noise.
        float foam = clamp((0.86 - vFold) / 0.22, 0.0, 1.0)
                   * smoothstep(0.35, 0.75, fbm(vWorld.xz * 0.22 + uSkyTime * 0.05));
        // Wake foam along the ship's recent track (z = seconds since laid).
        if (length(vWorld.xz - uShip) < 140.0) {
          for (int i = 0; i < ${WAKE.max}; i++) {
            float age = uWake[i].z;
            float d = length(vWorld.xz - uWake[i].xy);
            float trail = (1.0 - smoothstep(0.6 + age * 0.25, 1.6 + age * 0.5, d)) * exp(-age * 0.35);
            trail *= smoothstep(0.25, 0.8, age);                                   // starts behind the hull, not under it
            trail *= 0.35 + 0.65 * smoothstep(0.3, 0.7, fbm(vWorld.xz * 0.9 + age));  // broken, not a carpet
            foam = max(foam, trail * 0.6);
          }
        }
        col = mix(col, vec3(0.62, 0.66, 0.68), foam);

        // Fog into the horizon colour in this exact direction.
        float fog = 1.0 - exp(-pow(dist * (0.00032 + 0.0005 * uStorm), 1.5));
        col = mix(col, skyColorCheap(normalize(vec3(-V.x, 0.015, -V.z))), clamp(fog, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(buildGrid(grid), material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;

  return {
    mesh,
    update(camera, v, flash, flashDir) {
      uniforms.uOffset.value.set(Math.round(camera.position.x / SNAP) * SNAP, Math.round(camera.position.z / SNAP) * SNAP);
      uniforms.uCamPos.value.copy(camera.position);
      uniforms.uTime.value = v.t;
      uniforms.uSkyTime.value = v.t;
      uniforms.uStorm.value = v.storm;
      uniforms.uFlash.value = flash;
      uniforms.uFlashDir.value.copy(flashDir);
      uniforms.uShip.value.set(v.x, v.z);
      for (let i = 0; i < WAKE.max; i++) {
        const w = v.wake[v.wake.length - 1 - i];
        if (w) uniforms.uWake.value[i].set(w.x, w.z, v.t - w.t);
        else   uniforms.uWake.value[i].set(0, 1e4, 1e4);
      }
    },
    degrade() {
      mesh.geometry.dispose();
      mesh.geometry = buildGrid(Math.floor(grid / 2));
    },
  };
}
