// ── FILE: engine/interactables.js ───────────────────────
// Registry that finds the nearest interactable entity each frame.

export class InteractableRegistry {
  constructor() {
    this._items   = [];
    this._nearest = null;
  }

  register(entity) {
    this._items.push(entity);
    return this;
  }

  unregister(id) {
    const was = this._items.find(e => e.id === id);
    this._items = this._items.filter(e => e.id !== id);
    if (this._nearest?.id === id) this._nearest = null;
    return was;
  }

  update(playerX, playerY) {
    let best = null;
    for (const item of this._items) {
      if (!item.active) continue;
      if (item.checkProximity(playerX, playerY)) {
        if (!best) best = item;
      }
    }
    if (best !== this._nearest) {
      this._nearest?.onLeave?.();
      best?.onNear?.();
      this._nearest = best;
    }
    return best;
  }

  interact() {
    if (this._nearest) { this._nearest.onInteract(); return true; }
    return false;
  }

  get nearest() { return this._nearest; }

  updateEntities(ts) {
    for (const item of this._items) if (item.active) item.update(ts);
  }

  drawEntities(camX, camY) {
    for (const item of this._items) {
      if (!item.active) continue;
      const sx = item.worldX - camX;
      const sy = item.worldY - (camY || 0);
      item.draw(sx, sy);
    }
  }

  clear() {
    this._items   = [];
    this._nearest = null;
  }
}
