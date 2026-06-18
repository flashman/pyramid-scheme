// ── FILE: worlds/nile/shop/buy.js ────────────────────────
// Bazaar purchase flow. Pure planning (planPurchase) + side-effecting
// purchase() that hits the server for accounts and stays local for guests.

import { G }            from '../../../game/state.js';
import { Flags }        from '../../../engine/flags.js';
import { Api }          from '../../../game/api.js';
import { getShop }      from '../../../game/config.js';
import { WARES_BY_ID }  from './catalogue.js';
import { planPurchase, ownedKey } from './buy-plan.js';
import { updateStats, updateSlots, log } from '../../../ui/panels.js';

// Re-export the pure decision so callers can `import { planPurchase } from './buy.js'`.
export { planPurchase } from './buy-plan.js';

function _ownedMap() {
  const shop = getShop();
  const m = {};
  for (const id of Object.keys(shop)) m[id] = Flags.get(ownedKey(id), false);
  return m;
}

const _BARK = {
  poor:    '✦ THE MERCHANT SMILES. "COME BACK WITH BELIEF. AND CREDITS."',
  owned:   '✦ "YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER."',
  unknown: '✦ The stall is empty where that was.',
  fail:    '✦ "THE PAPYRUS IS NOT READY. TRY AGAIN."',
};

/**
 * Attempt to buy `itemId`. Returns the plan result. On success, mutates G,
 * Flags, and refreshes the HUD; the StallOverlay re-reads state on its next render.
 */
export async function purchase(itemId) {
  const prices = getShop();
  const plan = planPurchase(itemId, {
    prices, earned: G.earned, owned: _ownedMap(), isGuest: G.isGuest,
  });
  if (!plan.ok) { log(_BARK[plan.reason] || _BARK.fail, ''); return plan; }

  const meta = WARES_BY_ID[itemId];

  if (G.isGuest) {
    // Local-only, exactly like guest recruits.
    G.earned = Math.round((G.earned - plan.cost) * 100) / 100;
    if (plan.kind === 'consumable') { G.invitesLeft += 1; updateSlots(); }
    else                            { Flags.set(ownedKey(itemId), true); }
    updateStats();
    log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
    return plan;
  }

  // Authenticated: server is authoritative. No optimistic deduction.
  const resp = await Api.buyItem(itemId);
  if (!resp || resp.error || resp.detail) { log(_BARK.fail, ''); return { ok: false, reason: 'fail' }; }
  G.earned      = resp.earned;
  G.invitesLeft = resp.invites_left;
  if (plan.kind !== 'consumable') Flags.set(ownedKey(itemId), true);
  updateStats(); updateSlots();
  log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
  return plan;
}

/** Owned-state helper for the overlay. */
export function isOwned(itemId) { return Flags.get(ownedKey(itemId), false); }
