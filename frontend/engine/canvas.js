// ── FILE: engine/canvas.js ───────────────────────────────
// Canvas element + 2D context. Loaded first so every system
// can use X (the drawing context) and the screen dimensions.

export const C  = document.getElementById('c');
export const X  = C.getContext('2d');
export const CW = 780;
export const CH = 540;
