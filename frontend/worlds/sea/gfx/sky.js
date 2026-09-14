// ── FILE: worlds/sea/gfx/sky.js ──────────────────────────
// Dusk sky dome + storm clouds. SKY_GLSL is shared with the ocean shader so
// reflections and fog use the same colours as the dome.

import * as THREE from 'three';

export const SKY_GLSL = /* glsl */`
uniform float uWindAngle;
uniform float uStorm;
uniform float uFlash;
uniform vec3  uFlashDir;
uniform float uSkyTime;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// +1 looking toward Crete (downwind), -1 looking back toward Egypt.
float aheadness(vec3 dir) {
  return dot(normalize(dir.xz + vec2(1e-5)), vec2(sin(uWindAngle), cos(uWindAngle)));
}

vec3 skyBase(vec3 dir) {
  float ahead = aheadness(dir);
  vec3 amber  = vec3(0.62, 0.30, 0.14);
  vec3 bruise = vec3(0.30, 0.16, 0.20);
  vec3 slate  = vec3(0.10, 0.12, 0.16);
  vec3 indigo = vec3(0.03, 0.035, 0.07);
  // The amber band behind you narrows as the storm rises.
  float band = 1.0 - smoothstep(-0.9, 0.1 + 0.5 * uStorm, ahead);
  vec3 horizon = mix(slate, mix(bruise, amber, band), band);
  vec3 col = mix(horizon, indigo, pow(clamp(dir.y, 0.0, 1.0), 0.45));
  return col * (1.0 - 0.35 * uStorm);
}

float cloudCover(vec3 dir) {
  float ahead = aheadness(dir);
  return clamp(mix(0.25, 0.85, uStorm) * smoothstep(-0.5, 0.7, ahead) + 0.45 * uStorm, 0.0, 1.0);
}

// Cheap version for ocean reflections and fog — no per-pixel noise.
vec3 skyColorCheap(vec3 dir) {
  vec3 col = mix(skyBase(dir), vec3(0.08, 0.085, 0.10), cloudCover(dir) * 0.7);
  float lit = pow(max(dot(dir, uFlashDir), 0.0), 6.0) * uFlash;
  return col + vec3(0.75, 0.8, 1.0) * lit * 0.8 + vec3(0.5, 0.55, 0.7) * uFlash * 0.06;
}

vec3 skyColor(vec3 dir) {
  float up = max(dir.y, 0.0);
  float ahead = aheadness(dir);
  vec2 wind = vec2(sin(uWindAngle), cos(uWindAngle));
  vec2 uv = dir.xz / (up + 0.12) * 0.9 + wind * uSkyTime * 0.012;
  float cover = cloudCover(dir);
  float d = smoothstep(1.0 - cover, 1.0 - cover + 0.35, fbm(uv));
  // The anvil: one towering mass low over Crete.
  float anvil = smoothstep(0.93, 1.0, ahead) * (1.0 - smoothstep(0.0, 0.32 + 0.1 * fbm(dir.xz * 6.0), up));
  d = clamp(max(d, anvil * (0.6 + 0.4 * fbm(dir.xz * 9.0 + uSkyTime * 0.01))), 0.0, 1.0);
  vec3 cloud = mix(vec3(0.05, 0.055, 0.07), vec3(0.16, 0.15, 0.17), fbm(uv * 1.7));
  cloud += vec3(0.75, 0.8, 1.0) * pow(max(dot(dir, uFlashDir), 0.0), 6.0) * uFlash * 1.6;
  vec3 col = mix(skyBase(dir), cloud, d);
  col += vec3(0.5, 0.55, 0.7) * uFlash * 0.06;
  // At the horizon, converge on the cheap colour so ocean fog meets the dome seamlessly.
  return mix(skyColorCheap(dir), col, smoothstep(0.0, 0.08, dir.y));
}
`;

export function createSky(windAngle) {
  const uniforms = {
    uWindAngle: { value: windAngle }, uStorm: { value: 0.1 }, uFlash: { value: 0 },
    uFlashDir: { value: new THREE.Vector3(0, 1, 0) }, uSkyTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;   // pinned to the far plane
      }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    update(camera, v, flash, flashDir) {
      mesh.position.copy(camera.position);
      uniforms.uStorm.value = v.storm;
      uniforms.uSkyTime.value = v.t;
      uniforms.uFlash.value = flash;
      uniforms.uFlashDir.value.copy(flashDir);
    },
  };
}
