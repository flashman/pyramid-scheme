// Pure check: getShop reflects what loadConfig stored. Stubs the Api.
import { loadConfig, getShop, shopLoaded } from '../../../../game/config.js';

const fakeApi = { get: async () => ({
  payout: { entry_fee: 10 },
  shop: { invite_scroll: { name: "Invite Scroll", price: 5, kind: "consumable" } },
}) };

await loadConfig(fakeApi);
if (!shopLoaded()) throw new Error("shopLoaded() should be true after loadConfig");
const s = getShop();
if (s.invite_scroll.price !== 5) throw new Error("price not stored");
console.log("config smoke OK");
