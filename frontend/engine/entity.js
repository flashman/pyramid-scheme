// ── FILE: engine/entity.js ───────────────────────────────
// Base Entity and NPC classes.

import { DialogueManager } from './dialogue.js';

export class Entity {
  constructor(id, worldX, worldY) {
    this.id            = id;
    this.worldX        = worldX;
    this.worldY        = worldY;
    this.active        = true;
    this.interactRange = 80;
    this.interactHint  = 'SPACE';
  }

  update(ts) {}
  draw(screenX, screenY) {}

  checkProximity(px, py) {
    return Math.hypot(px - this.worldX, py - this.worldY) < this.interactRange;
  }

  onNear()     {}
  onLeave()    {}
  onInteract() {}
}

export class NPC extends Entity {
  constructor(id, worldX, worldY, name, dialogue) {
    super(id, worldX, worldY);
    this.name     = name;
    this.dialogue = dialogue;
    this.facing   = 1;
    this.frame    = 0;
    this.moving   = false;
  }

  onInteract() {
    if (this.dialogue) DialogueManager.start(this.dialogue);
  }
}
