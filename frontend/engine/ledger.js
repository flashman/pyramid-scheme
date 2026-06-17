// ── FILE: engine/ledger.js ───────────────────────────────
// The Ledger — the maze's memory of every fork the player has taken.
//
// It is an ACCUMULATOR, not a moral scale. It does not reward or punish; it
// records and compounds. Each fork in the game writes one immutable mark here
// (take vs. drown, pay vs. refuse, …), and later layers — the next chapter,
// and ultimately the apex that authored the maze — read the accumulation to
// decide what the player meets next. Omniscience without conscience: the
// framework values every choice "at face amount" and folds it into itself.
//
// Backed by Flags so it lives in the same shared game state every realm reads.
//   Ledger.record(fork, choice, meta?)  — decide a fork (one decision per id)
//   Ledger.choice(fork)                 — what was chosen, or null
//   Ledger.decided(fork)                — has this fork been resolved?
//   Ledger.all()                        — every mark, in order taken
//   Ledger.count(predicate)             — tally for the endgame reckoning

import { Flags }  from './flags.js';
import { Events } from './events.js';

const KEY = 'ledger';

export const Ledger = {
  record(fork, choice, meta = {}) {
    // A fork is decided once; re-recording replaces the prior mark.
    const next = this.all().filter(e => e.fork !== fork);
    next.push({ fork, choice, ...meta, at: Date.now() });
    Flags.set(KEY, next);
    Events.emit('ledger:record', { fork, choice });
  },

  choice(fork) {
    const e = this.all().find(e => e.fork === fork);
    return e ? e.choice : null;
  },

  decided(fork) { return this.all().some(e => e.fork === fork); },

  all() { return Flags.get(KEY, []); },

  count(predicate) { return this.all().filter(predicate).length; },
};
