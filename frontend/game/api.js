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

const TOKEN_KEY = 'ps_auth_token';

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
  setToken(t)  {
    _token = t;
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private browsing */ }
  },
  clearToken() {
    _token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  },
  hasToken()   { return !!_token; },

  /**
   * Attempt to restore a session from localStorage.
   * Validates the stored token against the server before trusting it.
   * Returns the token string if valid, null otherwise.
   */
  async restoreToken() {
    let stored = null;
    try { stored = localStorage.getItem(TOKEN_KEY); } catch {}
    if (!stored) return null;

    // Temporarily set the token so _headers() includes it for the /me call.
    _token = stored;
    try {
      const me = await Api.get('/api/me');
      if (me && !me.error && !me.detail) {
        // Token is good — keep it set and return it.
        return stored;
      }
    } catch { /* network error — fall through */ }

    // Token is invalid / expired — clear it.
    _token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    return null;
  },

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

  async del(path) {
    const res = await fetch(BASE + path, {
      method: 'DELETE', headers: _headers(),
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

  // ── Profile helpers ───────────────────────────────────

  /** Fetch the current user's profile (includes monetary summary). */
  getProfile() { return Api.get('/api/profile'); },

  /** Change password. Requires current + new password. */
  changePassword(currentPassword, newPassword) {
    return Api.patch('/api/profile/password', {
      current_password: currentPassword,
      new_password:     newPassword,
    });
  },

  /** Change username. Returns { ok, new_token, username } on success. */
  changeUsername(newUsername) {
    return Api.patch('/api/profile/username', { new_username: newUsername });
  },

  /** Change email. Pass null to clear email. */
  changeEmail(newEmail) {
    return Api.patch('/api/profile/email', { new_email: newEmail });
  },
};
