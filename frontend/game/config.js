// ── FILE: game/config.js ─────────────────────────────────
// Payout config — owned entirely by the backend.
// Call loadConfig() once after login; all helpers below read from _cfg.
//
// The mutable CFG export has been removed. Payout parameters are not
// user-configurable; they live in backend/app/payout.py and are served
// via GET /api/config. This prevents client-side manipulation and keeps
// a single source of truth.

let _cfg = {
  entryFee:    10,
  platformFee: 2,
  d1Payout:    4.00,
  decay:       0.5,
  minPayout:   0.01,
};

/**
 * Fetch payout parameters from the server and store them locally.
 * Should be called once during init(), before renderPayoutTable().
 * @param {import('./api.js').Api} Api
 */
export async function loadConfig(Api) {
  const data = await Api.get('/api/config');
  if (data && data.payout && !data.error) {
    const p = data.payout;
    _cfg = {
      entryFee:    p.entry_fee    ?? _cfg.entryFee,
      platformFee: p.platform_fee ?? _cfg.platformFee,
      d1Payout:    p.d1_payout    ?? _cfg.d1Payout,
      decay:       p.decay        ?? _cfg.decay,
      minPayout:   p.min_payout   ?? _cfg.minPayout,
    };
  }
}

/** Read-only snapshot of the current server config. */
export function getCFG() { return { ..._cfg }; }

/**
 * Returns the payout amount for a recruit at the given chain depth.
 * Uses a geometric decay: d1Payout × decay^(depth-1).
 * Returns 0 if the computed value is below minPayout.
 * @param {number} d - Chain depth (1 = direct recruit)
 */
export function payoutAtDepth(d) {
  const p = _cfg.d1Payout * Math.pow(_cfg.decay, d - 1);
  return p >= _cfg.minPayout ? Math.round(p * 100) / 100 : 0;
}

/** Returns the deepest chain depth that still pays above minPayout. */
export function maxPayDepth() {
  let d = 1;
  while (payoutAtDepth(d) > 0 && d < 50) d++;
  return d - 1;
}

/**
 * Returns the sum of all depth payouts — the total pool paid out per recruit.
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
