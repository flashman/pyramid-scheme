// ── FILE: worlds/nile/shop/buy.js ────────────────────────
// Bazaar purchase flow. Pure planning (planPurchase) + side-effecting
// purchase() — server-authoritative for accounts, local for guests.
// Ownership lives in the Inventory store (not flags).

import { G }            from '../../../game/state.js';
import { Api }          from '../../../game/api.js';
import { getShop }      from '../../../game/config.js';
import { Inventory }    from '../../../game/inventory.js';
import { WARES_BY_ID }  from './catalogue.js';
import { planPurchase } from './buy-plan.js';
import { updateStats, updateSlots, log } from '../../../ui/panels.js';

// Re-export the pure decision so callers can import it from here.
export { planPurchase } from './buy-plan.js';

function _ownedMap() {
  const m = {};
  for (const id of Object.keys(getShop())) m[id] = Inventory.owned(id);
  return m;
}

const _BARK = {
  poor:    '✦ THE MERCHANT SMILES. "COME BACK WITH BELIEF. AND CREDITS."',
  owned:   '✦ "YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER."',
  unknown: '✦ The stall is empty where that was.',
  fail:    '✦ "THE PAPYRUS IS NOT READY. TRY AGAIN."',
};

export async function purchase(itemId) {
  const plan = planPurchase(itemId, {
    prices: getShop(), earned: G.earned, owned: _ownedMap(), isGuest: G.isGuest,
  });
  // poor/owned are voiced by the merchant in the stall (#dlg retort); only log
  // genuine errors here so the side panel isn't double-narrating.
  if (!plan.ok) {
    if (plan.reason !== 'poor' && plan.reason !== 'owned') log(_BARK[plan.reason] || _BARK.fail, '');
    return plan;
  }

  const meta = WARES_BY_ID[itemId];

  if (G.isGuest) {
    // Local-only, like guest recruits. Keepsakes are held; consumables are
    // effect-only (mirrors the server: no inventory row for consumables).
    G.earned = Math.round((G.earned - plan.cost) * 100) / 100;
    // +1 mirrors SHOP_CATALOGUE["invite_scroll"].effect.amount (the server source of
    // truth, which /api/config does not expose). Keep in sync if that amount changes.
    if (plan.kind === 'consumable') { G.invitesLeft += 1; updateSlots(); }
    else                            { Inventory.addLocal(itemId); }
    updateStats();
    log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
    return plan;
  }

  // Authenticated: server is authoritative; apply its response.
  const resp = await Api.buyItem(itemId);
  if (!resp || resp.error || resp.detail) { log(_BARK.fail, ''); return { ok: false, reason: 'fail' }; }
  G.earned      = resp.earned;
  G.invitesLeft = resp.invites_left;
  Inventory.hydrate(resp.inventory);
  updateStats(); updateSlots();
  log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
  return plan;
}

/** Owned-state helper for the overlay. */
export function isOwned(itemId) { return Inventory.owned(itemId); }
