// ── FILE: ui/inventory-panel.js ───────────────────────────
// Renders the player's owned keepsakes in #inventory-panel.
// Updated on every inventory:change event.

import { Events }   from '../engine/events.js';
import { Inventory } from '../game/inventory.js';
import { getShop }  from '../game/config.js';

function render() {
  const panel = document.getElementById('inventory-panel');
  const list  = document.getElementById('inventory-list');
  if (!panel || !list) return;

  const shop   = getShop();
  const owned  = Inventory.all().filter(i => i.quantity >= 1);
  const keepsakes = owned.filter(i => shop[i.item_id]?.kind === 'keepsake');

  if (keepsakes.length === 0) {
    panel.classList.remove('has-items');
    list.innerHTML = '';
    return;
  }

  panel.classList.add('has-items');
  list.innerHTML = keepsakes.map(i => {
    const info = shop[i.item_id] || {};
    const name = info.name || i.item_id;
    return `<div class="inv-item">
      <span class="inv-item-name">${name}</span>
      <span class="inv-item-kind">relic</span>
    </div>`;
  }).join('');
}

export function initInventoryPanel() {
  Events.on('inventory:change', render);
  render();
}
