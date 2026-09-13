// ── FILE: worlds/sea/narration.js ────────────────────────
// Voyage events → log lines. Pure: returns lines; SeaRealm calls log().
// `once` entries speak a single time per voyage (per id/level); `cooldown`
// entries speak at most once every N seconds. Events with no entry are silent.

export const NARRATION = {
  departure: { once: true, lines: [
    'The Delta lets go of you. The sea does not ask your name. It asks for nothing. That is how you know it will take everything.',
  ]},
  first_swell: { once: true, lines: [
    'The first swell lifts the hull and sets it down again, gently, the way a creditor first says hello.',
    'Open water. The river had banks. The sea has terms and conditions.',
  ]},
  strayed: { cooldown: 45, lines: [
    'You leave the course. The wind notices. The wind files a report.',
    'Off the line. The sea does not forbid it. It simply charges more.',
    'Wander if you like. Every heading on this water was sold to someone before you.',
  ]},
  in_irons: { cooldown: 30, lines: [
    'The sail hangs slack, pointed straight at the wind. You have found the one direction nothing will pay for.',
    'In irons. The ship waits for you to stop arguing with the weather.',
  ]},
  storm_rising: { once: true, byLevel: {
    0.3: ['The clouds ahead thicken, like a ledger nobody wants to open.'],
    0.5: ['The swell climbs. Spray reaches the pharaoh at the prow. The pharaoh does not bow.'],
    0.7: ['The storm leans over the water. It has been expecting you for some time.'],
  }},
  landmark_near: { once: true, byId: {
    wreck:       ['A ship lies half-sunk, pots still bobbing around it. A previous voyage. Also paid in full.'],
    signal_rock: ['A fire gutters on a lone rock. Someone is still keeping it lit. No one has told them it is over.'],
  }},
  crete_clearer: { once: true, lines: [
    'The shape on the horizon sharpens into a mountain. An island. Something about it is waiting.',
  ]},
  lightning: { once: true, lines: [
    'Lightning walks across the water ahead. The thunder takes its time. It knows you are coming to it.',
  ]},
};

export function createNarrationMemory() {
  return { last: {}, done: {} };
}

function _key(evt) {
  return evt.type + (evt.id != null ? ':' + evt.id : '') + (evt.level != null ? ':' + evt.level : '');
}

export function narrate(events, now, memory, rng = Math.random) {
  const out = [];
  for (const evt of events) {
    const entry = NARRATION[evt.type];
    if (!entry) continue;
    const lines = entry.byId ? entry.byId[evt.id] : entry.byLevel ? entry.byLevel[evt.level] : entry.lines;
    if (!lines || lines.length === 0) continue;
    if (entry.once) {
      const key = _key(evt);
      if (memory.done[key]) continue;
      memory.done[key] = true;
    }
    if (entry.cooldown) {
      const last = memory.last[evt.type];
      if (last != null && now - last < entry.cooldown) continue;
      memory.last[evt.type] = now;
    }
    out.push('✦ ' + lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))]);
  }
  return out;
}
