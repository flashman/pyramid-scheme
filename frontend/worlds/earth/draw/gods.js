// ── FILE: worlds/earth/draw/gods.js ─────────────────────
// Sky gods as SkyGodEntity instances (extends NPC).

import { G }                    from '../../../game/state.js';
import { X, CW, CH }            from '../../../engine/canvas.js';
import { GND }                  from '../constants.js';
import { COL }                  from '../../../engine/colors.js';
import { Events }               from '../../../engine/events.js';
import { Flags, QuestManager }  from '../../../engine/flags.js';
import { Dialogue, DialogueManager } from '../../../engine/dialogue.js';
import { NPC }                  from '../../../engine/entity.js';
import { spawnParts }           from '../../../draw/utils.js';
import { unlockCrypt }          from '../../../game/recruits.js';

// ── Raw data (position, visual, personality) ────────────
export const SKY_GOD_DATA = [
  { name:'SHU',   title:'GOD OF AIR & WIND',    worldY:-4,    baseX:2600, drift:120, phase:0.0,
    wanderPeriod:7200,  wanderAmp:90,  glowCol:'#a0c8f0' },
  { name:'THOTH', title:'GOD OF WISDOM',         worldY:-334,  baseX:2600, drift:130, phase:1.1,
    wanderPeriod:13500, wanderAmp:55,  glowCol:'#c0c8ff' },
  { name:'HORUS', title:'SKY GOD',               worldY:-774,  baseX:2600, drift:140, phase:2.3,
    wanderPeriod:5500,  wanderAmp:110, glowCol:'#4060d0' },
  { name:'ANUBIS',title:'GOD OF DEATH',          worldY:-1214, baseX:2600, drift:150, phase:0.7,
    wanderPeriod:18000, wanderAmp:45,  glowCol:'#301808' },
  { name:'RA',    title:'GOD OF THE SUN',        worldY:-1654, baseX:2600, drift:150, phase:1.8,
    wanderPeriod:9200,  wanderAmp:80,  glowCol:'#ff8800' },
  { name:'NUT',   title:'GODDESS OF THE SKY',    worldY:-2094, baseX:2600, drift:150, phase:3.1,
    wanderPeriod:11000, wanderAmp:125, glowCol:'#0818a0' },
  { name:'AMUN',  title:'KING OF THE GODS',      worldY:-2534, baseX:2600, drift:150, phase:0.4,
    wanderPeriod:22000, wanderAmp:35,  glowCol:'#8820f0' },
];


function _buildDialogue_Shu() {
  return new Dialogue({
    start: {
      speaker: 'SHU — GOD OF AIR',
      text: 'THE WIND CARRIES YOUR\nSCROLLS ACROSS THE LAND.\nEVEN I AM IMPRESSED BY\nYOUR AMBITION, MORTAL.',
      choices: [
        { label: 'What does the wind see?',   next: 'vision' },
        { label: 'Blow me some luck.',        next: 'luck'   },
        { label: 'I should keep climbing.',   next: null     },
      ],
    },
    vision: {
      speaker: 'SHU — GOD OF AIR',
      text: () => `FROM HERE I SEE\nEVERY PYRAMID BELOW.\nYOURS HAS ${G.pyramids.find(p=>p.isPlayer)?.layers||0} LAYERS NOW.\nIT CASTS A LONG SHADOW.`,
      next: 'start',
    },
    luck: {
      speaker: 'SHU — GOD OF AIR',
      condition: () => G.recruits.length > 0,
      text: 'THE WIND ALREADY CARRIES\nYOUR NAME TO NEW EARS.\nI CANNOT DO MORE THAN\nWHAT I ALREADY DO.',
      conditionFail: 'luck_none',
      onComplete: () => Flags.set('shu_spoken', true),
      next: 'start',
    },
    luck_none: {
      speaker: 'SHU — GOD OF AIR',
      text: 'LUCK REQUIRES SOMEONE\nTO BE LUCKY AT.\nSEND YOUR SCROLLS FIRST.\nTHEN ASK AGAIN.',
      next: 'start',
    },
  });
}

function _buildDialogue_Thoth() {
  return new Dialogue({
    start: {
      speaker: 'THOTH — GOD OF WISDOM',
      text: 'I HAVE MODELED YOUR\nSCHEME ACROSS 12 PAPYRI.\nTHE PROJECTIONS ARE...\nILLUMINATING.',
      choices: [
        { label: 'Is the math sustainable?', next: 'math'     },
        { label: 'How much will I earn?',    next: 'earnings' },
        { label: 'I trust the numbers.',     next: null       },
      ],
    },
    math: {
      speaker: 'THOTH — GOD OF WISDOM',
      text: 'TO PAY EVERYONE: 4^n\nRECRUITS PER LAYER.\nAFTER 10 LAYERS:\n1,048,576 SOULS. SIMPLE.',
      next: 'math2',
    },
    math2: {
      speaker: 'THOTH — GOD OF WISDOM',
      text: () => `EARTH HAS 8 BILLION.\nYOU HAVE ${G.recruits.length} RECRUIT${G.recruits.length!==1?'S':''}.\nROOM FOR MILLIONS MORE.\nTHE MATH IS FINE. PROBABLY.`,
      onComplete: () => Flags.set('thoth_spoken', true),
      next: 'start',
    },
    earnings: {
      speaker: 'THOTH — GOD OF WISDOM',
      text: () => {
        const net = G.earned - G.invested;
        if (net >= 0) return `YOU INVESTED $${G.invested}.\nYOU EARNED $${G.earned.toFixed(2)}.\nNET: +$${net.toFixed(2)}.\nTHE MATH IS FAVORABLE.`;
        return `YOU INVESTED $${G.invested}.\nYOU EARNED $${G.earned.toFixed(2)}.\nNET: -$${Math.abs(net).toFixed(2)}.\nPERHAPS MORE SCROLLS?`;
      },
      next: 'start',
    },
  });
}

function _buildDialogue_Horus() {
  return new Dialogue({
    start: {
      speaker: 'HORUS — SKY GOD',
      text: 'MY EYE SEES ALL\nTRANSACTIONS BELOW.\nEVEN THE ONES YOU\nHAVE NOT NOTICED YET.',
      choices: [
        { label: 'What have you seen?',  next: 'seen'  },
        { label: 'Watch my pyramid.',    next: 'watch' },
        { label: 'Farewell, watcher.',   next: null    },
      ],
    },
    seen: {
      speaker: 'HORUS — SKY GOD',
      text: () => {
        const d1     = G.recruits.filter(r => r.depth === 1).length;
        const deeper = G.recruits.filter(r => r.depth > 1).length;
        return `I SEE ${d1} DIRECT RECRUIT${d1!==1?'S':''}.\nBELOW THEM: ${deeper} MORE.\nAND BELOW THOSE...\nI AM STILL COUNTING.`;
      },
      next: 'start',
    },
    watch: {
      speaker: 'HORUS — SKY GOD',
      text: 'I HAVE ALWAYS BEEN\nWATCHING YOUR PYRAMID.\nI WATCH ALL OF THEM.\nTHAT IS MY BURDEN.',
      onComplete: () => Flags.set('horus_spoken', true),
      next: 'start',
    },
  });
}

function _buildDialogue_Anubis() {
  return new Dialogue({
    start: {
      speaker: 'ANUBIS — GOD OF DEATH',
      text: 'YOU HAVE CLIMBED INTO\nMY DOMAIN, MORTAL.\nFEW DO THIS WITHOUT\nA DEBT TO REPAY.',
      choices: [
        { label: 'Am I going to be okay?',  next: 'doom'   },
        { label: 'Tell me of the fallen.',  next: 'fallen' },
        { label: 'Death will wait.',        next: null     },
      ],
    },
    doom: {
      speaker: 'ANUBIS — GOD OF DEATH',
      condition: () => (G.earned - G.invested) < -5,
      text: () => `YOUR NET IS -$${Math.abs(G.earned-G.invested).toFixed(2)}.\nYOU ARE IN FINANCIAL\nPURGATORY. I HAVE THE\nPAPERWORK READY.`,
      conditionFail: 'doom_ok',
      next: 'start',
    },
    doom_ok: {
      speaker: 'ANUBIS — GOD OF DEATH',
      text: () => `YOUR NET IS +$${(G.earned-G.invested).toFixed(2)}.\nYOU ARE NOT YET\nIN MY LEDGERS.\nCheck back later.`,
      next: 'start',
    },
    fallen: {
      speaker: 'ANUBIS — GOD OF DEATH',
      text: 'MANY PHARAOHS CLIMBED\nTHIS HIGH WITH GREAT PLANS.\nMOST ARE MY CLIENTS NOW.\nYOU SMELL DIFFERENT. MAYBE.',
      onComplete: () => Flags.set('anubis_spoken', true),
      next: 'start',
    },
  });
}

function _buildDialogue_Ra() {
  return new Dialogue({
    start: {
      speaker: 'RA — GOD OF THE SUN',
      text: 'I AM THE ORIGINAL\nPYRAMID SCHEME. EVERY\nMORNING I RISE AND\nCHARGE THE EARTH A FEE.',
      choices: [
        { label: 'What is the fee?',        next: 'fee'       },
        { label: 'Who is above you?',       next: 'hierarchy' },
        { label: 'The sun waits for none.', next: null        },
      ],
    },
    fee: {
      speaker: 'RA — GOD OF THE SUN',
      text: 'PHOTONS. WARMTH. LIFE.\nALL SENT FROM ME TO YOU.\nYET NO ONE ASKS\nHOW TO OPT OUT. CLEVER.',
      next: 'start',
    },
    hierarchy: {
      speaker: 'RA — GOD OF THE SUN',
      text: 'THE CHIEF WORKS FOR US.\nWE WORK FOR THE COUNCIL.\nTHE COUNCIL ANSWERS\nTO SOMETHING OLDER.',
      onComplete: () => Flags.set('ra_hierarchy_heard', true),
      next: 'hierarchy2',
    },
    hierarchy2: {
      speaker: 'RA — GOD OF THE SUN',
      text: 'WE DO NOT SPEAK OF\nWHAT IS ABOVE THE COUNCIL.\nSOME THINGS REMAIN HIDDEN.\nASK AMUN. IF YOU DARE.',
      next: 'start',
    },
  });
}

function _buildDialogue_Nut() {
  return new Dialogue({
    start: {
      speaker: 'NUT — GODDESS OF THE SKY',
      text: 'YOU SWIM INSIDE MY BODY —\nTHE SKY ITSELF.\nFEW MORTALS CLIMB HERE.\nYOU ARE PERSISTENT.',
      choices: [
        { label: 'What lies beyond you?',    next: 'beyond' },
        { label: 'Can you expand my world?', next: 'expand' },
        { label: 'The stars call further.',  next: null     },
      ],
    },
    beyond: {
      speaker: 'NUT — GODDESS OF THE SKY',
      condition: () => Flags.get('ra_hierarchy_heard'),
      text: 'BEYOND ME: THE COUNCIL\nRA WHISPERED OF. BEYOND\nTHEM: THE ARCHITECTS.\nBEYOND THOSE: THE SCHEME.',
      conditionFail: 'beyond_locked',
      onComplete: () => Flags.set('nut_beyond_heard', true),
      next: 'start',
    },
    beyond_locked: {
      speaker: 'NUT — GODDESS OF THE SKY',
      text: 'THERE IS ALWAYS MORE\nABOVE. ASK RA ABOUT\nWHAT HE HAS SEEN.\nTHEN ASK ME AGAIN.',
      next: 'start',
    },
    expand: {
      speaker: 'NUT — GODDESS OF THE SKY',
      text: 'YOUR WORLD EXPANDS\nEVERY TIME A RECRUIT\nJOINS. THEIR WORLD\nSHRINKS. THE MATH HOLDS.',
      next: 'start',
    },
  });
}

function _buildDialogue_Amun() {
  return new Dialogue({
    start: {
      speaker: 'AMUN — KING OF THE GODS',
      text: 'THE HIDDEN ONE REVEALS\nHIMSELF TO YOU ALONE.\nYOU HAVE CLIMBED FAR,\nFURTHER THAN MOST.',
      choices: [
        { label: 'What are you hiding?',
          next: 'reveal' },
        { label: 'Grant me passage.',
          next: 'power',
          condition: () => getTier().name === 'PHARAOH' },
        { label: 'Grant me passage.',
          next: 'power_locked',
          condition: () => getTier().name !== 'PHARAOH' },
        { label: 'I seek the truth.',
          next: 'truth' },
      ],
    },
    reveal: {
      speaker: 'AMUN — KING OF THE GODS',
      text: 'BENEATH YOUR PYRAMID:\nA DOOR. BENEATH THAT:\nTHE ONES WHO BUILT\nEVERY PYRAMID. EVER.',
      onComplete: () => { if (!Flags.get('crypt_open')) unlockCrypt(); },
      next: null,
    },
    power: {
      speaker: 'AMUN — KING OF THE GODS',
      text: 'PHARAOH. THE WORD FITS.\nDESCEND INTO YOUR PYRAMID.\nA DOOR WAITS AT THE BASE.\nTHEY ARE EXPECTING YOU.',
      onComplete: () => { if (!Flags.get('crypt_open')) unlockCrypt(); },
      next: null,
    },
    power_locked: {
      speaker: 'AMUN — KING OF THE GODS',
      text: 'FIRST: BECOME PHARAOH.\nRECRUIT YOUR ARMIES.\nBUILD YOUR LAYERS.\nTHEN THE DOOR FINDS YOU.',
      next: 'start',
    },
    truth: {
      speaker: 'AMUN — KING OF THE GODS',
      text: 'THE TRUTH IS:\nTHIS HAS HAPPENED BEFORE.\nWILL HAPPEN AGAIN.\nTHE SCHEME IS ETERNAL.',
      onComplete: () => Flags.set('amun_truth_heard', true),
      next: 'reveal',
    },
  });
}

// getTier is needed for Amun dialogue condition
import { getTier } from '../../../game/tiers.js';

const _godDialogueBuilders = [
  _buildDialogue_Shu, _buildDialogue_Thoth, _buildDialogue_Horus,
  _buildDialogue_Anubis, _buildDialogue_Ra, _buildDialogue_Nut,
  _buildDialogue_Amun,
];

export class SkyGodEntity extends NPC {
  constructor(data, idx) {
    super(`god_${idx}`, data.baseX, data.worldY, data.name,
          _godDialogueBuilders[idx]());
    this.data = data;
    this.idx  = idx;
  }

  checkProximity(px, py) {
    return Math.abs(px - this.worldX) < 800 &&
           Math.abs((py - 24) - (this.worldY + 26)) < 80;
  }

  update() {
    const t  = Date.now();
    const sg = this.data;
    const homeWx = sg.baseX + Math.sin(t / 9000 + sg.phase) * sg.drift;
    const wy     = sg.worldY + Math.sin(t / 6000 + sg.phase * 1.7) * 18;
    let wx = homeWx;
    if (G.bought) {
      const altDist = Math.abs((G.py - 24) - (wy + 26));
      const pull    = Math.max(0, 1 - altDist / 600);
      const wander  = Math.sin(t / sg.wanderPeriod + sg.phase * 2.3) * sg.wanderAmp * pull;
      wx = homeWx + (G.px - homeWx) * pull * 0.9 + wander;
    }
    this.worldX = wx;
    this.worldY = wy;
  }

  onNear() {
    const key = `god_${this.idx}_met`;
    if (!Flags.get(key)) {
      Flags.set(key, true);
      Flags.inc('gods_met');
      Events.emit('god:first_meet', { idx: this.idx, name: this.data.name });
      spawnParts(this.worldX, this.worldY + 22, this.data.glowCol, 40);
      G.shake = 6;
      QuestManager.check();
      DialogueManager.start(this.dialogue);
    }
  }

  onInteract() {
    spawnParts(this.worldX, this.worldY + 22, this.data.glowCol, 20);
    G.shake = 4;
    DialogueManager.start(this.dialogue);
  }

  draw(screenX, screenY) {
    _drawGodSprite(screenX, screenY, this.idx, Date.now(), this.active);
  }
}

export function buildGodEntities() {
  return SKY_GOD_DATA.map((data, i) => new SkyGodEntity(data, i));
}

export function drawGodsLayer(godEntities, registry) {
  if (G.py >= GND) return;
  const t = Date.now();
  for (const god of godEntities) {
    const sx = god.worldX - G.camX;
    const sy = god.worldY - Math.round(G.camY);
    if (sx < -80 || sx > CW+80 || sy < -80 || sy > CH+80) continue;
    _drawGodSprite(sx, sy, god.idx, t, registry && registry.nearest === god);
  }
}

function _drawGodSprite(screenX, screenY, gIdx, t, isNearest) {
  const sg  = SKY_GOD_DATA[gIdx];
  const bob = Math.sin(t / 900 + gIdx * 1.4) * 5;
  const bx  = Math.round(screenX - 16);
  const by  = Math.round(screenY + bob);

  X.save();
  X.globalAlpha = 0.22 + 0.1 * Math.sin(t / 700 + gIdx);
  const grd = X.createRadialGradient(bx+16, by+26, 0, bx+16, by+26, 38);
  grd.addColorStop(0, sg.glowCol); grd.addColorStop(1, 'transparent');
  X.fillStyle = grd; X.fillRect(bx-18, by-12, 68, 72);
  X.globalAlpha = 1;

  if      (gIdx===0) drawGodShu(bx,by);
  else if (gIdx===1) drawGodThoth(bx,by);
  else if (gIdx===2) drawGodHorus(bx,by);
  else if (gIdx===3) drawGodAnubis(bx,by);
  else if (gIdx===4) drawGodRa(bx,by);
  else if (gIdx===5) drawGodNut(bx,by);
  else               drawGodAmun(bx,by);

  const nameY = by + 50;
  X.font = '5px monospace';
  const lw = X.measureText(sg.name).width;
  X.fillStyle='#00000099'; X.fillRect(bx+16-lw/2-3, nameY, lw+6, 10);
  X.fillStyle=COL.GOLD_BRIGHT; X.fillText(sg.name, bx+16-lw/2, nameY+8);

  if (isNearest && !DialogueManager.isActive()) {
    const hint = '[SPACE] SPEAK';
    const hw   = X.measureText(hint).width;
    X.globalAlpha = 0.5 + 0.5*Math.sin(t/400);
    X.fillStyle = COL.GOLD; X.fillText(hint, bx+16-hw/2, nameY+20);
    X.globalAlpha = 1;
  }
  X.restore();
}

function drawGodShu(bx,by) {
  X.fillStyle='#a0c0e0'; X.fillRect(bx+9,by,5,16); X.fillRect(bx+17,by,5,16);
  X.fillStyle='#c8e0f8'; X.fillRect(bx+10,by+1,3,12); X.fillRect(bx+18,by+1,3,12);
  X.fillStyle='#d4b880'; X.fillRect(bx+8,by+12,16,10);
  X.fillStyle='#c8a060'; X.fillRect(bx+8,by+12,16,3);
  X.fillStyle=COL.BLACK; X.fillRect(bx+10,by+15,2,2); X.fillRect(bx+18,by+15,2,2);
  X.fillStyle=COL.BLACK; X.fillRect(bx+9,by+17,1,3); X.fillRect(bx+20,by+17,1,3);
  X.fillStyle='#b0d0f0'; X.fillRect(bx+8,by+22,16,16);
  X.fillStyle='#80b8e0'; X.fillRect(bx+7,by+22,18,3);
  X.fillStyle='#d4b880'; X.fillRect(bx+2,by+24,6,3); X.fillRect(bx+24,by+24,6,3);
  X.fillRect(bx+1,by+20,4,6); X.fillRect(bx+27,by+20,4,6);
  X.fillStyle='#c0e0ff'; X.fillRect(bx-4,by+10,3,2); X.fillRect(bx+33,by+14,3,2);
  X.fillRect(bx-2,by+28,2,2); X.fillRect(bx+32,by+30,2,2);
  X.fillStyle='#d0e8f8'; X.fillRect(bx+8,by+38,16,6);
  X.fillStyle='#d4b880'; X.fillRect(bx+9,by+44,5,4); X.fillRect(bx+18,by+44,5,4);
}

function drawGodThoth(bx,by) {
  X.fillStyle='#d0d8e0'; X.fillRect(bx+7,by+4,12,12);
  X.fillStyle='#602000';
  X.fillRect(bx+5,by+8,8,3); X.fillRect(bx+3,by+11,6,2); X.fillRect(bx+3,by+13,4,2);
  X.fillStyle='#f04000'; X.fillRect(bx+14,by+7,3,3);
  X.fillStyle=COL.BLACK;    X.fillRect(bx+15,by+8,1,1);
  X.fillStyle='#d0d8e0'; X.beginPath(); X.arc(bx+15,by+2,5,0,Math.PI*2); X.fill();
  X.fillStyle='#4040c0'; X.beginPath(); X.arc(bx+15,by+1,4,Math.PI,Math.PI*2); X.fill();
  X.fillStyle='#f0f0f0'; X.fillRect(bx+7,by+16,12,18);
  X.fillStyle='#c0c0c0';
  for (let i=0; i<4; i++) X.fillRect(bx+8,by+18+i*4,10,1);
  X.fillStyle='#2040c0'; X.fillRect(bx+11,by+16,4,18);
  X.fillStyle='#f0f0f0'; X.fillRect(bx+8,by+34,4,10); X.fillRect(bx+14,by+34,4,10);
  X.fillStyle='#d4b870'; X.fillRect(bx+20,by+18,3,14);
  X.fillStyle='#b09040'; X.fillRect(bx+19,by+18,5,2); X.fillRect(bx+19,by+30,5,2);
  X.fillStyle='#1a0800';
  X.fillRect(bx+21,by+21,1,2); X.fillRect(bx+21,by+24,1,2); X.fillRect(bx+21,by+27,1,2);
}

function drawGodHorus(bx,by) {
  X.fillStyle='#0a1030'; X.fillRect(bx+6,by+4,14,12);
  X.fillStyle='#1a40c0'; X.fillRect(bx+8,by,10,8);
  X.fillStyle='#2050e0'; X.fillRect(bx+11,by-4,5,6);
  X.fillStyle='#f0a000'; X.fillRect(bx+5,by+12,6,4); X.fillRect(bx+5,by+12,6,2);
  X.fillStyle='#f0c000'; X.fillRect(bx+14,by+7,4,3);
  X.fillStyle=COL.BLACK;    X.fillRect(bx+15,by+8,2,1);
  X.fillStyle='#f0c000'; X.fillRect(bx+15,by+11,4,2);
  X.fillStyle='#006030'; X.fillRect(bx+7,by+16,12,14);
  X.fillStyle=COL.GOLD; X.fillRect(bx+6,by+16,14,3);
  X.fillStyle='#f0f0e0'; X.fillRect(bx+7,by+30,12,8);
  X.fillStyle=COL.GOLD_DIM; X.fillRect(bx+7,by+38,3,1); X.fillRect(bx+16,by+38,3,1);
  X.fillStyle='#006030'; X.fillRect(bx+8,by+38,4,6); X.fillRect(bx+14,by+38,4,6);
  X.fillStyle=COL.GOLD_DIM; X.fillRect(bx+22,by+6,2,34);
  X.fillStyle='#808080'; X.fillRect(bx+21,by+4,4,4);
}

function drawGodAnubis(bx,by) {
  X.fillStyle=COL.BG_DARK;
  X.fillRect(bx+6,by,4,14); X.fillRect(bx+16,by,4,14);
  X.fillStyle='#3a1a08'; X.fillRect(bx+7,by+1,2,10); X.fillRect(bx+17,by+1,2,10);
  X.fillStyle=COL.BG_DARK; X.fillRect(bx+6,by+10,14,10);
  X.fillStyle=COL.BG_DARK; X.fillRect(bx+5,by+16,16,5);
  X.fillStyle='#f02000'; X.fillRect(bx+5,by+20,4,2);
  X.fillStyle='#ffffff'; X.fillRect(bx+8,by+13,3,3); X.fillRect(bx+15,by+13,3,3);
  X.fillStyle='#ff4000'; X.fillRect(bx+9,by+14,1,1); X.fillRect(bx+16,by+14,1,1);
  X.fillStyle=COL.BG_DARK; X.fillRect(bx+6,by+21,14,18);
  X.fillStyle='#3a2010'; X.fillRect(bx+8,by+23,10,14);
  X.fillStyle='#ffffff'; X.fillRect(bx+11,by+21,4,16);
  X.fillStyle=COL.BG_DARK; X.fillRect(bx+8,by+40,4,4); X.fillRect(bx+14,by+40,4,4);
  X.fillStyle='#f0c000';
  X.fillRect(bx+22,by+26,2,10); X.fillRect(bx+19,by+31,8,2); X.fillRect(bx+22,by+23,2,4);
  X.fillStyle='#c8a000';
  X.fillRect(bx+20,by+23,6,2); X.fillRect(bx+20,by+27,6,2);
  X.fillRect(bx+20,by+23,2,4); X.fillRect(bx+24,by+23,2,4);
}

function drawGodRa(bx,by) {
  X.fillStyle='#ff8800';
  X.beginPath(); X.arc(bx+16,by+4,12,0,Math.PI*2); X.fill();
  X.fillStyle='#ffcc00';
  X.beginPath(); X.arc(bx+16,by+4,8,0,Math.PI*2); X.fill();
  X.fillStyle='#ff6600';
  for (let r=0; r<8; r++) {
    const a = r * Math.PI/4;
    X.fillRect(Math.round(bx+16+Math.cos(a)*14)-1, Math.round(by+4+Math.sin(a)*14)-1, 2, 2);
  }
  X.fillStyle=COL.RED; X.fillRect(bx+14,by-4,4,5);
  X.fillStyle='#f0a000'; X.fillRect(bx+13,by-6,6,3);
  X.fillStyle='#1a1a00'; X.fillRect(bx+8,by+12,16,12);
  X.fillStyle='#f0a000'; X.fillRect(bx+5,by+18,6,3); X.fillRect(bx+5,by+18,6,1);
  X.fillStyle='#f0c000'; X.fillRect(bx+15,by+15,5,3);
  X.fillStyle=COL.BLACK;    X.fillRect(bx+16,by+16,2,1);
  X.fillStyle='#f0c000'; X.fillRect(bx+16,by+19,4,2);
  X.fillStyle=COL.GOLD; X.fillRect(bx+6,by+12,20,3);
  X.fillStyle='#c89000'; for(let i=0;i<4;i++) X.fillRect(bx+7+i*4,by+12,2,3);
  X.fillRect(bx+4,by+15,4,10); X.fillRect(bx+24,by+15,4,10);
  X.fillStyle=COL.GOLD; X.fillRect(bx+7,by+24,18,16);
  X.fillStyle='#c89000'; X.fillRect(bx+6,by+24,20,3);
  X.fillStyle=COL.GOLD; X.fillRect(bx+27,by+10,2,30);
  X.fillStyle='#ff6600'; X.fillRect(bx+26,by+8,4,4);
  X.fillStyle='#f8f0d0'; X.fillRect(bx+7,by+40,18,8);
  X.fillStyle=COL.GOLD; X.fillRect(bx+7,by+47,18,2);
  X.fillStyle=COL.GOLD_WARM; X.fillRect(bx+9,by+48,5,5); X.fillRect(bx+18,by+48,5,5);
}

function drawGodNut(bx,by) {
  X.fillStyle='#0818a0'; X.fillRect(bx+9,by-4,14,18);
  X.fillStyle='#1828c0'; X.fillRect(bx+10,by-2,12,14);
  X.fillStyle='#f0e840';
  X.fillRect(bx+12,by,2,2); X.fillRect(bx+17,by+4,2,2); X.fillRect(bx+11,by+8,2,2);
  X.fillStyle='#0818a0'; X.fillRect(bx+8,by+14,16,10);
  X.fillStyle='#ffffff'; X.fillRect(bx+10,by+16,3,3); X.fillRect(bx+19,by+16,3,3);
  X.fillStyle='#88aaff'; X.fillRect(bx+11,by+17,1,1); X.fillRect(bx+20,by+17,1,1);
  X.fillStyle=COL.BLACK; X.fillRect(bx+9,by+18,1,4); X.fillRect(bx+22,by+18,1,4);
  X.fillStyle='#0c1890'; X.fillRect(bx+7,by+24,18,18);
  X.fillStyle='#f0e840';
  X.fillRect(bx+9,by+26,2,2); X.fillRect(bx+18,by+29,2,2);
  X.fillRect(bx+12,by+33,2,2); X.fillRect(bx+21,by+36,2,2);
  X.fillStyle='#2838d8'; X.fillRect(bx+6,by+24,20,3);
  X.fillStyle='#0c1890'; X.fillRect(bx+7,by+42,18,6);
  X.fillStyle='#f0e840';
  X.fillRect(bx+10,by+44,2,2); X.fillRect(bx+19,by+46,2,2);
  X.fillStyle='#0818a0'; X.fillRect(bx+9,by+48,5,4); X.fillRect(bx+18,by+48,5,4);
}

function drawGodAmun(bx,by) {
  X.fillStyle='#1a40c0';
  X.fillRect(bx+9,by-16,6,20); X.fillRect(bx+17,by-16,6,20);
  X.fillStyle='#2858e0'; X.fillRect(bx+10,by-14,4,16); X.fillRect(bx+18,by-14,4,16);
  X.fillStyle='#2020a0'; X.fillRect(bx+7,by+2,18,8);
  X.fillStyle=COL.GOLD; X.fillRect(bx+7,by+2,18,2);
  X.fillStyle='#1828a0'; X.fillRect(bx+8,by+10,16,12);
  X.fillStyle=COL.GOLD; X.fillRect(bx+8,by+10,16,3);
  X.fillStyle=COL.GOLD_BRIGHT; X.fillRect(bx+10,by+13,4,3); X.fillRect(bx+18,by+13,4,3);
  X.fillStyle=COL.BLACK;    X.fillRect(bx+11,by+14,2,1); X.fillRect(bx+19,by+14,2,1);
  X.fillStyle='#f0c000'; X.fillRect(bx+9,by+17,2,5); X.fillRect(bx+21,by+17,2,5);
  X.fillStyle=COL.GOLD; X.fillRect(bx+5,by+22,22,4);
  X.fillStyle='#c89000';
  for(let i=0;i<5;i++) X.fillRect(bx+6+i*4,by+24,3,2);
  X.fillStyle='#1420a0'; X.fillRect(bx+7,by+26,18,16);
  X.fillStyle=COL.GOLD;
  X.fillRect(bx+11,by+28,3,2); X.fillRect(bx+18,by+30,3,2);
  X.fillRect(bx+10,by+34,3,2); X.fillRect(bx+19,by+37,3,2);
  X.fillStyle='#f0f0e0'; X.fillRect(bx+7,by+42,18,8);
  X.fillStyle=COL.GOLD; X.fillRect(bx+7,by+49,18,2);
  X.fillStyle='#1828a0'; X.fillRect(bx+9,by+50,5,4); X.fillRect(bx+17,by+50,5,4);
  X.fillStyle=COL.GOLD; X.fillRect(bx+27,by+4,3,42);
  X.fillStyle='#c89000'; X.fillRect(bx+26,by+4,5,3); X.fillRect(bx+25,by+7,3,4);
  X.fillStyle=COL.GOLD;
  X.fillRect(bx+1,by+28,2,14); X.fillRect(bx-2,by+33,8,2); X.fillRect(bx+1,by+24,2,6);
  X.fillStyle='#c8a000';
  X.fillRect(bx-1,by+24,6,2); X.fillRect(bx-1,by+30,6,2);
  X.fillRect(bx-1,by+24,2,6); X.fillRect(bx+3,by+24,2,6);
}
