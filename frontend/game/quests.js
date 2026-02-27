// ── FILE: game/quests.js ─────────────────────────────────
// All quest definitions. Registered once at startup via registerAllQuests().
//
// Quest flow (each unlocks the next):
//   1. THE SCHEME BEGINS   — buy in + send first scroll
//   2. THE SEVEN HEAVENS   — meet all 7 sky gods + reach Pharaoh tier
//   3. THE COSMIC UPLINE   — enter crypt + speak to + accept Sector Chief
//   4. TIER OMEGA          — reach council + speak to + accept Grand Archon
//
// Quests use Flags to gate themselves; QuestManager.check() must be called
// after any state change that could advance quest steps.

import { G }            from './state.js';
import { Events }       from '../engine/events.js';
import { Flags, QuestManager } from '../engine/flags.js';
import { getTier }      from './tiers.js';
import { spawnParts }   from '../draw/utils.js';
import { COL }          from '../engine/colors.js';
import { unlockCrypt }  from './recruits.js';
import { showModal }    from '../ui/modal.js';
import { log }          from '../ui/panels.js';

export function registerAllQuests() {

  // ── Quest 1: Tutorial ──────────────────────────────────
  QuestManager.register({
    id:    'first_steps',
    title: 'THE SCHEME BEGINS',
    steps: [
      { desc: 'Buy in',          done: () => G.bought },
      { desc: 'Send a scroll',   done: () => G.recruits.length >= 1 },
    ],
    onComplete() {
      Events.emit('quest:first_steps_done', {});
    },
  });

  // ── Quest 2: Sky gods + Pharaoh tier ──────────────────
  QuestManager.register({
    id:    'seven_heavens',
    title: 'THE SEVEN HEAVENS',
    steps: [
      { desc: 'Meet all 7 sky gods',   done: () => Flags.get('gods_met', 0) >= 7 },
      { desc: 'Reach PHARAOH tier',    done: () => getTier().name === 'PHARAOH'   },
    ],
    onComplete() {
      Flags.set('seven_heavens_done', true);
      G.shake = 12;
      spawnParts(G.px, G.py - 20, COL.GOLD, 80);
      setTimeout(() => {
        unlockCrypt();
        showModal(
          '✦ THE SEVEN HEAVENS ✦',
          'THE GODS HAVE SPOKEN.\n\nYOU HAVE WALKED THE SKY\nAND BUILT YOUR EMPIRE.\n\nDESCEND NOW INTO YOUR\nPYRAMID. SOMETHING STIRS\nBENEATH THE CAPSTONE.\n\nThe Chief awaits.'
        );
      }, 600);
    },
  });

  // ── Quest 3: Crypt + Sector Chief ─────────────────────
  QuestManager.register({
    id:    'cosmic_upline',
    title: 'THE COSMIC UPLINE',
    condition: () => Flags.get('seven_heavens_done'),
    steps: [
      { desc: 'Enter the crypt',         done: () => Flags.get('crypt_entered')       },
      { desc: 'Speak to Sector Chief',   done: () => Flags.get('chief_spoken')        },
      { desc: 'Accept the upline offer', done: () => Flags.get('upline_accepted')     },
    ],
    onComplete() {
      Flags.set('cosmic_upline_done', true);
      G.shake = 20;
      log('⚡★⚡ THE COSMOS OPENS ⚡★⚡', 'hi');
      setTimeout(() => showModal(
        '⚡ COSMIC UPLINE ACCEPTED ⚡',
        'YOUR FRANCHISE IS APPROVED.\n\nEARTH BRANCH 7G IS NOW\nA FULL MEMBER OF THE\nGALACTIC PYRAMID SCHEME™\n\nRECRUIT WORLDS.\nALWAYS 4.\nALWAYS MORE.'
      ), 800);
      Events.emit('cosmic_upline_complete', {});
    },
  });

  // ── Quest 4: Galactic Council + Grand Archon ──────────
  QuestManager.register({
    id:    'tier_omega',
    title: 'TIER OMEGA',
    condition: () => Flags.get('cosmic_upline_done'),
    steps: [
      { desc: 'Ascend from the capstone',  done: () => Flags.get('council_entered')     },
      { desc: 'Speak to the Grand Archon', done: () => Flags.get('archon_spoken')       },
      { desc: 'Accept TIER OMEGA',         done: () => Flags.get('tier_omega_accepted') },
    ],
    onComplete() {
      Flags.set('tier_omega_done', true);
      G.shake = 20;
      spawnParts(G.px, G.py - 20, '#aa44ff', 100);
      setTimeout(() => showModal(
        '⚡ TIER OMEGA ⚡',
        'EARTH FRANCHISE 7G\nIS FULLY INTEGRATED.\n\nYOU ARE NOW RECRUITING\nPLANETS INTO THE SCHEME.\n\nTHE UNIVERSE PROFITS.\nSO DO YOU.\n\nALWAYS 4. ALWAYS MORE.\nTHE SCHEME IS ETERNAL.'
      ), 800);
      log('⚡★ TIER OMEGA ACHIEVED ★⚡', 'hi');
      Events.emit('tier_omega_complete', {});
    },
  });
}
