// ── FILE: ui/panels.js ───────────────────────────────────
// Updates the HTML side-panels (left: stats + payout table + log;
// right: actions + recruit list). Called from game logic whenever
// state changes — no polling, event-driven updates only.

import { G }          from '../game/state.js';
import { COL }        from '../engine/colors.js';
import { depthHex }   from '../draw/utils.js';
import { getTier }    from '../game/tiers.js';

/** Refreshes the empire stats block (invested, earned, net, recruits, layers, depth breakdown). */
export function updateStats() {
  const net = G.earned - G.invested;
  document.getElementById('s-inv').textContent = `$${G.invested}`;
  document.getElementById('s-ern').textContent = `$${G.earned.toFixed(2)}`;
  const nel = document.getElementById('s-net');
  nel.textContent = `${net>=0?'+':''}$${net.toFixed(2)}`;
  nel.className = 'sv '+(net>0?'g':net<0?'r':'');
  document.getElementById('s-tot').textContent = G.recruits.length;
  const pp = G.pyramids.find(p=>p.isPlayer);
  document.getElementById('s-ly').textContent = pp?.layers||0;
  const counts = {};
  for (const r of G.recruits) counts[r.depth]=(counts[r.depth]||0)+1;
  const dbEl = document.getElementById('db-rows');
  if (Object.keys(counts).length === 0) {
    dbEl.innerHTML='<span style="color:#402000;font-size:4px">—</span>';
  } else {
    dbEl.innerHTML = Object.entries(counts).sort((a,b)=>+a[0]-+b[0]).map(([d,c])=>
      `<span class="db-chip" style="color:${depthHex(+d)};border-color:${depthHex(+d)}55">D${d}:${c}</span>`
    ).join('');
  }
  const tier = getTier();
  document.getElementById('tn').textContent = tier.name;
  document.getElementById('td').textContent = tier.desc;
}

/** Refreshes the invite-scroll slot icons and enables/disables the Recruit/Buy-More buttons. */
export function updateSlots() {
  for (let i=0; i<4; i++) {
    const el=document.getElementById('s'+i); if (!el) continue;
    const used=4-G.invitesLeft;
    if (i<used) { el.className='ss us'; el.textContent='✗'; }
    else        { el.className='ss av'; el.textContent='📜'; }
  }
  const btn=document.getElementById('rb');
  const sub=document.getElementById('rs');
  const biBtn=document.getElementById('bi');
  if (G.invitesLeft>0 && G.bought) {
    btn.disabled=false;
    if(sub) sub.textContent=`${G.invitesLeft} SCROLL${G.invitesLeft>1?'S':''} LEFT`;
    if(biBtn) biBtn.disabled=true;
  } else if (G.bought) {
    btn.disabled=true;
    if(sub) sub.textContent='OUT OF SCROLLS';
    if(biBtn) {
      biBtn.disabled=false;
      biBtn.innerHTML='💰 BUY MORE<br><span style="font-size:5px;display:block;margin-top:3px">$10 → 4 SCROLLS</span>';
    }
  }
}

/**
 * Prepends a new recruit card to the follower list panel.
 * Renders a tiny canvas avatar whose colour reflects recruit depth.
 * @param {object} rec - A recruit object from G.recruits.
 */
export function addFriendUI(rec) {
  document.getElementById('nf').style.display='none';
  const list = document.getElementById('fl');
  const col  = depthHex(rec.depth);
  const d = document.createElement('div');
  d.className='fe';
  d.innerHTML=`<canvas class="fi" width="10" height="10" id="fi${rec.id}"></canvas>
    <span class="fn" style="color:${col}">${rec.name}</span>
    <span class="fs" style="color:${col}">D${rec.depth}</span>`;
  list.prepend(d);
  setTimeout(()=>{
    const fc=document.getElementById('fi'+rec.id); if (!fc) return;
    const fx=fc.getContext('2d');
    const hc = rec.depth===1?COL.PLAYER_BLUE:rec.depth===2?'#186098':'#553088';
    fx.fillStyle=hc; fx.fillRect(3,0,4,2);
    fx.fillStyle=COL.GOLD_WARM; fx.fillRect(2,2,6,4);
    fx.fillStyle=COL.WHITE; fx.fillRect(2,6,6,4);
  }, 40);
}

/**
 * Appends a line to the activity log panel (capped at 30 entries).
 * @param {string} msg - The message text.
 * @param {string} [cls=''] - Optional CSS class: 'hi' for highlighted gold text.
 */
export function log(msg, cls='') {
  const b=document.getElementById('lb');
  const d=document.createElement('div');
  d.className='le '+cls; d.textContent=msg; b.prepend(d);
  if (b.children.length>30) b.lastChild.remove();
}
