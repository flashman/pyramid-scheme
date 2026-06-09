// ── FILE: game/payment.js ────────────────────────────────
// Payment QR data for the guest buy-in dialog.
//
// PAYMENT_QR_DATA is a flat string of 1s and 0s representing the QR matrix.
// At deploy time, Render's build step replaces __PAYMENT_QR_DATA__ via sed.
//
// To generate a new value for any payment URL:
//   python3 scripts/gen-qr.py 'YOUR_URL'
// Copy the compact string from the output and set it as the
// PAYMENT_QR_DATA environment variable in the Render dashboard.

export const PAYMENT_QR_DATA = '__PAYMENT_QR_DATA__';
