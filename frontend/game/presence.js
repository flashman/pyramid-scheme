// ── FILE: game/presence.js ────────────────────────────────
// PresenceStore — ephemeral registry of peers in the current channel.
//
// Each entry: { username, px, py, pZ, facing, frame }
// Hydrated from ws:peer_entered / ws:peer_pose; cleared on ws:peer_left.
// The render loop reads peers() to draw ghost pharaohs.

class _PresenceStore {
  constructor() {
    this._peers = {};   // username → pose dict
  }

  upsert(username, pose) {
    this._peers[username] = { ...pose, username };
  }

  remove(username) {
    delete this._peers[username];
  }

  peers() {
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
