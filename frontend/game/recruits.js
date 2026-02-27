// ── FILE: game/recruits.js ───────────────────────────────

import { G }                                               from './state.js';
import { CFG, payoutAtDepth, maxPayDepth }                 from './config.js';
import { GND, Z_LAYERS, F_SLOTS, F_SLOTS_MID, F_SLOTS_FAR } from '../worlds/earth/constants.js';
import { LH }                                              from '../worlds/constants.js';
import { mkPyr, addLayer, pyrEarnings, PyramidLayout }    from './pyramids.js';
import { spawnParts, depthHex }                           from '../draw/utils.js';
import { COL }                                            from '../engine/colors.js';
import { Flags, QuestManager }                            from '../engine/flags.js';
import { Events }                                         from '../engine/events.js';
import { getTier, pickName, nextId }                      from './tiers.js';
import { showModal }                                      from '../ui/modal.js';
import { updateStats, updateSlots, addFriendUI, log }     from '../ui/panels.js';
import { CW }                                             from '../engine/canvas.js';

export function say(msg, ticks) { G.speech = msg; G.speakT = ticks; }

// ── Earth pyramid layout ──────────────────────────────────
// PyramidLayout manages near/mid/far slot arrays and their counters,
// replacing the raw G.nextSlot / G.nextSlotMid / G.nextSlotFar fields.
// Future realms create their own PyramidLayout with their own slot arrays.

export const earthLayout = new PyramidLayout({
  near: F_SLOTS,
  mid:  F_SLOTS_MID,
  far:  F_SLOTS_FAR,
});

export function buildPayoutSummary() {
  const lines = [];
  for (let d = 1; d <= Math.min(4, maxPayDepth()); d++) {
    const p = payoutAtDepth(d);
    if (p) lines.push(`D${d}: $${p.toFixed(2)} per join`);
  }
  if (maxPayDepth() > 4) lines.push('D5+: keeps halving...');
  return lines.join('\n');
}

export function checkMilestone() {
  const milestones = [5, 10, 20, 40, 80, 150];
  for (const m of milestones) {
    const key = `milestone_${m}`;
    if (G.earned >= m && !Flags.get(key)) {
      Flags.set(key, true);
      setTimeout(() => showModal('💰 MILESTONE!',
        `You've earned $${m.toFixed ? m.toFixed(2) : m} total!\n\nThe chain grows deep.\nYour empire expands.\n\nKeep recruiting, Pharaoh!`
      ), 400);
      Events.emit('milestone', { amount: m });
    }
  }
  const tier = getTier();
  if (tier.name !== Flags.get('last_tier', 'PEASANT')) {
    Flags.set('last_tier', tier.name);
    Events.emit('tier_change', { tier });
    QuestManager.check();
  }
}

export function addRecruit(name, depth, parentRec) {
  if (!G.bought) return;
  const payout = payoutAtDepth(depth);
  if (!payout) return;
  const zLayer = depth === 1 ? 0 : depth === 2 ? 1 : 2;

  const rootPid = depth === 1 ? null
    : depth === 2 ? (parentRec ? parentRec.pid : null)
    : (parentRec ? parentRec.rootPid : null);

  const fid = nextId();
  let pid;

  if (depth === 1) {
    const wx = earthLayout.nextX(1);
    pid = 'f' + fid;
    G.pyramids.push(mkPyr(pid, wx, name, false, 0));
    addLayer(pid, 1, name);
    addLayer('player', 1, name);
  } else if (depth === 2) {
    pid = parentRec ? parentRec.pid : null;
    const midWx = earthLayout.nextX(2);
    const midId = 'mid' + fid;
    G.pyramids.push(mkPyr(midId, midWx, name, false, 1));
    addLayer(midId, depth, name);
    if (pid) { const fp = G.pyramids.find(p => p.id === pid); if (fp) addLayer(pid, depth, name); }
    addLayer('player', depth, name);
    pid = midId;
  } else {
    pid = parentRec ? parentRec.pid : null;
    const farWx = earthLayout.nextX(3);
    const farId = 'far' + fid;
    G.pyramids.push(mkPyr(farId, farWx, name, false, 2));
    addLayer(farId, depth, name);
    if (pid) { const fp = G.pyramids.find(p => p.id === pid); if (fp) addLayer(pid, depth, name); }
    if (rootPid && rootPid !== pid) {
      const rfp = G.pyramids.find(p => p.id === rootPid);
      if (rfp) addLayer(rootPid, depth, name);
    }
    addLayer('player', depth, name);
    pid = farId;
  }

  const rec = {
    id: fid, name, depth, pid,
    rootPid: depth === 1 ? pid : rootPid,
    zLayer,
    parentName: parentRec ? parentRec.name : null,
    payoutToPlayer: payout,
  };
  G.recruits.push(rec);
  G.earned += payout;

  Events.emit('recruit', rec);

  addFriendUI(rec);
  const icon = depth === 1 ? '🏺' : depth <= 3 ? '🔸' : '🔹';
  const via  = parentRec ? ` via ${parentRec.name}` : '';
  log(`${icon} ${name}${via} [D${depth}] +$${payout.toFixed(2)}`, depth===1?'hi':depth===2?'mo':'');

  if (pid) {
    const fp = G.pyramids.find(p => p.id === pid);
    if (fp) {
      const zl = Z_LAYERS[fp.zLayer||0];
      spawnParts(fp.wx - G.camX*(1-zl.parallax), zl.groundY - fp.layers*Math.round(LH*zl.scale),
                 depthHex(depth), Math.max(3, 10-depth));
    }
  }

  if      (depth === 1) say(`+$${payout.toFixed(2)} BABY!`,     180);
  else if (depth === 2) say(`+$${payout.toFixed(2)} TRICKLE!`,  130);
  else if (depth === 3) say(`+$${payout.toFixed(2)} DEEP!`,     110);

  checkMilestone();
  updateStats();
  scheduleSubRecruits(rec);
}

// ── scheduleSubRecruits — generic variant ─────────────────
//
// scheduleSubRecruitsFor(rec, addFn) is the realm-portable form.
// Any realm can call it, providing its own addFn — keeping the
// trickle-down timing and probability logic here in one place
// rather than duplicating it per realm.
//
// scheduleSubRecruits(rec) is the Earth shorthand (addFn = addRecruit).

export function scheduleSubRecruitsFor(rec, addFn) {
  const d = rec.depth;
  const spawnProb = Math.max(0, 0.92 - d * 0.13);
  if (Math.random() > spawnProb || !payoutAtDepth(d + 1)) return;
  const n = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < n; i++) {
    const delay = 3000 + Math.random() * 11000 + i * 2800;
    setTimeout(() => { if (G.bought) addFn(pickName(), d + 1, rec); }, delay);
  }
}

export function scheduleSubRecruits(rec) {
  scheduleSubRecruitsFor(rec, addRecruit);
}

export function recruitFriend() {
  if (!G.bought || G.invitesLeft <= 0) { log('No scrolls left!', ''); return; }
  G.invitesLeft--;
  updateSlots();
  const name = pickName();
  log(`📜 Scroll sent to ${name}...`);
  setTimeout(() => addRecruit(name, 1, null), 800 + Math.random()*2200);
}

export function buyIn() {
  if (G.bought && G.invitesLeft > 0) { showModal('ALREADY IN!', 'Keep recruiting, Pharaoh!'); return; }
  const rebuy = G.bought;
  G.bought = true; G.invested += CFG.entryFee; G.invitesLeft = 4;
  if (!rebuy) {
    const pyr = mkPyr('player', 2520, 'YOU', true);
    G.pyramids.unshift(pyr);
    addLayer('player', 1, 'YOU');
    G.px = 2450; G.py = GND; G.camX = 2450 - CW/2; G.facing = 1;
    const code = 'PH' + Math.random().toString(36).substr(2,6).toUpperCase();
    document.getElementById('rc').textContent = code;
    document.getElementById('il').style.display = 'block';
  }
  document.getElementById('bi').disabled = true;
  document.getElementById('rb').disabled = false;
  updateSlots();
  say(rebuy ? 'MORE SCROLLS!' : 'TO THE STARS!', 220);
  spawnParts(2520, GND-30, COL.GOLD, 35);

  Events.emit('buyin', { rebuy });
  QuestManager.check();

  if (rebuy) {
    log('★ Bought 4 more scrolls for $' + CFG.entryFee + '!', 'hi');
    updateStats();
    showModal('📜 MORE SCROLLS!',
      `You paid $${CFG.entryFee} for 4 more invite scrolls.\nKeep building that empire!\n\n${buildPayoutSummary()}`);
  } else {
    log('★ You joined for $' + CFG.entryFee + '! Capstone placed!', 'hi');
    log('Walk ←→ to explore. SPACE near pyramids!', '');
    updateStats();
    showModal('🔺 YOU\'RE IN!',
      `You paid $${CFG.entryFee}.\n$${CFG.platformFee} platform fee kept.\n$${(CFG.entryFee-CFG.platformFee).toFixed(2)} flows up YOUR recruiter chain!\n\nSend scrolls. Each new join pays:\n${buildPayoutSummary()}\n\n← → Walk. SPACE to inspect pyramids.\nClimb by walking into them!`);
  }
}

export function inspectPyr(p) {
  if (!p) return;
  const total = pyrEarnings(p);
  const dCounts = {};
  for (const rec of G.recruits) {
    if (rec.pid === p.id) dCounts[rec.depth] = (dCounts[rec.depth]||0) + 1;
  }
  const breakdown = Object.entries(dCounts).map(([d,c]) => `D${d}: ${c} recruits`).join('\n');
  showModal(`📜 ${p.owner}'s PYRAMID`,
    `Layers: ${p.layers}\n\n${breakdown||'No sub-recruits yet'}\n\nThis pyramid has trickled\n+$${total} into YOUR pockets.\n\nThe scheme within the scheme.`);
}

export function unlockCrypt() {
  if (Flags.get('crypt_open')) return;
  Flags.set('crypt_open', true);
  G.shake = 10;
  const pp = G.pyramids.find(p => p.isPlayer);
  if (pp) spawnParts(pp.wx, GND-20, COL.NEON, 70);
  log('⚡★ THE PYRAMID TREMBLES... ★⚡', 'hi');
  log('A strange door appears at the base.', '');
  Events.emit('crypt_unlocked', {});
  showModal('⚡ THE CRYPT OPENS ⚡',
    'AMUN has spoken.\n\nDeep within your pyramid\nsomething ancient stirs.\n\n' +
    'Walk in front of the pyramid\n(press ↓) then approach\nthe glowing door and press [↑].');
}
