// ── FILE: worlds/nile/shop/buy-plan.js ───────────────────
// Pure purchase-decision logic. No side-effecting imports (catalogue only),
// so it runs under node for the smoke test. buy.js wraps this with effects.

import { WARES_BY_ID } from './catalogue.js';

/**
 * Pure decision: can this buy proceed, and what does it cost/do?
 * @param {string} itemId
 * @param {{prices:object, earned:number, owned:object, isGuest:boolean}} ctx
 *   prices[id] = { name, price, kind }  (the getShop() shape)
 * @returns {{ok:boolean, reason?:string, cost?:number, kind?:string}}
 *   reason ∈ 'unknown' | 'poor' | 'owned'
 */
export function planPurchase(itemId, { prices, earned, owned }) {
  const meta = WARES_BY_ID[itemId];
  const priced = prices[itemId];
  if (!meta || !priced) return { ok: false, reason: 'unknown' };
  const kind = priced.kind;                 // 'consumable' | 'keepsake'
  if (kind === 'keepsake' && owned[itemId]) return { ok: false, reason: 'owned' };
  if (earned < priced.price)               return { ok: false, reason: 'poor', cost: priced.price };
  return { ok: true, cost: priced.price, kind };
}
