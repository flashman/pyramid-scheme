// ── FILE: game/inventory.js ──────────────────────────────
// Client mirror of the server inventory. Hydrated from GET /api/me and
// WS inventory_update; read by buy.js, StallOverlay, and NPC hooks
// (replacing the old shop_owned_* flags). For guests it is the sole store.

import { Events } from '../engine/events.js';

export const Inventory = {
  _store: {},   // item_id → { quantity, equipped }

  /** Replace the whole store from a server list [{item_id, quantity, equipped}]. */
  hydrate(list) {
    this._store = {};
    for (const r of (list || [])) this._store[r.item_id] = { quantity: r.quantity, equipped: !!r.equipped };
    Events.emit('inventory:change', {});
  },

  owned(id)      { return (this._store[id]?.quantity || 0) >= 1; },
  qty(id)        { return this._store[id]?.quantity || 0; },
  isEquipped(id) { return !!this._store[id]?.equipped; },

  /** Snapshot as a server-shaped list. */
  all() {
    return Object.entries(this._store).map(([item_id, v]) =>
      ({ item_id, quantity: v.quantity, equipped: v.equipped }));
  },

  /** Guest-only local grant: keepsake caps at 1, consumable stacks. */
  addLocal(id, kind) {
    const cur = this._store[id];
    if (!cur) this._store[id] = { quantity: 1, equipped: false };
    else if (kind === 'consumable') cur.quantity += 1;
    Events.emit('inventory:change', {});
  },

  clear() { this._store = {}; Events.emit('inventory:change', {}); },
};
