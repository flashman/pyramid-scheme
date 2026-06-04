// Hourglass loading screen — shown while the Render backend cold-starts.
// Exports waitForBackend(): resolves when GET /api/config returns 200.

const CSS = `
#hg-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #0a0500;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: monospace;
  transition: opacity 0.3s;
}
#hg-title {
  color: #f0c020;
  font-size: 12px;
  letter-spacing: 3px;
  margin-bottom: 24px;
}
#hg-wrap {
  transform-origin: center center;
  will-change: transform;
}
#hg-caption {
  color: #8a6a20;
  font-size: 6px;
  letter-spacing: 2px;
  margin-top: 14px;
  min-height: 12px;
}
`;

export function waitForBackend() {
  return new Promise(resolve => {
    const BASE = window.API_BASE || '';

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'hg-overlay';
    overlay.innerHTML = `
      <div id="hg-title">⚡ PYRAMID SCHEME™ ⚡</div>
      <div id="hg-wrap">
        <canvas id="hg-canvas" width="160" height="220"></canvas>
      </div>
      <div id="hg-caption">THE GODS REQUIRE TIME</div>
    `;
    document.body.appendChild(overlay);

    const stopAnim = _startHourglass(
      document.getElementById('hg-canvas'),
      document.getElementById('hg-wrap'),
      document.getElementById('hg-caption'),
    );

    async function poll() {
      try {
        const res = await fetch(`${BASE}/api/config`);
        if (res.ok) {
          stopAnim();
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 300);
          return;
        }
      } catch { /* backend not up yet */ }
      setTimeout(poll, 3000);
    }
    poll();
  });
}

function _startHourglass(canvas, wrap, caption) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;

  const TOP_Y = 14, BOT_Y = H - 14;
  const TOP_W = 54, BOT_W = 54;
  const NECK_YT = H * 0.47, NECK_YB = H * 0.53;
  const NECK_W = 3;
  const SPEED = 0.00018;

  let sandRatio = 0;
  let state = 'draining';
  let flipDeg = 0;
  let flipProg = 0;
  let pauseTimer = 0;
  const PAUSE_DUR = 0.7;
  const FLIP_DUR = 1.1;

  const particles = [];
  let running = true;

  const LABELS = [
    'THE GODS REQUIRE TIME',
    'THE SANDS FALL...',
    'PATIENCE, PHARAOH...',
    'NEARLY THERE...',
    'THE DESERT STIRS...',
  ];

  function makeWorldGrad() {
    const θ = flipDeg * Math.PI / 180;
    const len = (BOT_Y - TOP_Y) / 2;
    const g = ctx.createLinearGradient(
      CX - Math.sin(θ) * len, CY - Math.cos(θ) * len,
      CX + Math.sin(θ) * len, CY + Math.cos(θ) * len,
    );
    g.addColorStop(0,    '#f0d060');
    g.addColorStop(0.15, '#d08820');
    g.addColorStop(0.45, '#a06010');
    g.addColorStop(0.75, '#6a3c08');
    g.addColorStop(1,    '#3a1e00');
    return g;
  }

  function glassPath() {
    ctx.beginPath();
    ctx.moveTo(CX - TOP_W/2, TOP_Y);
    ctx.bezierCurveTo(CX-TOP_W/2, TOP_Y+30, CX-NECK_W/2, NECK_YT-10, CX-NECK_W/2, NECK_YT);
    ctx.lineTo(CX - NECK_W/2, NECK_YB);
    ctx.bezierCurveTo(CX-NECK_W/2, NECK_YB+10, CX-BOT_W/2, BOT_Y-30, CX-BOT_W/2, BOT_Y);
    ctx.lineTo(CX + BOT_W/2, BOT_Y);
    ctx.bezierCurveTo(CX+BOT_W/2, BOT_Y-30, CX+NECK_W/2, NECK_YB+10, CX+NECK_W/2, NECK_YB);
    ctx.lineTo(CX + NECK_W/2, NECK_YT);
    ctx.bezierCurveTo(CX+NECK_W/2, NECK_YT-10, CX+TOP_W/2, TOP_Y+30, CX+TOP_W/2, TOP_Y);
    ctx.closePath();
  }

  function drawSand() {
    const grad = makeWorldGrad();
    if (sandRatio < 0.99) {
      const surf = TOP_Y + sandRatio * (NECK_YT - TOP_Y);
      ctx.save(); glassPath(); ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(CX-TOP_W/2-2, surf, TOP_W+4, NECK_YT-surf+4);
      ctx.beginPath();
      for (let x = CX-TOP_W/2; x <= CX+TOP_W/2; x += 2) {
        const r = Math.sin(x*0.3 + Date.now()*0.002) * 0.7;
        x === Math.ceil(CX-TOP_W/2) ? ctx.moveTo(x, surf+r) : ctx.lineTo(x, surf+r);
      }
      ctx.strokeStyle = 'rgba(240,220,80,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    if (sandRatio > 0.01) {
      const surf = BOT_Y - sandRatio * (BOT_Y - NECK_YB);
      ctx.save(); glassPath(); ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(CX-BOT_W/2-2, surf, BOT_W+4, BOT_Y-surf+2);
      ctx.beginPath();
      ctx.moveTo(CX-BOT_W/2, surf+3);
      ctx.quadraticCurveTo(CX, surf-3, CX+BOT_W/2, surf+3);
      ctx.strokeStyle = 'rgba(240,200,60,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }

  function drawGlass() {
    ctx.save();
    ctx.shadowColor = '#c89030'; ctx.shadowBlur = 8;
    glassPath(); ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(CX-TOP_W/2+6, TOP_Y+4);
    ctx.bezierCurveTo(CX-TOP_W/2+6, TOP_Y+28, CX-NECK_W/2+3, NECK_YT-8, CX-NECK_W/2+3, NECK_YT);
    ctx.strokeStyle = 'rgba(255,230,120,0.11)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#c89030'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX-TOP_W/2-4, TOP_Y); ctx.lineTo(CX+TOP_W/2+4, TOP_Y);
    ctx.moveTo(CX-BOT_W/2-4, BOT_Y); ctx.lineTo(CX+BOT_W/2+4, BOT_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI*2);
      ctx.fillStyle = `rgba(240,192,32,${p.life})`; ctx.fill();
    });
  }

  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  let lastTs = null, ptTimer = 0;

  function frame(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    if (state === 'draining') {
      sandRatio = Math.min(1, sandRatio + SPEED * 1000 * dt);
      caption.textContent = LABELS[Math.min(4, Math.floor(sandRatio * 5))];
      ptTimer += dt;
      if (ptTimer > 0.09) {
        if (particles.length < 6 && sandRatio > 0.02 && sandRatio < 0.98) {
          particles.push({ x: CX+(Math.random()-0.5)*NECK_W, y: NECK_YT, vy: 1.0+Math.random()*1.2, life: 1 });
        }
        ptTimer = 0;
      }
      if (sandRatio >= 1) { state = 'pause'; pauseTimer = 0; particles.length = 0; }

    } else if (state === 'pause') {
      pauseTimer += dt;
      caption.textContent = 'TURNING THE GLASS...';
      if (pauseTimer >= PAUSE_DUR) { state = 'flipping'; flipProg = 0; }

    } else if (state === 'flipping') {
      flipProg = Math.min(1, flipProg + dt / FLIP_DUR);
      flipDeg = 180 * easeInOut(flipProg);
      wrap.style.transform = `rotate(${flipDeg}deg)`;
      caption.textContent = 'TURNING THE GLASS...';
      if (flipProg >= 1) {
        wrap.style.transform = 'rotate(0deg)';
        flipDeg = 0;
        sandRatio = 1 - sandRatio;
        state = 'draining';
      }
    }

    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      p.y += p.vy; p.vy += 0.1; p.life -= 0.035;
      if (p.y > NECK_YB+12 || p.life <= 0) particles.splice(i, 1);
    }

    ctx.clearRect(0, 0, W, H);
    drawSand(); drawGlass();
    if (state === 'draining') drawParticles();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return () => { running = false; };
}
