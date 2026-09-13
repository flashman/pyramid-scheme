// ── FILE: worlds/sea/scene.js ────────────────────────────
// THE SEA's three.js scene. Loaded lazily (dynamic import) by SeaRealm and by
// the look-dev harness — never at boot. Reads voyage state; owns no game logic.

import * as THREE from 'three';
import { createSky }         from './gfx/sky.js';
import { createOcean }       from './gfx/ocean.js';
import { createStorm }       from './gfx/storm.js';
import { createChaseCam, stepChaseCam } from './chasecam.js';
import { createPerfMonitor } from './perf.js';

export const VIEW_W = 780;
export const VIEW_H = 540;

export function createSeaScene(canvas, { windAngle }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(VIEW_W, VIEW_H);                 // also pins the CSS size to 780×540
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, VIEW_W / VIEW_H, 0.5, 9000);

  const sky   = createSky(windAngle);
  const ocean = createOcean(windAngle);
  const storm = createStorm();
  scene.add(sky.mesh, ocean.mesh, storm.group);

  // A low amber sun behind (toward Egypt) and a cold sky fill.
  scene.add(new THREE.HemisphereLight(0x3a4260, 0x0a0c10, 0.9));
  const sun = new THREE.DirectionalLight(0xffa060, 0.8);
  scene.add(sun, sun.target);

  // PLACEHOLDER ship — replaced by gfx/ship.js in Task 9.
  const ship = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2, 18), new THREE.MeshStandardMaterial({ color: 0x8a7a3a }));
  scene.add(ship);

  const cam     = createChaseCam();
  const perf    = createPerfMonitor();
  let last = performance.now();

  return {
    render(v, dt) {
      const now = performance.now();
      if (perf.sample(now - last)) { ocean.degrade(); storm.disableRain(); }
      last = now;

      stepChaseCam(cam, v, dt);
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
      camera.rotateZ(cam.roll);
      if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }

      sun.position.set(v.x - Math.sin(windAngle) * 800, 90, v.z - Math.cos(windAngle) * 800);
      sun.target.position.set(v.x, 0, v.z);

      ship.position.set(v.x, v.hull.y, v.z);
      ship.rotation.set(-v.hull.pitch, v.heading, v.hull.roll, 'YXZ');

      storm.update(dt, v, camera);
      sky.update(camera, v, storm.flashLevel, storm.flashDir);
      ocean.update(camera, v, storm.flashLevel, storm.flashDir);
      renderer.render(scene, camera);
    },
    flash(evt) { storm.flash(evt); },
    /** True once the one-shot perf fallback has halved the ocean and dropped rain. */
    get degraded() { return perf.fired; },
    dispose() { renderer.dispose(); },
  };
}
