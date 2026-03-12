// ── FILE: draw/hud.js ────────────────────────────────────
// Draws the always-on-screen canvas HUD elements:
//   drawParts   — physics-simulated particle system tick + render
//   drawMinimap — scrolling world overview strip at the top
//   drawHUD     — bottom bar (stats, depth-switch hint, altitude, quest tracker)
//
// These are called from WorldRealm.render() after the world geometry is drawn.

import { G }               from '../game/state.js';
import { X, CW, CH }       from '../engine/canvas.js';
import { COL }             from '../engine/colors.js';
import { GND, WORLD_W, Z_LAYERS } from '../worlds/earth/constants.js';
import { LH }              from '../worlds/constants.js';
import { QuestManager }    from '../engine/flags.js';
import { DialogueManager } from '../engine/dialogue.js';
import { getTier }         from '../game/tiers.js';
import { SKY_GOD_DATA, SkyGodEntity } from '../worlds/earth/draw/gods.js';
import { surfAt }          from '../worlds/earth/terrain.js';

/**
 * Advances and renders all active particles in G.particles.
 * Applies gravity, fades by `life`, and removes dead particles.
 * Must be called once per frame inside a camera-translated context.
 *
 * @param {number} [camX=G.camX] - Camera X offset for this realm.
 *   World realms can omit this (defaults to G.camX).
 *   Non-world realms (atlantis, oasis) must pass their own camX so
 *   particles spawn at the correct screen position.
 */
export function drawParts(camX = G.camX) {
  for (let i = G.particles.length-1; i >= 0; i--) {
    const p = G.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.022;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    X.globalAlpha = p.life; X.fillStyle = p.c;
    X.fillRect(p.x - camX, p.y, p.s, p.s);
    X.globalAlpha = 1;
  }
}

/**
 * Renders the top minimap strip — a compressed view of the full 8000px world.
 * Pyramids are coloured by Z-layer; the player dot is always green.
 * The camera viewport is shown as a gold outline.
 */
export function drawMinimap() {
  const mx = 0, my = 0, mw = CW, mh = 16;
  X.fillStyle = '#0c0800'; X.fillRect(mx, my, mw, mh);
  X.fillStyle = COL.AMBER_DARK; X.fillRect(mx, my+mh-1, mw, 1);
  const sc = mw / WORLD_W;
  for (const p of G.pyramids) {
    const zl = Z_LAYERS[p.zLayer||0];
    const px = p.wx * sc;
    const ph = Math.max(1, p.layers * 1.5 * zl.scale);
    X.globalAlpha = zl.alpha * 0.8;
    X.fillStyle = p.isPlayer ? COL.GOLD : (p.zLayer===2?'#506070':p.zLayer===1?'#7a6030':'#a07820');
    X.fillRect(px-(p.isPlayer?3:2)*zl.scale, my+mh-ph-1, (p.isPlayer?6:4)*zl.scale, ph);
    X.globalAlpha = 1;
  }
  X.strokeStyle = '#c8a02066'; X.lineWidth = 1;
  X.strokeRect(G.camX*sc, my+1, CW*sc, mh-2);
  X.fillStyle = COL.GREEN; X.fillRect(G.px*sc-1.5, my+mh/2-1.5, 3, 3);
}

/**
 * Renders the bottom HUD bar:
 *  - Layers, invested, and net P&L.
 *  - Depth-plane toggle hint (↓ / ↑).
 *  - Altitude bar + nearest sky god indicator (only when airborne).
 *  - Active quest tracker overlay (bottom-left).
 */
export function drawHUD() {
  // Bottom status bar background
  X.fillStyle = '#1a0800'; X.fillRect(0, CH-28, CW, 28);
  X.fillStyle = COL.GOLD_DIM; X.fillRect(0, CH-28, CW, 2);
  X.font = '7px monospace';
  X.fillStyle = COL.GOLD_DIM;
  const playerPyr = G.pyramids.find(p => p.isPlayer);
  X.fillText(`LAYERS:${playerPyr?.layers||0}`, 8, CH-10);
  X.fillText(`INVESTED:$${G.invested}`, 130, CH-10);
  const net = G.earned - G.invested;
  X.fillStyle = net >= 0 ? COL.GREEN : COL.RED;
  X.fillText(`NET:${net>=0?'+':''}$${net.toFixed(2)}`, 355, CH-10);
  X.fillStyle = COL.GOLD; X.fillText(getTier().name, 530, CH-10);

  if (G.bought) {
    X.font = '5px monospace';
    if (G.pZ === -1) {
      const canSwitch = surfAt(G.px) === GND;
      X.fillStyle = canSwitch ? '#40f0a0' : '#406050';
      X.fillText(canSwitch ? '[↑] BACK TO SURFACE' : '[↑] WALK CLEAR FIRST', 530, CH-22);
    } else {
      X.fillStyle = '#405050'; X.fillText('[↓] WALK IN FRONT', 530, CH-22);
    }
  }

  // Altitude bar — only visible once the player is significantly airborne.
  const altitude = Math.max(0, GND - G.py);
  if (altitude > 50) {
    const pct  = Math.min(1, altitude / 800);
    const barW = Math.round(pct * 80);
    X.fillStyle = '#0a0020'; X.fillRect(CW-106, CH-24, 94, 16);
    X.fillStyle = pct > 0.5 ? COL.GOLD_BRIGHT : pct > 0.2 ? '#4080f0' : '#4080c0';
    X.fillRect(CW-104, CH-22, barW, 12);
    X.fillStyle = COL.GOLD_DIM; X.font = '5px monospace';
    X.fillText(`ALT:${altitude}`, CW-102, CH-13);

    const nearest = G.nearEntity;
    if (nearest instanceof SkyGodEntity) {
      X.globalAlpha = 0.6 + 0.4*Math.sin(Date.now()/300);
      X.fillStyle = COL.GOLD_BRIGHT; X.fillText('[SPACE] TO SPEAK', CW-104, CH-36);
      X.globalAlpha = 1;
    } else {
      const nextGod = SKY_GOD_DATA.find(sg => sg.worldY < G.py - 30);
      if (nextGod) {
        const dist = Math.round(Math.max(0, G.py - nextGod.worldY - 44));
        X.fillStyle = '#a080c0';
        X.fillText(dist < 60 ? `${nextGod.name} NEAR` : `${nextGod.name} -${dist}`, CW-104, CH-36);
      }
    }
  }

  _drawQuestTracker();
}

/**
 * Draws the active quest tracker in the bottom-left corner.
 * Shows the quest title and the next incomplete step.
 * Only renders the first incomplete quest whose condition is met.
 */
function _drawQuestTracker() {
  const active = QuestManager.all().find(q => !q._done && (!q.condition || q.condition()));
  if (!active) return;
  const prog = QuestManager.progress(active.id);
  if (!prog) return;
  X.font = '4px monospace';
  X.fillStyle = 'rgba(0,0,0,0.5)';
  X.fillRect(0, CH-50, 170, 20);
  X.fillStyle = COL.GOLD_DIM;
  X.fillText(`▶ ${active.title}`, 4, CH-40);
  X.fillStyle = COL.TAN;
  const step = active.steps[prog.step];
  if (step) X.fillText(`  ${step.desc}`, 4, CH-31);
}

