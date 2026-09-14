// ── FILE: worlds/sea/dialogue.js ─────────────────────────
// The Shipmaster, at sea. He honours the Letter; he does not read it.
//   • buildSeaMenuDialogue  — SPACE at sea: keep sailing / turn back
//   • buildArrivalDialogue  — entering Crete's bay

import { Dialogue } from '../../engine/dialogue.js';

export const SHIPMASTER = 'THE SHIPMASTER  ✦  NON-REFUNDABLE VOYAGES';

export function buildSeaMenuDialogue({ arrived, onTurnBack }) {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: arrived
        ? 'WE ARE ON THE BEACH AT CRETE.\nKNOSSOS IS UP THE HILL.\nTHE LABYRINTH IS BENEATH IT.\nTHE ISLAND WILL SEND FOR YOU.'
        : 'THE HEADING IS CRETE.\nTHE WIND AGREES.\nTHE WIND IS PAID TO AGREE.',
      choices: [
        { label: 'Keep sailing', next: null },
        { label: arrived ? 'Sail home — the Delta' : 'Turn back — the Delta', next: 'confirm' },
      ],
    },
    confirm: {
      speaker: SHIPMASTER,
      text: 'AS YOU WISH.\nYOUR LETTER REMAINS VALID.\nTHE SEA WILL BE HERE.\nTHE SEA IS ALWAYS HERE. THAT IS ITS WHOLE BUSINESS MODEL.',
      onComplete: onTurnBack,
      next: null,
    },
  });
}

export function buildArrivalDialogue() {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: 'CRETE.\nKING MINOS KEEPS A LABYRINTH HERE.\nSOMETHING IN IT KEEPS HIM.',
      next: 'anchor',
    },
    anchor: {
      speaker: SHIPMASTER,
      text: 'THE PALACE OF KNOSSOS WATCHES FROM THE HILL.\nBENEATH IT, THE LABYRINTH.\nAT ITS HEART, AN OPPORTUNITY\nTHAT HAS EATEN EVERY MAN WHO TOOK IT.\nWAIT BY THE SHIP. THE ISLAND WILL SEND FOR YOU.',
      next: null,
    },
  });
}
