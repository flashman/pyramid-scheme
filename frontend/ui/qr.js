// ── FILE: ui/qr.js ───────────────────────────────────────
// Renders a QR code onto a <canvas> in the app's colour palette.
//
// Usage:
//   import { drawQR, decodeQRString } from './qr.js';
//   drawQR(canvasEl, decodeQRString(PAYMENT_QR_DATA));

const MOD = 4;       // px per QR module
const PAD = 6;       // quiet-zone padding px
const COL = '#f0c020';
const BG  = '#0a0500';

/**
 * Decode a flat 0/1 string (as produced by gen-qr.py) into a 2D matrix.
 * Dimension is inferred from sqrt(length) — QR matrices are always square.
 * Returns null if the string is missing or still a placeholder.
 */
export function decodeQRString(str) {
  if (!str || str.includes('_')) return null;
  const size = Math.round(Math.sqrt(str.length));
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => str[r * size + c] === '1' ? 1 : 0)
  );
}

/** Generate a random QR-sized noise matrix (for placeholder/fallback display). */
export function randomQRMatrix(size = 41) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.random() < 0.5 ? 1 : 0)
  );
}

/** Draw a 2D matrix onto an existing canvas element. */
export function drawQR(canvas, matrix) {
  const size = matrix.length;
  const dim  = size * MOD + PAD * 2;
  canvas.width  = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, dim, dim);
  const r = MOD * 0.44;
  ctx.fillStyle = COL;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row][col]) {
        const cx = PAD + col * MOD + MOD / 2;
        const cy = PAD + row * MOD + MOD / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
