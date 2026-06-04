# Hourglass Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the cold-start hourglass with a slower animation, four cycling label sets (one per turn), and a quiet procedural sandy white noise track.

**Architecture:** All changes confined to `frontend/ui/loading-hourglass.js`. Task 1 covers the animation tweaks (speed + cycling labels). Task 2 adds the audio. No other files touched.

**Tech Stack:** Vanilla JS, Web Audio API, Canvas 2D. No bundler, no imports, no audio files.

---

### Task 1: Slow animation + cycling label sets

**Files:**
- Modify: `frontend/ui/loading-hourglass.js`

The relevant section is `_startHourglass()` (starts at line 105). Key lines to change:
- Line 114: `const SPEED = 0.00018;`
- Lines 128–134: `const LABELS = [...]`
- Line 229: label lookup using `LABELS`
- Lines 249–254: flip completion block

- [ ] **Step 1: Change SPEED**

On line 114, change:
```js
  const SPEED = 0.00018;
```
to:
```js
  const SPEED = 0.00012;
```

- [ ] **Step 2: Replace LABELS with LABEL_SETS**

Replace lines 128–134:
```js
  const LABELS = [
    'THE GODS REQUIRE TIME',
    'THE SANDS FALL...',
    'PATIENCE, PHARAOH...',
    'NEARLY THERE...',
    'THE DESERT STIRS...',
  ];
```
with:
```js
  const LABEL_SETS = [
    ['THE GODS REQUIRE TIME', 'THE SANDS FALL...', 'PATIENCE, PHARAOH...', 'NEARLY THERE...', 'THE DESERT STIRS...'],
    ['WAKING THE PHARAOH...', 'BRIBING THE SCRIBES...', 'STACKING THE STONES...', 'PYRAMID RISING...', 'ALMOST OPEN...'],
    ['THE ORACLE SLEEPS...', 'SANDS OF ETERNITY...', 'THE ANCIENTS STIR...', 'THE VEIL THINS...', 'THE DESERT WAKES...'],
    ['IN THE BEGINNING...', 'THE SANDS REMEMBER...', 'A WORLD STIRS...', 'A PHARAOH DREAMS...', 'THE EMPIRE WAKES...'],
  ];
```

- [ ] **Step 3: Add turnIndex state variable**

After line 120 (`let pauseTimer = 0;`), add:
```js
  let turnIndex = 0;
```

- [ ] **Step 4: Update label lookup in draining state**

On line 229 (inside the `if (state === 'draining')` block), change:
```js
      caption.textContent = LABELS[Math.min(4, Math.floor(sandRatio * 5))];
```
to:
```js
      caption.textContent = LABEL_SETS[turnIndex % 4][Math.min(4, Math.floor(sandRatio * 5))];
```

- [ ] **Step 5: Increment turnIndex on flip completion**

The flip completion block currently reads (around line 249–254):
```js
      if (flipProg >= 1) {
        wrap.style.transform = 'rotate(0deg)';
        flipDeg = 0;
        sandRatio = 1 - sandRatio;
        state = 'draining';
      }
```
Add `turnIndex++;` so it reads:
```js
      if (flipProg >= 1) {
        wrap.style.transform = 'rotate(0deg)';
        flipDeg = 0;
        sandRatio = 1 - sandRatio;
        turnIndex++;
        state = 'draining';
      }
```

- [ ] **Step 6: Verify the file looks correct**

Read `frontend/ui/loading-hourglass.js` and confirm:
1. `SPEED = 0.00012`
2. `LABEL_SETS` exists with 4 inner arrays of 5 strings each
3. `let turnIndex = 0` is declared alongside the other state variables
4. Label lookup uses `LABEL_SETS[turnIndex % 4][...]`
5. `turnIndex++` is inside the `if (flipProg >= 1)` block

- [ ] **Step 7: Commit**

```bash
git add frontend/ui/loading-hourglass.js
git commit -m "feat: slow hourglass animation, cycle 4 label sets per turn"
```

---

### Task 2: Sandy white noise audio

**Files:**
- Modify: `frontend/ui/loading-hourglass.js`

Two changes: (a) add `_startSandAudio()` function, (b) wire it into `_showOverlayAndWait`.

- [ ] **Step 1: Add _startSandAudio() function**

Add this function after the closing `}` of `_pollUntilHealthy` and before `function _showOverlayAndWait`:

```js
function _startSandAudio() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.8);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    return () => {
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.32);
      setTimeout(() => { try { source.stop(); ctx.close(); } catch {} }, 350);
    };
  } catch {
    return () => {};
  }
}
```

- [ ] **Step 2: Wire _startSandAudio into _showOverlayAndWait**

In `_showOverlayAndWait`, the current code after `document.body.appendChild(overlay)` and the `_startHourglass` call reads:

```js
    const stopAnim = _startHourglass(
      document.getElementById('hg-canvas'),
      document.getElementById('hg-wrap'),
      document.getElementById('hg-caption'),
    );

    Promise.all([_minDelay(MIN_DISPLAY_MS), _pollUntilHealthy(BASE)]).then(() => {
      stopAnim();
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 320);
    });
```

Change it to:

```js
    const stopAnim = _startHourglass(
      document.getElementById('hg-canvas'),
      document.getElementById('hg-wrap'),
      document.getElementById('hg-caption'),
    );
    const stopAudio = _startSandAudio();

    Promise.all([_minDelay(MIN_DISPLAY_MS), _pollUntilHealthy(BASE)]).then(() => {
      stopAudio();
      stopAnim();
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 320);
    });
```

- [ ] **Step 3: Verify the file looks correct**

Read `frontend/ui/loading-hourglass.js` and confirm:
1. `_startSandAudio()` function exists between `_pollUntilHealthy` and `_showOverlayAndWait`
2. It creates an `AudioContext`, a looping white noise `BufferSourceNode`, a bandpass `BiquadFilterNode` at 2000 Hz Q 0.8, and a `GainNode` at 0.07 with 800ms fade-in
3. It returns a stop function that ramps gain to 0 over 320ms then calls `source.stop()` and `ctx.close()` after 350ms
4. The whole function is wrapped in try/catch so audio failures are silent
5. `_showOverlayAndWait` calls `_startSandAudio()` after `_startHourglass()` and calls `stopAudio()` before `stopAnim()` on dismiss

- [ ] **Step 4: Commit**

```bash
git add frontend/ui/loading-hourglass.js
git commit -m "feat: add procedural sandy white noise audio to hourglass"
```
