// ── FILE: game/api.js ────────────────────────────────────
// Thin API client. All server calls go through here so the
// base URL and auth token are managed in one place.
//
// Usage:
//   import { Api } from './api.js';
//   const data = await Api.post('/buy-in', { fee: 10 });

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:8000';

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
};
