import { WARES, WARES_BY_ID } from '../catalogue.js';

const ids = WARES.map(w => w.id);
if (new Set(ids).size !== ids.length) throw new Error("duplicate ware ids");
for (const w of WARES) {
  if (!w.name || !w.glyph || !w.blurb || !w.tier) throw new Error(`incomplete ware ${w.id}`);
  if ('price' in w) throw new Error(`ware ${w.id} must not hardcode a price`);
}
if (WARES_BY_ID.invite_scroll.tier !== 'SCROLLS') throw new Error("index broken");
console.log(`catalogue smoke OK (${WARES.length} wares)`);
