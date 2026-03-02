// ── FILE: game/ws.js ─────────────────────────────────────
// WebSocket client that bridges the backend event stream to the
// frontend Events bus.
//
// Usage (called once after auth in main.js):
//   import { gameSocket } from './game/ws.js';
//   gameSocket.connect(jwtToken);
//
// Events emitted on the global Events bus:
//   ws:recruit_joined   { name, depth, payout, db_recruit_id, parent_name }
//   ws:state_update     { bought?, invites_left?, earned?, balance? }
//   ws:invite_accepted  { email, recruit_username }
//   ws:connected        {}
//   ws:disconnected     {}

import { Events } from '../engine/events.js';

// Resolve the WS base URL from the same logic api.js uses for HTTP.
function _wsBase() {
  const apiBase = (typeof window !== 'undefined' && window.API_BASE) || '';
  if (apiBase) {
    // e.g. http://localhost:8000 → ws://localhost:8000
    return apiBase.replace(/^https/, 'wss').replace(/^http/, 'ws');
  }
  // Same-origin (Docker nginx proxies /ws)
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

class GameSocket {
  constructor() {
    this._token         = null;
    this._ws            = null;
    this._dead          = false;
    this._reconnectMs   = 1000;
    this._pingInterval  = null;
  }

  connect(token) {
    this._token = token;
    this._dead  = false;
    this._tryConnect();
  }

  _tryConnect() {
    if (this._dead || !this._token) return;

    const url = `${_wsBase()}/ws?token=${this._token}`;
    this._ws = new WebSocket(url);

    this._ws.onopen = () => {
      this._reconnectMs = 1000;
      Events.emit('ws:connected', {});

      // Keep-alive ping every 25 s (server drops silent connections after 30 s
      // in most default configs).
      clearInterval(this._pingInterval);
      this._pingInterval = setInterval(() => {
        if (this._ws?.readyState === WebSocket.OPEN) {
          this._ws.send('ping');
        }
      }, 25_000);
    };

    this._ws.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data.type) Events.emit(`ws:${data.type}`, data);
    };

    this._ws.onclose = () => {
      clearInterval(this._pingInterval);
      Events.emit('ws:disconnected', {});
      if (!this._dead) {
        setTimeout(() => this._tryConnect(), this._reconnectMs);
        this._reconnectMs = Math.min(this._reconnectMs * 2, 30_000);
      }
    };

    this._ws.onerror = () => {
      // onclose fires after onerror — let it handle the reconnect.
    };
  }

  close() {
    this._dead = true;
    clearInterval(this._pingInterval);
    this._ws?.close();
  }

  get isOpen() {
    return this._ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton — import this everywhere you need WS access.
export const gameSocket = new GameSocket();
