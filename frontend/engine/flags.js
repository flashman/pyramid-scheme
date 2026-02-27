// ── FILE: engine/flags.js ────────────────────────────────
// Named boolean/value flags — game state without polluting G.
// QuestManager watches flags and fires quest completions.

import { Events } from './events.js';

export const Flags = {
  _store: {},

  set(key, val) {
    const prev = this._store[key];
    this._store[key] = val;
    if (prev !== val) Events.emit('flag:change', { key, val, prev });
  },

  get(key, def = false) {
    return key in this._store ? this._store[key] : def;
  },

  /** Increment a numeric flag (defaults to 0). */
  inc(key, by = 1) {
    this.set(key, this.get(key, 0) + by);
  },

  has(key) { return key in this._store; },

  /** Toggle a boolean flag. */
  toggle(key) { this.set(key, !this.get(key, false)); },
};

// ── Quest system ─────────────────────────────────────────
// Quests are registered once and automatically complete
// when all their steps become true.
export const QuestManager = {
  _quests: [],

  register(quest) {
    this._quests.push({ ...quest, _done: false });
    Events.once('game:started', () => this._checkAll());
    return this;
  },

  /** Call after any state change that might advance quests. */
  check() { this._checkAll(); },

  _checkAll() {
    for (const q of this._quests) {
      if (q._done) continue;
      if (q.condition && !q.condition()) continue;
      const allDone = q.steps.every(s => s.done());
      if (allDone) {
        q._done = true;
        q.onComplete?.();
        Events.emit('quest:complete', { id: q.id, title: q.title });
        // Use the event bus so engine never imports UI layer
        Events.emit('game:log', { msg: `★ QUEST: ${q.title}`, cls: 'hi' });
      }
    }
  },

  /** Returns { done, step, total } for a quest by id. */
  progress(questId) {
    const q = this._quests.find(q => q.id === questId);
    if (!q) return null;
    return {
      done:  q._done,
      step:  q.steps.filter(s => s.done()).length,
      total: q.steps.length,
      title: q.title,
    };
  },

  all() { return this._quests; },
};
