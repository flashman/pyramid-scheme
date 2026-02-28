// ── FILE: game/api.js ────────────────────────────────────
// Thin API client. All server calls go through here so the
// base URL and auth token are managed in one place.
//
// BASE URL resolution:
//   - Docker (nginx proxy):  BASE = ''  (same origin, nginx routes /api/* to backend)
//   - Local dev w/ Vite:     set VITE_API_URL=http://localhost:8000
//   - Local dev w/o Vite:    set window.API_BASE = 'http://localhost:8000' in index.html
//                            or edit the fallback below directly

const BASE = (typeof window !== 'undefined' && window.API_BASE)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || '';

let _token = null;

function _headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    ...extra,
  };
}

async function _parse(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

export const Api = {
  // ── Token management ─────────────────────────────────
  setToken(t)  { _token = t; },
  clearToken() { _token = null; },
  hasToken()   { return !!_token; },

  // ── HTTP verbs ───────────────────────────────────────
  async get(path) {
    const res = await fetch(BASE + path, { headers: _headers() });
    return _parse(res);
  },

  async post(path, body = {}) {
    const res = await fetch(BASE + path, {
      method:  'POST',
      headers: _headers(),
      body:    JSON.stringify(body),
    });
    return _parse(res);
  },

  async put(path, body = {}) {
    const res = await fetch(BASE + path, {
      method:  'PUT',
      headers: _headers(),
      body:    JSON.stringify(body),
    });
    return _parse(res);
  },

  // ── Game-specific helpers ────────────────────────────

  /** Fetch the current user's saved state. */
  loadMe() { return Api.get('/api/me'); },

  /** Persist a snapshot of the relevant parts of G. */
  saveState(snapshot) { return Api.put('/api/state', snapshot); },

  /**
   * Fire-and-forget event log — recruits, milestones, flag changes.
   * The backend records these for the leaderboard / audit trail.
   */
  logEvent(type, payload = {}) {
    return Api.post('/api/event', { type, payload });
  },

  /** Trigger the buy-in flow (Stripe stubbed server-side for now). */
  buyIn(fee) { return Api.post('/api/buy-in', { fee }); },

  /** Fetch the full recruit history for the current user. */
  loadRecruits() { return Api.get('/api/recruits'); },

  /**
   * Persist a single recruit record immediately after it joins.
   * Includes the visual layout data (pid, rootPid, zLayer, wx) so the
   * scene can be reconstructed exactly on next login.
   */
  saveRecruit(rec) {
    return Api.post('/api/recruits', {
      name:        rec.name,
      depth:       rec.depth,
      payout:      rec.payoutToPlayer,
      parent_name: rec.parentName || null,
      meta: {
        pid:     rec.pid,
        rootPid: rec.rootPid,
        zLayer:  rec.zLayer,
        wx:      rec.wx,          // stored so restore skips slot-counter replay
      },
    });
  },

  /**
   * Sync the full Flags store and key economic fields to the server.
   * Called debounced from main.js on flag:change and other state mutations.
   */
  syncState(snapshot) { return Api.put('/api/state', snapshot); },
};
