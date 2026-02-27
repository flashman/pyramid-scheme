// ── FILE: game/config.js ─────────────────────────────────
// Payout config for the pyramid scheme — editable at runtime.

export let CFG = {
  entryFee:    10,
  platformFee: 2,
  d1Payout:    4.00,
  decay:       0.5,
  minPayout:   0.01,
};

/**
 * Returns the payout amount for a recruit at the given chain depth.
 * Uses a geometric decay: d1Payout × decay^(depth-1).
 * Returns 0 if the computed value is below minPayout.
 * @param {number} d - Chain depth (1 = direct recruit)
 */
export function payoutAtDepth(d) {
  const p = CFG.d1Payout * Math.pow(CFG.decay, d - 1);
  return p >= CFG.minPayout ? Math.round(p * 100) / 100 : 0;
}

/** Returns the deepest chain depth that still pays above minPayout. */
export function maxPayDepth() {
  let d = 1;
  while (payoutAtDepth(d) > 0 && d < 50) d++;
  return d - 1;
}

/**
 * Returns the sum of all depth payouts — the total pool paid out per recruit.
 * Should equal entryFee - platformFee for the scheme to balance.
 */
export function totalPool() {
  let sum = 0, d = 1;
  while (true) {
    const p = payoutAtDepth(d);
    if (!p) break;
    sum += p;
    d++;
  }
  return Math.round(sum * 100) / 100;
}
