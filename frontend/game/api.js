// ── FILE: game/api.js ────────────────────────────────────
// Thin HTTP client. All server calls go through here so the
// base URL and auth token are managed in one place.
//
// BASE URL resolution:
//   - Docker (nginx proxy):  BASE = ''  (same origin, nginx routes /api/*)
//   - Local dev w/ Vite:     set VITE_API_URL=http://localhost:8000
//   - Local dev w/o Vite:    window.API_BASE = 'http://localhost:8000'

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
      method: 'POST', headers: _headers(), body: JSON.stringify(body),
    });
    return _parse(res);
  },

  async put(path, body = {}) {
    const res = await fetch(BASE + path, {
      method: 'PUT', headers: _headers(), body: JSON.stringify(body),
    });
    return _parse(res);
  },

  async patch(path, body = {}) {
    const res = await fetch(BASE + path, {
      method: 'PATCH', headers: _headers(), body: JSON.stringify(body),
    });
    return _parse(res);
  },

  // ── Game-specific helpers ────────────────────────────

  /** Fetch the current user's saved state. */
  loadMe() { return Api.get('/api/me'); },

  /** Persist a full state snapshot. */
  syncState(snapshot) { return Api.put('/api/state', snapshot); },

  /**
   * Fire-and-forget event log — milestones, flag changes, realm transitions.
   */
  logEvent(type, payload = {}) {
    return Api.post('/api/event', { type, payload });
  },

  /** Trigger the buy-in flow. */
  buyIn(fee) { return Api.post('/api/buy-in', { fee }); },

  /** Fetch the full recruit history for the current user. */
  loadRecruits() { return Api.get('/api/recruits'); },

  /**
   * Update the visual layout (wx, pid, zLayer) of a server-side Recruit row
   * after the frontend assigns a slot.  Called for real recruits that arrived
   * via WebSocket (which have a db_recruit_id).
   */
  patchRecruitMeta(dbId, { pid, rootPid, zLayer, wx }) {
    return Api.patch(`/api/recruits/${dbId}/meta`, {
      pid, root_pid: rootPid, z_layer: zLayer, wx,
    });
  },

  // ── Invite helpers ────────────────────────────────────

  /** Send an invite scroll to an email address. */
  sendInvite(email) { return Api.post('/api/invites', { email }); },

  /** Fetch the list of invites the current user has sent. */
  getInvites() { return Api.get('/api/invites'); },
};
