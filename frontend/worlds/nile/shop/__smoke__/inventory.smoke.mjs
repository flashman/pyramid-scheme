// frontend/worlds/nile/shop/__smoke__/inventory.smoke.mjs
import { Inventory } from '../../../../game/inventory.js';

Inventory.hydrate([{ item_id: 'scarab_amulet', quantity: 1, equipped: false },
                   { item_id: 'invite_scroll', quantity: 3, equipped: false }]);
if (!Inventory.owned('scarab_amulet')) throw new Error('owned() wrong');
if (Inventory.qty('invite_scroll') !== 3) throw new Error('qty() wrong');
if (Inventory.owned('bronze_coin')) throw new Error('unowned should be false');
if (Inventory.isEquipped('scarab_amulet')) throw new Error('equipped should be false');

// guest local add: keepsake caps at 1, consumable stacks
Inventory.clear();
Inventory.addLocal('scarab_amulet', 'keepsake');
Inventory.addLocal('scarab_amulet', 'keepsake');
if (Inventory.qty('scarab_amulet') !== 1) throw new Error('keepsake must cap at 1');
Inventory.addLocal('invite_scroll', 'consumable');
Inventory.addLocal('invite_scroll', 'consumable');
if (Inventory.qty('invite_scroll') !== 2) throw new Error('consumable must stack');

console.log('inventory smoke OK');
