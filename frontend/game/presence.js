// ── FILE: game/presence.js ────────────────────────────────
// PresenceStore — ephemeral registry of peers in the current channel.
//
// Each entry: { username, px, py, pZ, facing, frame, _spawnT, _leaveT }
// Hydrated from ws:peer_entered / ws:peer_pose. On ws:peer_left the entry is
// not deleted immediately — it's marked leaving (_leaveT) so the renderer can
// play a de-materialisation fade, then pruned once the fade completes.
// The render loop reads peers() to draw ghost pharaohs.

// Fade-out duration. The renderer (draw/pharaoh.js) imports this so the visual
// fade and the prune timing stay in lock-step.
export const PEER_FADE_MS = 520;

class _PresenceStore {
  constructor() {
    this._peers = {};   // username → pose dict
  }

  upsert(username, pose) {
    const ex = this._peers[username];
    // Re-materialise if this peer was mid-fade (left then came back); otherwise
    // preserve the original sighting time so a pose update doesn't re-trigger
    // the materialisation effect.
    const reentering = ex && ex._leaveT != null;
    this._peers[username] = {
      ...pose,
      username,
      _spawnT: (ex && !reentering) ? ex._spawnT : Date.now(),
      _leaveT: null,
      // isProjector arrives on peer_entered only; preserve it across pose updates.
      isProjector: pose.isProjector ?? ex?.isProjector ?? false,
    };
  }

  // Start the fade-out (idempotent — keeps the first leave time).
  remove(username) {
    const ex = this._peers[username];
    if (ex && ex._leaveT == null) ex._leaveT = Date.now();
  }

  peers() {
    const now = Date.now();
    // Lazy prune: drop peers whose fade-out has fully elapsed.
    for (const name of Object.keys(this._peers)) {
      const p = this._peers[name];
      if (p._leaveT != null && now - p._leaveT > PEER_FADE_MS + 60) delete this._peers[name];
    }
    return Object.values(this._peers);
  }

  clear() {
    this._peers = {};
  }

  get size() {
    return Object.keys(this._peers).length;
  }
}

export const PresenceStore = new _PresenceStore();
