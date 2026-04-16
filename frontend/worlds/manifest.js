// ── FILE: worlds/manifest.js ──────────────────────────────
// Single registration point for all realms.
//
// To add a new realm:
//   1. Import its class here
//   2. Add `new MyRealm()` to ALL_REALMS
//   3. Register portals in MyRealm's constructor (where `this` is available)
//   4. If the new realm is reachable from an existing realm, also register
//      the inbound portal in the existing realm's constructor, OR register
//      it here after both realm instances exist (use PortalRegistry directly).
//
// main.js never needs to change for new realms.

import { WorldRealm }    from './earth/WorldRealm.js';
import { OasisRealm }    from './oasis/OasisRealm.js';
import { VaultRealm }    from './oasis/VaultRealm.js';
import { AtlantisRealm } from './atlantis/AtlantisRealm.js';
import { DeepRealm }     from './deep/DeepRealm.js';
import { ChamberRealm }  from './crypt/ChamberRealm.js';
import { CouncilRealm }  from './council/CouncilRealm.js';

// Instantiating each realm also registers its outgoing portals
// (each constructor calls PortalRegistry.register() internally).
export const ALL_REALMS = [
  new WorldRealm(),
  new OasisRealm(),
  new VaultRealm(),
  new AtlantisRealm(),
  new DeepRealm(),
  new ChamberRealm(),
  new CouncilRealm(),
];
