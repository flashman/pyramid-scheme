// ── FILE: engine/health.js ──────────────────────────────────────────────────
//
// HealthSystem — decoupled player damage, death-screen, and respawn logic.
//
// Extracts the _dying/_dyingT/_immuneUntil/_killPlayer/_respawn pattern
// that was inline in AtlantisRealm into a standalone class that any realm
// can own and drive. Nothing here is Atlantis-specific.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//
//   import { HealthSystem } from '../../engine/health.js';
//
//   // In realm constructor:
//   this.health = new HealthSystem({
//     respawnDelay: 2800,
//     immunityAfterSpawn: 3000,
//     onKill:    (cause, msg) => { G.shake = 22; log(msg.split('\n')[0], 'hi'); },
//     onRespawn: ()           => { this.resetToEntry(200); G.shake = 8; },
//   });
//
//   // In realm update() — before any other logic:
//   if (this.health.update()) return;   // returns true while dying → skip physics
//
//   // To kill the player from enemy/hazard logic:
//   if (!this.health.canTakeDamage()) return;
//   if (enemyHit) this.health.kill('shark', _pickDeathMsg('shark', deaths));
//
//   // In render() — draw death overlay while dying:
//   this.health.renderDeathOverlay(deathMsg, deathCause, t);
//   // (or call your own draw function and pass health.isDying / health.deathT)
//
// ─────────────────────────────────────────────────────────────────────────────

export class HealthSystem {
  /**
   * @param {object} opts
   * @param {number}   opts.respawnDelay        - ms after kill before respawn fires (default 2800)
   * @param {number}   opts.immunityAfterSpawn  - ms of post-respawn invincibility (default 3000)
   * @param {function} opts.onKill              - (cause: string, msg: string) => void
   *                                              Called immediately on kill, before the death screen.
   * @param {function} opts.onRespawn           - () => void
   *                                              Called once the respawn delay elapses.
   *                                              Responsible for repositioning the player.
   */
  constructor({
    respawnDelay       = 2800,
    immunityAfterSpawn = 3000,
    onKill             = null,
    onRespawn          = null,
  } = {}) {
    this._respawnDelay       = respawnDelay;
    this._immunityAfterSpawn = immunityAfterSpawn;
    this._onKill             = onKill;
    this._onRespawn          = onRespawn;

    this._dying       = false;
    this._dyingT      = 0;
    this._deathMsg    = '';
    this._deathCause  = '';
    this._immuneUntil = 0;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get isDying()   { return this._dying; }
  get deathMsg()  { return this._deathMsg; }
  get deathCause(){ return this._deathCause; }

  /**
   * Milliseconds elapsed since the kill — useful for death-screen fade-in.
   * Returns 0 if not currently dying.
   */
  get deathElapsed() {
    return this._dying ? Date.now() - this._dyingT : 0;
  }

  /**
   * True when the player can take damage (not dying, not immune).
   * Check this before calling kill() from enemy/hazard code.
   */
  canTakeDamage() {
    return !this._dying && Date.now() >= this._immuneUntil;
  }

  // ── Control ────────────────────────────────────────────────────────────────

  /**
   * Kill the player.
   *
   * @param {string} cause - Semantic cause tag ('shark', 'choir', etc.) passed to onKill
   * @param {string} msg   - Death screen message text (multi-line OK with \n)
   */
  kill(cause, msg) {
    if (!this.canTakeDamage()) return;
    this._dying      = true;
    this._dyingT     = Date.now();
    this._deathMsg   = msg;
    this._deathCause = cause;
    this._onKill?.(cause, msg);
  }

  /**
   * Grant temporary invincibility.
   * Typically called from onEnter() so the player isn't immediately hit on realm entry.
   *
   * @param {number} ms - Immunity duration in milliseconds
   */
  setImmunity(ms) {
    this._immuneUntil = Date.now() + ms;
  }

  /**
   * Advance the death timer and fire onRespawn when the delay elapses.
   *
   * Call at the top of realm.update() and check the return value:
   *   if (this.health.update()) return;
   *
   * @returns {boolean} true while the player is dying (realm should skip normal update)
   */
  update() {
    if (!this._dying) return false;
    if (Date.now() - this._dyingT >= this._respawnDelay) {
      this._dying       = false;
      this._immuneUntil = Date.now() + this._immunityAfterSpawn;
      this._onRespawn?.();
    }
    return true;  // still dying (or just transitioned out — caller already returned)
  }
}
