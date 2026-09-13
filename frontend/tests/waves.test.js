import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVES, MAX_STEEPNESS, baseSteepness, resolveWaves, steepnessSum,
  displace, heightAt, normalAt, glslWaves,
} from '../worlds/sea/waves.js';

const WIND = 0.6;

test('steepness stays within the no-loop limit across the storm range', () => {
  for (let i = 0; i <= 10; i++) {
    assert.ok(steepnessSum(resolveWaves(i / 10, WIND)) <= MAX_STEEPNESS + 1e-9);
  }
});

test('an over-steep param set is clamped to exactly the limit', () => {
  const steep = [{ dir: 0, L: 10, A: 3, Q: 1 }];
  assert.ok(Math.abs(steepnessSum(resolveWaves(1, 0, steep)) - MAX_STEEPNESS) < 1e-9);
});

test('storm raises wave amplitude', () => {
  const calm = resolveWaves(0.1, WIND), rough = resolveWaves(0.9, WIND);
  assert.ok(rough[0].A > calm[0].A * 2);
});

test('heightAt agrees with the displaced surface within 1 cm (fixed-point solve converges)', () => {
  const comps = resolveWaves(1, WIND);
  for (const [x0, z0, t] of [[0, 0, 0], [37.5, -12, 3.2], [-410, 905, 71.9], [1200, -1800, 240]]) {
    const p = displace(comps, x0, z0, t);
    assert.ok(Math.abs(heightAt(comps, p.x, p.z, t) - p.y) < 0.01, `at ${x0},${z0}`);
  }
});

test('flat params give a flat, upright surface', () => {
  const comps = resolveWaves(0.5, WIND, []);
  assert.equal(heightAt(comps, 12, 34, 5), 0);
  assert.deepEqual(normalAt(comps, 12, 34, 5), { x: 0, y: 1, z: 0 });
});

test('normals are unit length', () => {
  const n = normalAt(resolveWaves(0.8, WIND), 40, -70, 12);
  assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-9);
});

test('waves travel: the surface at a point changes over time', () => {
  const comps = resolveWaves(0.5, WIND);
  assert.notEqual(heightAt(comps, 5, 5, 0), heightAt(comps, 5, 5, 1.3));
});

test('glslWaves emits every component and the shared steepness constant', () => {
  const src = glslWaves(WIND);
  const comps = resolveWaves(0, WIND);
  assert.match(src, /vec3 gerstner\(vec2 p, float atten, out vec3 N, out float fold\)/);
  assert.match(src, /uniform float uTime;/);
  assert.match(src, /uniform float uStorm;/);
  assert.ok(src.includes(baseSteepness().toFixed(6)));
  for (const c of comps) {
    assert.ok(src.includes(c.k.toFixed(6)), 'k');
    assert.ok(src.includes(c.w.toFixed(6)), 'w');
    assert.ok(src.includes(c.dx.toFixed(6)), 'dx');
    assert.ok(src.includes(c.dz.toFixed(6)), 'dz');
  }
  assert.equal((src.match(/th = /g) || []).length, WAVES.length);
});
