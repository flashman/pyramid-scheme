// ── FILE: ui/inventory-panel.js ───────────────────────────
// Renders the player's owned keepsakes in #inventory-panel.
// Updated on every inventory:change event.

import { Events }     from '../engine/events.js';
import { Inventory }  from '../game/inventory.js';
import { getShop }   from '../game/config.js';
import { drawWareArt } from '../worlds/nile/shop/ware-art.js';

function makeIconSrc(itemId) {
  const cv = document.createElement('canvas');
  cv.width = 28; cv.height = 28;
  drawWareArt(cv.getContext('2d'), itemId, 14, 14, 20, Date.now());
  return cv.toDataURL();
}

function render() {
  const list = document.getElementById('inventory-list');
  if (!list) return;

  const shop  = getShop();
  const owned = Inventory.all().filter(i => i.quantity >= 1);

  if (owned.length === 0) {
    list.innerHTML = '<div class="inv-empty">none yet — visit the Nile bazaar</div>';
    return;
  }

  list.innerHTML = '';
  for (const i of owned) {
    const info = shop[i.item_id] || {};
    const name = info.name || i.item_id;
    const div = document.createElement('div');
    div.className = 'inv-item';
    div.innerHTML = `<img class="inv-icon" src="${makeIconSrc(i.item_id)}" alt=""><span class="inv-item-name">${name}</span>`;
    div.style.cursor = 'pointer';
    div.onclick = () => Events.emit('inventory:use', { item_id: i.item_id });
    list.appendChild(div);
  }
}

export function initInventoryPanel() {
  document.getElementById('inventory-panel')?.removeAttribute('style');
  Events.on('inventory:change', render);
  render();
}
