// ── FILE: engine/webgl.js ────────────────────────────────
// Capability probe for WebGL2 (THE SEA renders with three.js, which needs it).
// Cached after the first call; the probe context is released immediately.

let _ok = null;

export function webglAvailable() {
  if (_ok !== null) return _ok;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    _ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    _ok = false;
  }
  return _ok;
}
