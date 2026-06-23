// ── FILE: ui/inventory-panel.js ───────────────────────────
// Renders the player's owned keepsakes in #inventory-panel.
// Updated on every inventory:change event.

import { Events }   from '../engine/events.js';
import { Inventory } from '../game/inventory.js';
import { getShop }  from '../game/config.js';

function render() {
  const list = document.getElementById('inventory-list');
  if (!list) return;

  const shop  = getShop();
  const owned = Inventory.all().filter(i => i.quantity >= 1);

  if (owned.length === 0) {
    list.innerHTML = '<div class="inv-empty">none yet — visit the Nile bazaar</div>';
    return;
  }

  list.innerHTML = owned.map(i => {
    const info = shop[i.item_id] || {};
    const name = info.name || i.item_id;
    return `<div class="inv-item">
      <span class="inv-item-name">${name}</span>
    </div>`;
  }).join('');
}

export function initInventoryPanel() {
  document.getElementById('inventory-panel')?.removeAttribute('style');
  Events.on('inventory:change', render);
  render();
}
