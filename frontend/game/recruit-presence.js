// frontend/game/recruit-presence.js
// Single source of truth for direct-recruit online state and its card dot.
//
// Data-source-agnostic: seed() and set() are the only inputs. Swapping the
// backend presence layer (in-memory → Redis pub/sub) never touches this module
// — the `recruit_presence` WS event and the seed shape stay the same.
//
// DOM writes are guarded (`typeof document`) so the store logic imports and
// tests cleanly under node.

const _online = new Map();   // Number(userId) → bool

function _dotEl(userId) {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`.fe[data-uid="${userId}"] .fo`);
}

function _render(userId) {
  const el = _dotEl(userId);
  if (el) el.classList.toggle('on', _online.get(Number(userId)) === true);
}

export const RecruitPresence = {
  /** Seed from GET /api/astral/downline: [{user_id, online}]. */
  seed(list) {
    for (const r of list || []) {
      if (r.user_id == null) continue;
      _online.set(Number(r.user_id), !!r.online);
      _render(r.user_id);
    }
  },

  /** Live update from the ws:recruit_presence event. */
  set(userId, online) {
    if (userId == null) return;
    _online.set(Number(userId), !!online);
    _render(userId);
  },

  isOnline(userId) {
    return _online.get(Number(userId)) === true;
  },

  clear() { _online.clear(); },
};
