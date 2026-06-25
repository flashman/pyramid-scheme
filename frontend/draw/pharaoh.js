// ── FILE: draw/pharaoh.js ────────────────────────────────
// Draws the player sprite.
//
// drawPharaoh(pose?)         — main function; reads G if no pose passed
// drawRealmPharaoh(realm)    — preferred for non-world realms; calls realm.getPlayerPose()
// drawChamberPharaoh(realm)  — legacy shim (backward compat)
// drawCouncilPharaoh(realm)  — legacy shim
// drawOasisPharaoh(realm)    — legacy shim
// drawVaultPharaoh(realm)    — legacy shim

import { G }                        from '../game/state.js';
import { X, CW, CH }                from '../engine/canvas.js';
import { COL }                      from '../engine/colors.js';
import { getTier }                  from '../game/tiers.js';
import { PresenceStore, PEER_FADE_MS } from '../game/presence.js';

export function drawPharaoh(pose) {
  const p = pose || {
    px: G.px, py: G.py, camX: G.camX, pZ: G.pZ,
    facing: G.facing, frame: G.pframe,
  };

  if (!G.bought) return;

  const sx  = Math.round(p.px - p.camX);
  const bob = Math.sin(Date.now() / 600) * 1.5;
  const dir = p.facing;
  const fr  = p.frame;
  const ghost = !!G.astralProjecting;   // you've left your body — render yourself spectral

  X.save();

  // While projecting, the local player is a gold spirit: an aura, plus a tint +
  // transparency applied to the body (the filter affects only the body draw).
  if (ghost) {
    const acx = sx + 16;
    const acy = p.pZ === -1 ? (CH - 32 - 38) : Math.round(p.py - 24 + bob);
    _spectralAura(acx, acy);
    X.globalAlpha = 0.62;
    X.filter = 'sepia(1) saturate(2.4) hue-rotate(-12deg) brightness(1.12)';
  }

  if (p.pZ === -1) {
    const scale = 1.4;
    const feetY = CH - 32;
    const pivotX = sx + 16;
    X.translate(pivotX, feetY);
    X.scale(dir === -1 ? -scale : scale, scale);
    const bx = -16;
    const sy = -48 + bob;
    X.fillStyle = '#00000050'; X.fillRect(bx + 2, 0, 28, 5);
    _drawBody(bx, sy, fr);
  } else {
    const sy = Math.round(p.py - 48 + bob);
    if (dir === -1) { X.translate(sx + 16, 0); X.scale(-1, 1); }
    const bx = dir === -1 ? 0 : sx;
    X.fillStyle = '#00000040'; X.fillRect(bx + 2, p.py - 4, 28, 5);
    _drawBody(bx, sy, fr);
  }

  X.restore();

  if (G.speech && G.speakT > 0) {
    const sx2 = Math.round(G.px - G.camX);
    const sy2 = G.pZ === -1 ? CH - 100 : Math.round(G.py - 48);
    G.speakT--;
    const bx2 = Math.max(4, Math.min(sx2 + (dir === 1 ? 28 : -118), CW - 116));
    const by2 = Math.max(4, sy2 - 24);
    X.fillStyle = COL.BLACK;  X.fillRect(bx2 - 2, by2 - 2, 116, 24);
    X.fillStyle = '#ffe';     X.fillRect(bx2, by2, 112, 20);
    X.fillStyle = COL.BLACK;  X.font = '6px monospace';
    X.fillText(G.speech, bx2 + 4, by2 + 13);
  }
  if (G.speakT <= 0) G.speech = null;
}

// showCrook defaults to the LOCAL player's tier. Peers pass false explicitly —
// a ghost must not sprout the viewer's PHARAOH regalia (the old getTier() bug).
export function _drawBody(bx, sy, fr, showCrook = getTier().name === 'PHARAOH') {
  X.fillStyle = COL.WHITE;
  X.fillRect(bx + 8,  sy + 34, 6, 14);
  X.fillRect(bx + 18, sy + 34 + (fr ? -2 : 0), 6, 14);
  X.fillStyle = '#e0e0e0'; X.fillRect(bx + 4, sy + 28, 24, 14);
  X.fillStyle = COL.GOLD_WARM; X.fillRect(bx + 8, sy + 14, 16, 16);
  X.fillStyle = COL.GOLD;     X.fillRect(bx + 6, sy + 14, 20, 6);
  X.fillStyle = COL.GOLD_DIM;
  for (let i = 0; i < 5; i++) X.fillRect(bx + 6 + i * 4, sy + 14, 3, 3);
  X.fillStyle = COL.GOLD_WARM; X.fillRect(bx + 9, sy + 4, 14, 12);
  X.fillStyle = COL.PLAYER_BLUE;
  X.fillRect(bx + 7, sy, 18, 10);
  X.fillRect(bx + 4, sy + 6, 6, 14);
  X.fillRect(bx + 22, sy + 6, 6, 14);
  X.fillStyle = COL.GOLD; X.fillRect(bx + 7, sy, 18, 3);
  if (showCrook) {
    X.fillStyle = COL.GOLD;
    X.fillRect(bx + 24, sy + 16, 3, 20);
    X.fillRect(bx + 24, sy + 16, 10, 3);
  }
  X.fillStyle = COL.BLACK;
  X.fillRect(bx + 12, sy + 7, 2, 2);
  X.fillRect(bx + 18, sy + 7, 2, 2);
  X.fillRect(bx + 11, sy + 8, 1, 4);
  X.fillRect(bx + 20, sy + 8, 1, 4);
  X.fillRect(bx + 13, sy + 12, 6, 1);
  X.fillRect(bx + 14, sy + 13, 4, 1);
}

export function drawChamberPharaoh(realm) { drawPharaoh(realm.getPlayerPose()); }
export function drawCouncilPharaoh(realm) { drawPharaoh(realm.getPlayerPose()); }
export function drawOasisPharaoh(realm)   { drawPharaoh(realm.getPlayerPose()); }
export function drawVaultPharaoh(realm)   { drawPharaoh(realm.getPlayerPose()); }

/**
 * Draw the player in any realm that implements getPlayerPose().
 * Prefer this over the realm-specific variants above — they exist
 * only for backward compatibility with existing draw file imports.
 *
 * In new draw files:
 *   import { drawRealmPharaoh } from '../../../draw/pharaoh.js';
 *   drawRealmPharaoh(realm);
 */
export function drawRealmPharaoh(realm) {
  const pose = realm.getPlayerPose();
  if (pose) drawPharaoh(pose);
}

// A steady scarab-gold glow centred on (cx, cy). Used for the local player's
// own spectral look while projecting (no materialise/fade ramps — just a pulse).
function _spectralAura(cx, cy) {
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 600 * 1.6);
  const r = 26 + pulse * 3;
  const g = X.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0,   'rgba(240,224,64,0.22)');
  g.addColorStop(0.5, 'rgba(240,192,32,0.10)');
  g.addColorStop(1,   'rgba(240,192,32,0)');
  X.save();
  X.fillStyle = g;
  X.fillRect(cx - r, cy - r, r * 2, r * 2);
  X.restore();
}

const MATERIALISE_MS = 600;

// Renders a peer with a floating username label. A peer who is astral-projecting
// (peer.isProjector) is the only ghost — drawn spectral/scarab-gold; everyone
// else is in their own body and renders fully solid. Both fade in/out smoothly.
// camY is 0 for all non-free-move realms (Y handled by canvas pre-translate or camY=0).
const VAULT_SCALE = 1.4;          // indoor realms draw the sprite feet-anchored, 1.4×
const VAULT_FEET  = CH - 32;       //   (mirrors drawPharaoh's pZ === -1 branch)

export function drawPeerPharaoh(peer, camX, camY = 0) {
  // ── Interpolate toward the latest networked pose (10 Hz → 60 fps) so the ghost
  //    glides instead of stepping. Snap on a big jump (teleport / realm change)
  //    rather than sliding across the screen. PresenceStore preserves rx/ry. ──
  if (peer.rx === undefined) { peer.rx = peer.px; peer.ry = peer.py; }
  const k = (Math.abs(peer.px - peer.rx) > 220 || Math.abs(peer.py - peer.ry) > 220) ? 1 : 0.25;
  peer.rx += (peer.px - peer.rx) * k;
  peer.ry += (peer.py - peer.ry) * k;

  const bob = Math.sin(Date.now() / 600) * 1.5;
  const dir = peer.facing ?? 1;
  const fr  = peer.frame  ?? 0;
  const isGhost = !!peer.isProjector;   // only out-of-body projectors are spectral
  const vault   = peer.pZ === -1;       // flat indoor realm (Beneath the Sphinx, etc.)

  const now = Date.now();

  // Materialisation: ramp 0→1 over MATERIALISE_MS after first sighting.
  const inRamp = Math.max(0, Math.min(1, (now - (peer._spawnT ?? 0)) / MATERIALISE_MS));
  const matIn  = inRamp * inRamp * (3 - 2 * inRamp);   // smoothstep

  // De-materialisation: once leaving, ramp the whole ghost back down to nothing.
  let leaveProg = 0;
  if (peer._leaveT != null) {
    const lr  = Math.min(1, (now - peer._leaveT) / PEER_FADE_MS);
    leaveProg = lr * lr * (3 - 2 * lr);                // smoothstep
  }
  const ease = matIn * (1 - leaveProg);   // overall visibility 0..1
  const t    = now / 600;

  const sx = Math.round(peer.rx - camX);
  const sy = Math.round(peer.ry - camY - 48);   // only used in the non-vault path

  // Sprite centre + label anchor differ between the two draw modes.
  const cx     = sx + 16;
  const cy     = vault ? VAULT_FEET - 34 : sy + bob + 24;
  const labelX = vault ? sx + 16 : sx + 8;
  const labelY = vault ? VAULT_FEET - 76 : sy + bob - 6;

  X.save();

  if (isGhost) {
    // ── Spectral aura — a gold radial glow. Blooms bright at spawn (announcing
    //    the arrival), expands and dissipates on departure, else a faint pulse. ──
    const bloom   = 1 - matIn;
    const pulse   = 0.5 + 0.5 * Math.sin(t * 1.6);
    const auraR   = 24 + bloom * 22 + pulse * 3 + leaveProg * 16;   // expands as it leaves
    const auraVis = 1 - leaveProg;                                  // fades on departure
    const aura    = X.createRadialGradient(cx, cy, 2, cx, cy, auraR);
    aura.addColorStop(0,   `rgba(240,224,64,${(0.16 + bloom * 0.46) * auraVis})`);
    aura.addColorStop(0.5, `rgba(240,192,32,${(0.07 + bloom * 0.24) * auraVis})`);
    aura.addColorStop(1,   'rgba(240,192,32,0)');
    X.fillStyle = aura;
    X.fillRect(cx - auraR, cy - auraR, auraR * 2, auraR * 2);

    // The ghost body — translucent and washed warm gold (the filter tints ONLY
    // the body draw, not the scene; harmlessly ignored where unsupported).
    X.globalAlpha = 0.55 * ease;
    X.filter = 'sepia(1) saturate(2.4) hue-rotate(-12deg) brightness(1.12)';
  } else {
    // Fully real — they're in their own body. Solid, normal colours; the alpha
    // ramp only smooths the appear/disappear, settling at full opacity.
    X.globalAlpha = ease;
  }

  // Body — indoor realms use the same scaled, feet-anchored transform as the
  // local player (drawPharaoh's pZ === -1 branch); elsewhere the sprite tracks py.
  if (vault) {
    X.translate(sx + 16, VAULT_FEET);
    X.scale(dir === -1 ? -VAULT_SCALE : VAULT_SCALE, VAULT_SCALE);
    _drawBody(-16, -48 + bob, fr, false);
  } else {
    if (dir === -1) { X.translate(sx + 16, 0); X.scale(-1, 1); }
    _drawBody(dir === -1 ? 0 : sx, sy + bob, fr, false);   // peers never show the viewer's regalia
  }
  X.restore();   // resets globalAlpha, transform, AND filter

  // Floating username label above the ghost (fades in with the body)
  if (peer.username) {
    X.save();
    X.globalAlpha = 0.75 * ease;
    X.font = '5px monospace';
    X.textAlign = 'center';
    X.fillStyle = 'rgba(0,0,0,0.5)';
    const tw = X.measureText(peer.username).width;
    X.fillRect(labelX - tw / 2 - 2, labelY - 6, tw + 4, 8);
    X.fillStyle = '#ffe066';
    X.fillText(peer.username, labelX, labelY);
    X.restore();
  }
}

// Draws all peers registered in PresenceStore as ghost pharaohs.
// camX/camY: viewer's camera; camY defaults to 0 for realms with a pre-translate.
export function drawAllPeers(camX, camY = 0) {
  for (const peer of PresenceStore.peers()) {
    drawPeerPharaoh(peer, camX, camY);
  }
}
