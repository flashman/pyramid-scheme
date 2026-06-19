import { planPurchase } from '../buy-plan.js';

const price = { invite_scroll: { price: 5, kind: 'consumable' }, scarab_amulet: { price: 9, kind: 'keepsake' } };
const C = (over) => ({ prices: price, earned: 20, owned: {}, isGuest: false, ...over });

// affordable keepsake
let p = planPurchase('scarab_amulet', C());
if (!p.ok || p.cost !== 9) throw new Error("keepsake plan wrong");

// can't afford
p = planPurchase('scarab_amulet', C({ earned: 2 }));
if (p.ok || p.reason !== 'poor') throw new Error("should be unaffordable");

// already owned keepsake
p = planPurchase('scarab_amulet', C({ owned: { scarab_amulet: true } }));
if (p.ok || p.reason !== 'owned') throw new Error("should reject owned");

// consumable is always re-buyable when affordable
p = planPurchase('invite_scroll', C({ owned: { invite_scroll: true } }));
if (!p.ok || p.kind !== 'consumable') throw new Error("consumable must be re-buyable");

// unknown item
p = planPurchase('nope', C());
if (p.ok || p.reason !== 'unknown') throw new Error("unknown should fail");

console.log("buy smoke OK");
