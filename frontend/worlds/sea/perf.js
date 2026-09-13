// ── FILE: worlds/sea/perf.js ─────────────────────────────
// One-shot quality fallback. Averages frame time over half-second chunks; if
// the average stays above thresholdMs for windowSec, sample() returns true
// once (scene.js then halves the ocean grid and drops rain). Frames > 250 ms
// are tab switches / hitches and ignored.

export function createPerfMonitor({ thresholdMs = 25, windowSec = 3, chunkSec = 0.5 } = {}) {
  let chunkMs = 0, frames = 0, overSec = 0, fired = false;
  return {
    get fired() { return fired; },
    sample(frameMs) {
      if (fired || !(frameMs > 0) || frameMs > 250) return false;
      chunkMs += frameMs; frames++;
      if (chunkMs < chunkSec * 1000) return false;
      overSec = (chunkMs / frames > thresholdMs) ? overSec + chunkMs / 1000 : 0;
      chunkMs = 0; frames = 0;
      if (overSec < windowSec) return false;
      fired = true;
      return true;
    },
  };
}
