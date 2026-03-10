// ── FILE: worlds/atlantis/AtlantisRealm.js ──────────────
// The Lost City of Atlantis — the drowned org chart.
// A multi-level ascension cult that believed depth was enlightenment.
// The flood came. Nobody swam up. They were waiting for their upline.

import { Realm, RealmManager }      from '../../engine/realm.js';
import { G }                        from '../../game/state.js';
import { CW, CH }                   from '../../engine/canvas.js';
import { Flags, QuestManager }      from '../../engine/flags.js';
import { InteractableRegistry }     from '../../engine/interactables.js';
import { NPC, Entity }              from '../../engine/entity.js';
import { Dialogue, DialogueManager }from '../../engine/dialogue.js';
import { log }                      from '../../ui/panels.js';
import {
  ATLANTIS_WORLD_W, ATLANTIS_WORLD_H,
  ATLANTIS_ENTRY_Y, ATLANTIS_EXIT_Y, ATLANTIS_FLOOR_Y,
  ZONE_1_END, ZONE_2_END, ZONE_3_END, ZONE_4_END,
  SWIM_ACC, SWIM_DRAG, SWIM_MAX_SPD, SWIM_BUOYANCY,
  GREETER_WX, GREETER_WY, PILLAR_WX, PILLAR_WY,
  FOUNDER_WX, FOUNDER_WY, TABLET_WX, TABLET_WY,
  CHOIR_WX, CHOIR_WY, CHOIR_RADIUS,
  SHARK_PATROL_Y, SHARK_PATROL_X1, SHARK_PATROL_X2,
  SHARK_SPEED, SHARK_CHASE_SPD, SHARK_AGGRO, SHARK_HURT,
  SQUID_START_WX, SQUID_START_WY,
  SQUID_SPEED, SQUID_CHASE_SPD, SQUID_AGGRO, SQUID_HURT,
  DEVOTED_SPEED, DEVOTED_AGGRO, DEVOTED_HURT,
} from './constants.js';
import { drawAtlantis }      from './draw/atlantis.js';
import { atlantisTransRender }from '../transitions.js';

// ═══════════════════════════════════════════════════════
// Death message system
// ═══════════════════════════════════════════════════════

const _DEATH = {
  shark: [
    'TIER VIOLATION DETECTED.\nYOU HAVE BEEN REFERRED UPLINE.',
    'COMPLIANCE IS NOT OPTIONAL.\nYOUR RESIDUALS HAVE BEEN TRANSFERRED TO YOUR UPLINE.',
    'THE SHARK IS NOT A PREDATOR.\nIT IS A COLLECTIONS AGENT.',
    'MEMBERSHIP REVIEWED: DECEASED.\nNEXT AVAILABLE TIER: ALSO DECEASED.',
    'YOUR BODY IS BEING PROCESSED\nAS A WRITE-OFF.',
  ],
  squid: [
    'YOUR REACTIVE MEMORIES HAVE BEEN CLEARED.',
    'YOUR REACTIVE MEMORIES HAVE BEEN CLEARED.\nUNFORTUNATELY THIS INCLUDES THE MEMORY OF BEING ALIVE.',
    'THE AUDITOR HAS PROCESSED YOUR DOUBTS.\nALSO YOUR ORGANS.',
    'YOU ARE NOW CLEAR.\nCLARITY IS PERMANENT.',
    'THE AUDITOR ASKS NO QUESTIONS.\nIT NEVER NEEDED TO.',
  ],
  devoted: [
    'YOU WERE LOVED TO DEATH\nBY PEOPLE WHO WERE CERTAIN THEY WERE HELPING.',
    'THEY SHARED THE TEACHINGS WITH YOU.\nREPEATEDLY.\nUNTIL YOU STOPPED MOVING.',
    'THEY MEANT SO WELL.\nTHEY ALWAYS MEAN SO WELL.',
    'HARMONIZED.\nYOUR VIBRATION HAS BEEN STANDARDISED TO ZERO.',
    'THEY ARE STILL REACHING TOWARD YOU.\nEVEN NOW.\nESPECIALLY NOW.',
  ],
  choir: [
    'YOU WERE HARMONIZED TO DEATH\nBY PEOPLE WHO WERE CERTAIN\nTHEY WERE ASCENDING.',
    'THE CIRCLE IS COMPLETE.\nYOU HAVE JOINED THE CIRCLE.\nTHIS IS AN HONOUR.',
    'THEIR SONG IS PERFECT.\nIT WILL ALWAYS BE PERFECT.\nTHEY HAVE BEEN PRACTICING\nSINCE 9,600 BC.',
  ],
};

const _ESCALATION = [
  [5,  'THIS IS YOUR 5TH DEATH.\nWE CONSIDER THIS ENGAGEMENT.'],
  [10, 'TEN DEATHS.\nYOU QUALIFY FOR THE PLATINUM TIER OF DYING.'],
  [15, 'FIFTEEN DEATHS.\nWE HAVE NAMED A CONFERENCE ROOM\nAFTER YOU.'],
  [20, 'TWENTY DEATHS.\nYOU ARE THE MOST DEDICATED RECRUIT\nIN ATLANTEAN HISTORY.\nWORSE THAN THAT:\nYOU KEEP COMING BACK.'],
];

function _pickDeathMsg(cause, deathCount) {
  const lines = _DEATH[cause] || _DEATH.shark;
  const base  = lines[Math.min(deathCount, lines.length - 1)];

  // After reading the deepest tablet, all deaths get the extra line
  if (Flags.get('atlantis_deepest_tablet')) {
    return base + '\n\nYOU KNOW TOO MUCH.\nTHE SYSTEM CANNOT ALLOW A CLEAR\nWHO UNDERSTANDS THE SYSTEM.';
  }

  // Escalation milestones override the body text
  for (let i = _ESCALATION.length - 1; i >= 0; i--) {
    if (deathCount >= _ESCALATION[i][0]) {
      return _ESCALATION[i][1];
    }
  }

  return base;
}

// ═══════════════════════════════════════════════════════
// NPC Dialogues
// ═══════════════════════════════════════════════════════

function _buildGreeterDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'WELCOME TO THE\nATLANTEAN ASCENSION SYSTEM.\n\nI AM REQUIRED BY CHARTER TO INFORM YOU\nTHAT THIS IS NOT A PYRAMID SCHEME.',
      next: 'clarify',
    },
    clarify: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'THE PYRAMID IS A SYMBOL OF ASCENSION.\nTHE SCHEME IS THE PATH.\nTHESE ARE DIFFERENT THINGS.\n\nI HAVE A LEAFLET EXPLAINING THIS.\nTHE LEAFLET IS ALSO UNDERWATER.',
      next: 'wait',
    },
    wait: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'I HAVE BEEN WAITING\nAT THIS DESK\nFOR 12,000 YEARS\nFOR A PROSPECT.\n\nARE YOU A PROSPECT?',
      choices: [
        { label: 'YES — I AM A PROSPECT', next: 'yes_path' },
        { label: 'NO — I AM JUST SWIMMING', next: 'no_path' },
      ],
    },
    yes_path: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'EXCELLENT.\nI KNEW IT.\nI COULD TELL BY THE WAY YOU SWAM IN.\n\nI WILL NOW ADD YOU TO MY DOWNLINE.\nTHIS IS AN HONOUR.\nTHIS IS AN OPPORTUNITY.',
      next: 'fee',
    },
    no_path: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'I UNDERSTAND.\nFEAR IS NORMAL.\nFEAR IS THE SURFACE TALKING.\n\nI WILL ADD YOU TO MY DOWNLINE ANYWAY.\nAS A COMPLIMENTARY PLACEMENT.\nYOU ARE WELCOME.',
      next: 'fee',
    },
    fee: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'YOUR ENROLMENT FEE IS 400 CRYSTALS.\nCRYSTALS WHICH, I ACKNOWLEDGE,\nARE BURIED UNDER\n10,000 YEARS OF SEDIMENT.\n\nWE WILL WAIVE THE FEE.\nTODAY ONLY.\nIT HAS BEEN TODAY ONLY\nSINCE 9,800 BC.',
      next: 'enrolled',
    },
    enrolled: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'WELCOME, TIER 1.\n\nYOUR UPLINE IS ME.\nI HAVE NOT ASCENDED YET.\nI AM VERY CLOSE.\n\nI HAVE BEEN VERY CLOSE\nSINCE 9,700 BC.',
      onEnter: () => {
        if (!Flags.get('atlantis_tier')) Flags.set('atlantis_tier', 1);
        Flags.set('atlantis_recruited', true);
        log('✦ You have been added to the Atlantean downline.', 'hi');
        log('Tier 1. The Greeter is Tier 9. Do the math.', '');
        QuestManager.check();
      },
      next: 'goodbye',
    },
    goodbye: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'THE DEEPER YOU GO,\nTHE CLOSER YOU ARE TO ASCENSION.\n\nTHAT IS WHAT THEY TOLD ME.\nI BELIEVE THEM.\n\nI AM STILL BELIEVING THEM.',
      next: null,
    },
  });
}

function _buildFounderDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'YOU FOUND ME.\n\nNOT MANY DO.\nMOST TURN BACK.\nTHE WATER GETS HEAVY\nDOWN HERE.',
      next: 'origin',
    },
    origin: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I WAS THE FIRST.\nTHE ORIGINAL SOURCE.\n\nI WAS TOLD THIS\nBY MY UPLINE.\nMY UPLINE WAS VERY PERSUASIVE.',
      next: 'system_built',
    },
    system_built: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I BUILT THE TIERS.\nI WROTE THE DOCTRINE.\nI DREW THE ORG CHARTS ON STONE.\n\nTHE DEVOTION OF THE PEOPLE\nWAS GENUINELY MOVING.\nI WAS MOVED BY IT MYSELF.',
      next: 'flood',
    },
    flood: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'WHEN THE WATER CAME,\nI TOLD THEM IT WAS A CLEANSING.\nA TRANSITION TO THE NEXT TIER.\n\nSOME OF THEM BELIEVED ME.\nTHEY ARE STILL OUT THERE.\nCIRCLING.',
      next: 'found_room',
    },
    found_room: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I WANT TO TELL YOU SOMETHING\nI HAVE TOLD NO ONE.\n\nI FOUND A TABLET IN THIS ROOM.\nIN THIS CHAIR.\nBEFORE I BUILT ANYTHING.',
      next: 'tablet_truth',
    },
    tablet_truth: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'IT DESCRIBED THE SYSTEM.\nMY SYSTEM. EXACTLY.\nTHE TIERS. THE FEES.\nTHE PROMISE OF ASCENSION.\n\nI DID NOT WRITE THAT TABLET.',
      next: 'denial',
    },
    denial: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I TOLD MYSELF IT WAS PROPHETIC.\nTHAT I WAS THE PROPHET.\nTHAT THE SYSTEM CHOSE ME.\n\nI WAS VERY CONVINCING.\nEVEN TO MYSELF.\nESPECIALLY TO MYSELF.',
      next: 'warning',
    },
    warning: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'THE TABLET IS STILL HERE.\nBURIED IN THE SEDIMENT.\nWEST OF THIS ROOM.\n\nI SUGGEST YOU READ IT.\n\nI WISH I HAD.\nEARLIER.',
      onEnter: () => {
        Flags.set('atlantis_founder_read', true);
        log('✦ The Founder finishes speaking. Their bones don\'t move.', 'hi');
        log('The deepest tablet. West of the throne room.', '');
        QuestManager.check();
      },
      next: null,
    },
  });
}

// ═══════════════════════════════════════════════════════
// AtlantisRealm
// ═══════════════════════════════════════════════════════

export class AtlantisRealm extends Realm {
  constructor() {
    super('atlantis', 'THE LOST CITY OF ATLANTIS');

    this.px  = ATLANTIS_WORLD_W / 2;
    this.py  = ATLANTIS_ENTRY_Y;
    this.pvx = 0;
    this.pvy = 0;
    this.camX = 0;
    this.camY = 0;
    this.moving  = false;
    this.frame   = 0;
    this._frameT = 0;

    // ── Death state ──────────────────────────────────────
    this._dying      = false;
    this._dyingT     = 0;
    this._deathMsg   = '';
    this._deathCause = '';
    this._immuneUntil = 0;   // timestamp — enemies can't kill before this

    // ── Choir timer (harmonization takes 2.4s) ───────────
    this._choirT   = 0;       // timestamp when player entered choir circle
    this._inChoir  = false;

    // ── Interactables ─────────────────────────────────────
    this.registry = new InteractableRegistry();
    this._buildEntities();

    // ── Enemies ───────────────────────────────────────────
    this._buildEnemies();
  }

  // ── Entity construction ────────────────────────────────

  _buildEntities() {
    // ── Welcome Pillar ──────────────────────────────────
    const pillar = new Entity('welcome_pillar', PILLAR_WX, PILLAR_WY);
    pillar.interactRange = 75;
    pillar.onInteract = () => {
      if (Flags.get('atlantis_pillar_read')) {
        log('THE PILLAR STILL SAYS WHAT IT SAYS.', '');
        return;
      }
      Flags.set('atlantis_pillar_read', true);
      log('✦ THE PILLAR READS:', 'hi');
      setTimeout(() => log('"THIS IS NOT A PYRAMID SCHEME."', ''), 200);
      setTimeout(() => log('"THE PYRAMID IS A SYMBOL OF ASCENSION."', ''), 700);
      setTimeout(() => log('"THE SCHEME IS THE PATH."', ''), 1200);
      setTimeout(() => log('"THESE ARE DIFFERENT THINGS."', ''), 1700);
      setTimeout(() => log('You have seen this before. On land.', ''), 2400);
    };
    this.registry.register(pillar);

    // ── The Greeter ─────────────────────────────────────
    const greeterNPC = new NPC('greeter', GREETER_WX, GREETER_WY, 'THE GREETER', _buildGreeterDialogue());
    greeterNPC.interactRange = 90;
    this.registry.register(greeterNPC);

    // ── The Founder ─────────────────────────────────────
    const founderNPC = new NPC('founder', FOUNDER_WX, FOUNDER_WY, 'THE FOUNDER', _buildFounderDialogue());
    founderNPC.interactRange = 100;
    this.registry.register(founderNPC);

    // ── The Deepest Tablet ───────────────────────────────
    const tablet = new Entity('deepest_tablet', TABLET_WX, TABLET_WY);
    tablet.interactRange = 80;
    tablet.onInteract = () => {
      if (!Flags.get('atlantis_founder_read')) {
        log('A stone tablet, half-buried in silt.', '');
        log('The inscription is worn. Come back when you know more.', '');
        return;
      }
      if (Flags.get('atlantis_deepest_tablet')) {
        log('THE SYSTEM IS THE UPLINE.', '');
        log('You already know this. You keep coming back anyway.', '');
        return;
      }
      // First read — the revelation
      Flags.set('atlantis_deepest_tablet', true);
      G.shake = 14;
      log('✦ WE DID NOT INVENT THIS.', 'hi');
      setTimeout(() => log('WE FOUND THEIR SYSTEM. THEIR RECORDS. THEIR THRONE.', ''), 700);
      setTimeout(() => log('WE BUILT ON TOP. AS THEY BUILT ON TOP OF WHAT CAME BEFORE.', ''), 1600);
      setTimeout(() => log('THE PYRAMID GOES DEEPER THAN THE OCEAN.', 'hi'), 2500);
      setTimeout(() => log('THERE IS NO UPLINE.', ''), 3400);
      setTimeout(() => log('THERE NEVER WAS AN UPLINE.', ''), 4000);
      setTimeout(() => log('✦ THE SYSTEM IS THE UPLINE.', 'hi'), 4800);
      setTimeout(() => log('PASS IT ON.', ''), 5600);
      QuestManager.check();
    };
    this.registry.register(tablet);
  }

  _buildEnemies() {
    // ── Compliance Shark ─────────────────────────────────
    this.shark = {
      wx:       SHARK_PATROL_X1 + 400,
      wy:       SHARK_PATROL_Y,
      dir:      1,
      chasing:  false,
      speed:    SHARK_SPEED,
      active:   true,
    };

    // ── The Auditor (giant squid) ─────────────────────────
    this.squid = {
      wx:       SQUID_START_WX,
      wy:       SQUID_START_WY,
      pvx:      0,
      pvy:      0,
      chasing:  false,
      active:   true,
    };

    // ── The Devoted (3 skeletal swimmers) ─────────────────
    this.devoted = [
      { wx: 400,  wy: 1260, active: true, phase: 0.0 },
      { wx: 2200, wy: 1380, active: true, phase: 2.1 },
      { wx: 1100, wy: 1480, active: true, phase: 4.3 },
    ];
  }

  // ── Lifecycle ──────────────────────────────────────────

  onEnter(fromId) {
    this.px  = ATLANTIS_WORLD_W / 2;
    this.py  = ATLANTIS_ENTRY_Y;
    this.pvx = 0;
    this.pvy = 1.5;
    this._dying   = false;
    this._inChoir = false;
    this._choirT  = 0;
    this._immuneUntil = Date.now() + 2000;  // 2s grace on first entry

    // Reset devoted positions
    this.devoted[0].wx = 400;  this.devoted[0].wy = 1260;
    this.devoted[1].wx = 2200; this.devoted[1].wy = 1380;
    this.devoted[2].wx = 1100; this.devoted[2].wy = 1480;

    this._syncCamera();
    this._syncToG();

    Flags.set('atlantis_visited', true);
    Flags.inc('atlantis_dives');
    G.shake = 6;

    log('✦ You plunge beneath the surface.', 'hi');
    setTimeout(() => {
      log('The water closes above you.', '');
      log('Arrow keys to swim. [↑] near surface to return.', '');
    }, 600);
    setTimeout(() => {
      if (!Flags.get('atlantis_recruited')) {
        log('Something vast and organised lies below.', '');
      } else {
        log(`Welcome back, Tier ${Flags.get('atlantis_tier', 1)}.`, '');
      }
    }, 1600);
  }

  onExit() {
    G.shake = 4;
  }

  // ── Camera ─────────────────────────────────────────────

  _syncCamera() {
    const targetX = this.px - CW / 2;
    const targetY = this.py - CH / 2;
    this.camX += (targetX - this.camX) * 0.1;
    this.camY += (targetY - this.camY) * 0.1;
    this.camX = Math.max(0, Math.min(ATLANTIS_WORLD_W - CW, this.camX));
    this.camY = Math.max(0, Math.min(ATLANTIS_WORLD_H - CH, this.camY));
  }

  // ── State → G ──────────────────────────────────────────

  _syncToG() {
    G.px      = this.px;
    G.py      = this.py;
    G.pvx     = this.pvx;
    G.pvy     = this.pvy;
    G.camX    = this.camX;
    G.camY    = this.camY;
    G.facing  = this.pvx < -0.3 ? -1 : 1;
    G.pmoving = this.moving;
    G.pframe  = this.frame;
  }

  getPlayerPose() {
    return {
      px: this.px, py: this.py,
      camX: this.camX, camY: this.camY,
      pZ: 0, facing: G.facing, frame: this.frame,
    };
  }

  // ── Enemy updates ─────────────────────────────────────

  _updateEnemies(ts) {
    // Post-spawn / post-respawn immunity window — nothing can kill you
    if (Date.now() < this._immuneUntil) return;

    const px = this.px;
    const py = this.py;

    // ── Compliance Shark ─────────────────────────────────
    {
      const s = this.shark;
      const dist = Math.hypot(px - s.wx, py - s.wy);
      s.chasing = dist < SHARK_AGGRO && py < ZONE_2_END;

      if (s.chasing) {
        const dx  = px - s.wx;
        const dy  = py - s.wy;
        const len = Math.hypot(dx, dy) || 1;
        s.wx += (dx / len) * SHARK_CHASE_SPD;
        s.wy += (dy / len) * SHARK_CHASE_SPD * 0.25; // limited vertical movement
        s.dir = dx > 0 ? 1 : -1;
      } else {
        s.wx += SHARK_SPEED * s.dir;
        if (s.wx > SHARK_PATROL_X2) { s.wx = SHARK_PATROL_X2; s.dir = -1; }
        if (s.wx < SHARK_PATROL_X1) { s.wx = SHARK_PATROL_X1; s.dir =  1; }
        // Drift slowly back to patrol depth
        s.wy += (SHARK_PATROL_Y - s.wy) * 0.02;
      }

      if (!this._dying && !DialogueManager.isActive() &&
          Math.hypot(px - s.wx, py - s.wy) < SHARK_HURT) {
        this._killPlayer('shark');
      }
    }

    // ── The Auditor (squid) ───────────────────────────────
    {
      const sq = this.squid;
      const dist = Math.hypot(px - sq.wx, py - sq.wy);
      const inZone3 = py >= ZONE_2_END && py <= ZONE_3_END;
      sq.chasing = dist < SQUID_AGGRO && py >= ZONE_2_END; // pursues once you enter its domain

      if (sq.chasing) {
        const dx  = px - sq.wx;
        const dy  = py - sq.wy;
        const len = Math.hypot(dx, dy) || 1;
        const spd = dist < 180 ? SQUID_CHASE_SPD * 1.6 : SQUID_CHASE_SPD;
        sq.pvx += (dx / len) * 0.06;
        sq.pvy += (dy / len) * 0.06;
      } else {
        // Slow ambient drift — it is always somewhere
        sq.pvx += Math.sin(ts / 2400) * 0.012;
        sq.pvy += Math.cos(ts / 3100) * 0.012;
      }

      // Max squid speed
      const sqSpd = Math.hypot(sq.pvx, sq.pvy);
      const maxSqSpd = sq.chasing ? SQUID_CHASE_SPD : SQUID_SPEED;
      if (sqSpd > maxSqSpd) {
        sq.pvx = (sq.pvx / sqSpd) * maxSqSpd;
        sq.pvy = (sq.pvy / sqSpd) * maxSqSpd;
      }

      sq.pvx *= 0.96;
      sq.pvy *= 0.96;
      sq.wx += sq.pvx;
      sq.wy += sq.pvy;

      // World clamp
      sq.wx = Math.max(80, Math.min(ATLANTIS_WORLD_W - 80, sq.wx));
      sq.wy = Math.max(ZONE_2_END - 50, Math.min(ZONE_3_END + 50, sq.wy));

      if (!this._dying && !DialogueManager.isActive() &&
          Math.hypot(px - sq.wx, py - sq.wy) < SQUID_HURT) {
        this._killPlayer('squid');
      }
    }

    // ── The Devoted ───────────────────────────────────────
    for (const d of this.devoted) {
      if (!d.active) continue;
      const dist = Math.hypot(px - d.wx, py - d.wy);
      const inRange = py >= ZONE_3_END && dist < DEVOTED_AGGRO;

      if (inRange) {
        const dx  = px - d.wx;
        const dy  = py - d.wy;
        const len = Math.hypot(dx, dy) || 1;
        d.wx += (dx / len) * DEVOTED_SPEED;
        d.wy += (dy / len) * DEVOTED_SPEED;
      } else {
        // Slow ambient drift in their zone
        d.wx += Math.sin(ts / 1800 + d.phase) * 0.3;
        d.wy += Math.cos(ts / 2200 + d.phase) * 0.2;
        d.wy = Math.max(ZONE_3_END, Math.min(ATLANTIS_FLOOR_Y - 40, d.wy));
      }

      d.wx = Math.max(40, Math.min(ATLANTIS_WORLD_W - 40, d.wx));

      if (!this._dying && !DialogueManager.isActive() &&
          Math.hypot(px - d.wx, py - d.wy) < DEVOTED_HURT) {
        this._killPlayer('devoted');
      }
    }

    // ── Choir circle hazard ───────────────────────────────
    if (!this._dying && !DialogueManager.isActive()) {
      const choirDist = Math.hypot(px - CHOIR_WX, py - CHOIR_WY);
      if (choirDist < CHOIR_RADIUS) {
        if (!this._inChoir) {
          this._inChoir = true;
          this._choirT  = Date.now();
          log('A sound builds around you. Not quite sound.', '');
        } else if (Date.now() - this._choirT > 2400) {
          this._killPlayer('choir');
        }
      } else {
        if (this._inChoir) {
          this._inChoir = false;
          log('The harmonizing fades. You swam fast enough.', '');
        }
      }
    }
  }

  // ── Death & Respawn ────────────────────────────────────

  _killPlayer(cause) {
    if (this._dying) return;
    if (DialogueManager.isActive()) return; // dialogue protects you
    Flags.inc('atlantis_deaths');
    const deathCount = Flags.get('atlantis_deaths', 0);
    this._dying      = true;
    this._dyingT     = Date.now();
    this._deathMsg   = _pickDeathMsg(cause, deathCount);
    this._deathCause = cause;
    this._inChoir    = false;
    G.shake          = 22;
    this.pvx = 0;
    this.pvy = 0;
    // The log is shown after a short delay so the message is readable
    setTimeout(() => log(`✦ ${this._deathMsg.split('\n')[0]}`, 'hi'), 300);
  }

  _respawn() {
    this._dying = false;
    this._immuneUntil = Date.now() + 3000;  // 3s — enough time to swim clear
    this.px   = ATLANTIS_WORLD_W / 2 + (Math.random() - 0.5) * 200;
    this.py   = ATLANTIS_ENTRY_Y + 30;
    this.pvx  = 0;
    this.pvy  = 0;
    this._inChoir = false;
    G.shake = 8;

    const deaths = Flags.get('atlantis_deaths', 0);
    if (deaths === 1) {
      log('✦ You breach the surface. The oasis air hits you.', 'hi');
      log('Your thetan has been repositioned.', '');
    } else if (deaths < 5) {
      log('✦ The surface again. The system returned you.', 'hi');
    } else {
      log(`✦ Death #${deaths}. You surface. Again.`, 'hi');
      log('The system always returns you.', '');
    }
  }

  // ── Update ─────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;

    // ── Death countdown ───────────────────────────────────
    if (this._dying) {
      if (Date.now() - this._dyingT > 2800) this._respawn();
      // Still update camera so the death screen looks right
      this._syncCamera();
      return;
    }

    // ── Pause during dialogue ─────────────────────────────
    if (DialogueManager.isActive()) return;

    const keys = G.keys;

    // ── Buoyancy ──────────────────────────────────────────
    this.pvy += SWIM_BUOYANCY;

    // ── Input ─────────────────────────────────────────────
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) this.pvx -= SWIM_ACC;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) this.pvx += SWIM_ACC;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) this.pvy -= SWIM_ACC;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) this.pvy += SWIM_ACC;

    // ── Drag ──────────────────────────────────────────────
    this.pvx *= SWIM_DRAG;
    this.pvy *= SWIM_DRAG;

    // ── Speed clamp ───────────────────────────────────────
    const maxSpd = SWIM_MAX_SPD * (keys['Shift'] ? 1.6 : 1.0);
    this.pvx = Math.max(-maxSpd, Math.min(maxSpd, this.pvx));
    this.pvy = Math.max(-maxSpd, Math.min(maxSpd, this.pvy));

    if (Math.abs(this.pvx) < 0.08) this.pvx = 0;
    if (Math.abs(this.pvy) < 0.08) this.pvy = 0;

    // ── Move ──────────────────────────────────────────────
    this.px += this.pvx;
    this.py += this.pvy;

    // ── World clamp ───────────────────────────────────────
    this.px = Math.max(20, Math.min(ATLANTIS_WORLD_W - 20, this.px));
    this.py = Math.max(0,  Math.min(ATLANTIS_WORLD_H - 20, this.py));

    if (this.py >= ATLANTIS_WORLD_H - 20) {
      this.py  = ATLANTIS_WORLD_H - 20;
      this.pvy = -Math.abs(this.pvy) * 0.4;
    }

    // ── Enemy & hazard update ─────────────────────────────
    this._updateEnemies(ts);

    // ── Interactable proximity ────────────────────────────
    this.registry.update(this.px, this.py);

    // ── Animation ─────────────────────────────────────────
    this.moving = Math.abs(this.pvx) + Math.abs(this.pvy) > 0.3;
    if (this.moving && ts - this._frameT > 180) {
      this._frameT = ts;
      this.frame   = 1 - this.frame;
    } else if (!this.moving) {
      this.frame = 0;
    }

    // ── Zone-first-visit logs ─────────────────────────────
    if (this.py > ZONE_1_END && !Flags.get('atlantis_zone2')) {
      Flags.set('atlantis_zone2', true);
      log('The gold on the columns is painted.', '');
      log('You can see where the paint is flaking.', '');
    }
    if (this.py > ZONE_2_END && !Flags.get('atlantis_zone3')) {
      Flags.set('atlantis_zone3', true);
      log('Rows of stone chairs. All facing the same direction.', '');
      log('Something moves in the dark ahead.', '');
    }
    if (this.py > ZONE_3_END && !Flags.get('atlantis_zone4')) {
      Flags.set('atlantis_zone4', true);
      log('Portraits of the same face. Everywhere.', '');
      log('The faces in the portraits watch you.', '');
    }
    if (this.py > ZONE_4_END && !Flags.get('atlantis_zone5')) {
      Flags.set('atlantis_zone5', true);
      log('✦ The Founder\'s Vault.', 'hi');
      log('A throne. A cage around the throne.', '');
      log('The cage is locked from the inside.', '');
    }

    this._syncCamera();
    this._syncToG();
  }

  // ── Key handling ───────────────────────────────────────

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (this._dying) return false;

    // Dialogue takes over
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);

    // Surface exit
    if ((key === 'ArrowUp' || key === 'w' || key === 'W') && this.py <= ATLANTIS_EXIT_Y) {
      log('✦ You breach the surface.', 'hi');
      G.shake = 8;
      RealmManager.scheduleTransition('oasis', {
        duration: 1200,
        render:   atlantisTransRender,
      });
      return true;
    }

    // Interact with nearest NPC / tablet
    if (key === ' ') {
      return this.registry.interact();
    }

    return false;
  }

  // ── Render ─────────────────────────────────────────────

  render() {
    drawAtlantis(this);
    DialogueManager.render();
  }
}
