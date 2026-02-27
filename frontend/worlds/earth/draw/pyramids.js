// ── FILE: worlds/earth/draw/pyramids.js ─────────────────

import { G }                        from '../../../game/state.js';
import { X, CW }                    from '../../../engine/canvas.js';
import { COL }                      from '../../../engine/colors.js';
import { GND, Z_LAYERS }            from '../constants.js';
import { LH, CAP_W, SLOPE }         from '../../constants.js';
import { depthColor, fogTint }      from '../../../draw/utils.js';
import { Flags }                    from '../../../engine/flags.js';
import { lyrRect }              from '../terrain.js';
import { pyrEarnings }          from '../../../game/pyramids.js';

export function drawCryptDoor(screenCX, gnd) {
  const t  = Date.now();
  const p1 = Math.sin(t / 700);
  const p2 = 0.5 + 0.5 * Math.abs(p1);
  const dW = 34, dH = 46, archR = dW / 2;
  const dx = Math.round(screenCX - dW / 2);
  const dy = gnd - dH;
  X.fillStyle = '#150700'; X.fillRect(dx - 6, dy - 7, dW + 12, dH + 7);
  X.fillStyle = '#000408';
  X.beginPath(); X.arc(Math.round(screenCX), dy + archR, archR, Math.PI, 0); X.fill();
  X.fillRect(dx, dy + archR, dW, dH - archR);
  X.save();
  X.globalAlpha = 0.28 + 0.14 * p2;
  const grd = X.createRadialGradient(screenCX, dy+dH*0.55, 2, screenCX, dy+dH*0.55, dW*1.3);
  grd.addColorStop(0, COL.NEON); grd.addColorStop(1, 'transparent');
  X.fillStyle = grd; X.fillRect(dx - 18, dy - 14, dW + 36, dH + 20);
  X.restore();
  X.save();
  X.globalAlpha = 0.45 + 0.3 * p1;
  X.fillStyle = COL.NEON; X.font = '8px monospace'; X.textAlign = 'center';
  X.fillText('⊗', dx - 9, dy + 26); X.fillText('⊗', dx + dW + 9, dy + 26);
  X.fillStyle = `rgba(0,255,136,${0.35 + 0.2 * p2})`;
  X.font = '5px monospace'; X.fillText('▷ ▷ ▷', screenCX, dy - 2);
  X.textAlign = 'left';
  X.restore();
  if (G.pZ === -1) {
    const pp = G.pyramids.find(p => p.isPlayer);
    if (pp && Math.abs(G.px - pp.wx) < 55) {
      const hp = 0.65 + 0.35 * Math.abs(Math.sin(t / 480));
      X.save(); X.globalAlpha = hp;
      X.fillStyle = COL.NEON; X.font = '6px monospace'; X.textAlign = 'center';
      X.fillText('[↑] ENTER CRYPT', screenCX, dy - 12);
      X.textAlign = 'left'; X.restore();
    }
  }
}

export function drawPyr(p) {
  if (!p.layers) return;
  const zl  = Z_LAYERS[p.zLayer || 0];
  const cam = G.camX * zl.parallax;
  const gnd = zl.groundY;
  const fog = zl.fog;
  const sc  = zl.scale;
  let animOff = 0;
  if (p._anim) {
    const t = (Date.now() - p._animT) / 450;
    if (t < 1) animOff = (1-t)*38*sc;
    else p._anim = false;
  }
  X.save();
  X.globalAlpha = zl.alpha;
  for (let i = 0; i < p.layers; i++) {
    const fullW = CAP_W + i * SLOPE * 2;
    const w  = Math.round(fullW * sc);
    const h  = Math.round(LH * sc);
    const bx = Math.round(p.wx - cam - w / 2);
    const baseY = gnd - (p.layers - i) * h;
    const isNewest  = (i === p.layers-1);
    const sy = baseY + (isNewest && p._anim ? animOff : 0);
    const isCapstone = (i === 0);
    const depth = p.tiers[i] || 1;
    const baseCol = isCapstone
      ? {face:'rgb(240,216,64)',top:'rgb(255,248,160)',bot:'rgb(128,96,0)',txt:'rgb(58,40,0)'}
      : depthColor(depth);
    const col = { face:fogTint(baseCol.face,fog), top:fogTint(baseCol.top,fog),
                  bot:fogTint(baseCol.bot,fog),   txt:fogTint(baseCol.txt,fog) };
    if (bx + w < 0 || bx > CW) continue;
    X.fillStyle=col.face; X.fillRect(bx, sy, w, h-2);
    X.fillStyle=col.top;  X.fillRect(bx, sy, w, Math.max(1,Math.round(2*sc)));
    X.fillStyle=col.bot;  X.fillRect(bx, sy+h-Math.round(4*sc), w, Math.round(4*sc));
    if (p.isPlayer && sc >= 1.0) {
      X.save();
      X.globalAlpha = zl.alpha * (0.35 + 0.2 * Math.sin(Date.now() / 600));
      X.fillStyle = COL.GOLD_BRIGHT;
      X.fillRect(bx, sy, w, 2);
      X.restore();
    }
    if (sc > 0.5) {
      X.fillStyle=col.bot;
      const ms = Math.max(16, Math.floor(w/Math.max(1,Math.floor(w/40))));
      for (let m=ms; m<w-4; m+=ms) X.fillRect(bx+m, sy+2, Math.max(1,Math.round(2*sc)), h-6);
    }
    if (p.isPlayer && !isCapstone && i>0 && p.tiers[i-1]===depth) {
      X.fillStyle='#2a1400'; X.fillRect(bx+2,sy-3,w-4,3);
      X.fillStyle='#6a4010'; X.fillRect(bx+2,sy-1,w-4,1);
    }
    if (isCapstone) {
      const ex=bx+w/2, ey=sy+h/2;
      const er = Math.max(3, Math.round(8*sc));
      X.fillStyle=fog > 0.4 ? '#c87040' : '#ff8800';
      X.beginPath(); X.ellipse(ex,ey,er,Math.round(er*0.6),0,0,Math.PI*2); X.fill();
      X.fillStyle=COL.BLACK;
      X.beginPath(); X.arc(ex,ey,Math.max(1,Math.round(3*sc)),0,Math.PI*2); X.fill();
      if (sc > 0.5) {
        X.fillStyle=COL.WHITE;
        X.beginPath(); X.arc(ex+1,ey-1,Math.max(1,Math.round(1.5*sc)),0,Math.PI*2); X.fill();
      }
      if (sc >= 1.0) {
        X.save(); X.globalAlpha=zl.alpha*(0.18+0.12*Math.sin(Date.now()/400));
        const g=X.createRadialGradient(ex,ey,0,ex,ey,26);
        g.addColorStop(0,COL.GOLD_BRIGHT); g.addColorStop(1,'transparent');
        X.fillStyle=g; X.fillRect(ex-22,sy-8,44,28); X.restore();
      }
      if (sc > 0.5) {
        X.font=`${Math.round(6*sc)}px monospace`; X.fillStyle='#00000066';
        const lbl=p.owner.substring(0,8);
        X.fillText(lbl, ex-X.measureText(lbl).width/2, sy+h-4);
      }
    }
    if (!isCapstone && w>50 && p.names[i]) {
      X.fillStyle=col.txt; X.globalAlpha=zl.alpha*0.5;
      X.font=`${Math.min(7,Math.floor(w/12))}px monospace`;
      X.fillText(p.names[i], bx+5, sy+14);
      X.globalAlpha=zl.alpha;
    }
  }
  const bw = Math.round((CAP_W + (p.layers-1)*SLOPE*2)*sc);
  X.fillStyle='#00000033';
  X.fillRect(Math.round(p.wx-cam-bw/2), gnd-2, bw, 6);
  X.restore();
  if (!p.isPlayer && G.nearPyr===p && zl.scale >= 1.0) {
    const tx = p.wx - cam;
    const topY = gnd - p.layers*LH;
    const ty = Math.max(8, topY-52);
    X.fillStyle='#000000aa'; X.fillRect(tx-64,ty,128,46);
    X.fillStyle=COL.GOLD_DIM; X.fillRect(tx-64,ty,128,2); X.fillRect(tx-64,ty+44,128,2);
    X.font='6px monospace';
    X.fillStyle=COL.GOLD; X.fillText(p.owner, tx-X.measureText(p.owner).width/2, ty+13);
    const info=`LAYERS: ${p.layers}`;
    X.fillStyle=COL.GOLD_DIM; X.fillText(info, tx-X.measureText(info).width/2, ty+25);
    const earn=`+$${pyrEarnings(p)} TO YOU`;
    X.fillStyle=COL.GREEN; X.fillText(earn, tx-X.measureText(earn).width/2, ty+37);
    X.fillStyle='#f0c02099'; X.font='5px monospace';
    const hint='[SPACE] INSPECT';
    X.fillText(hint, tx-X.measureText(hint).width/2, ty+62);
  }
  if (p.isPlayer && Flags.get('crypt_open') && zl.scale >= 1.0) {
    drawCryptDoor(Math.round(p.wx - cam), gnd);
  }
}
