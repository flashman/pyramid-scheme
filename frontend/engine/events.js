// ── FILE: engine/events.js ───────────────────────────────
// Lightweight pub/sub event bus.
export const Events = {
  _listeners: {},

  /** Subscribe to an event. Returns unsubscribe fn. */
  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  },

  /** Unsubscribe a specific handler. */
  off(event, fn) {
    this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn);
  },

  /** Subscribe for exactly one firing, then auto-remove. */
  once(event, fn) {
    const wrapper = data => { fn(data); this.off(event, wrapper); };
    this.on(event, wrapper);
  },

  /** Fire an event, passing data to all listeners. */
  emit(event, data) {
    (this._listeners[event] || []).slice().forEach(fn => fn(data));
  },
};
