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
        ? 'WE ARE ON THE BEACH AT CRETE.\nTHE ISLAND IS NOT TAKING VISITORS.\nTHE VIEW IS INCLUDED IN YOUR PASSAGE.'
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
      text: 'THE ISLAND IS NOT TAKING VISITORS.\nTHE SHIP IS ON THE SAND.\nYOU MAY STAND HERE AND ADMIRE IT.\nADMIRATION IS FREE.\nIT IS THE ONLY THING HERE THAT IS.',
      next: null,
    },
  });
}
