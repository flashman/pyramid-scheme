// ── FILE: audio/sound.js ─────────────────────────────────
// Procedural chiptune soundtrack for PYRAMID SCHEME™.
// Uses the Web Audio API — zero audio files, everything generated on the fly.
//
// Public API:
//   SoundManager.playRealm(realmId)   — start the theme for a realm
//   SoundManager.stop()               — silence everything
//   SoundManager.setEnabled(bool)     — mute/unmute, persisted to localStorage
//   SoundManager.setVolume(0..1)      — master volume, persisted to localStorage
//   SoundManager.resume()             — call on first user interaction to unblock
//                                       the browser's autoplay policy
//   SoundManager.enabled              — current on/off state
//   SoundManager.volume               — current volume level

// ── Note frequency table (Hz) ─────────────────────────────
// Named with octave suffix; flats written as lowercase 'b' after letter.
const N = {
  // Octave 1
  Bb1: 58.27,
  // Octave 2
  D2: 73.42, F2: 87.31,  G2: 98.00,  A2: 110.00, Bb2: 116.54, B2: 123.47,
  // Octave 3
  C3: 130.81, D3: 146.83, Eb3: 155.56, F3: 174.61, G3: 196.00,
  Ab3: 207.65, A3: 220.00, B3: 246.94,
  // Octave 4
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  // Octave 5
  C5: 523.25, D5: 587.33,
};
const _ = null; // musical rest

// ── Theme definitions ─────────────────────────────────────
// Each theme contains:
//   bpm    — tempo (beats per minute)
//   tracks — array of oscillator-track descriptors
//
// Each track:
//   wave   — oscillator type: 'sine' | 'square' | 'triangle' | 'sawtooth'
//   gain   — peak amplitude (0..1; keep ≤ 0.20 to avoid clipping with 3 tracks)
//   detune — optional pitch shift in cents (for shimmer/chorus effect)
//   seq    — array of [freq|null, durationInBeats] pairs
//            All tracks should total 16 beats so they loop in lock-step.
//
// Instrument choice rationale (90s chiptune conventions):
//   triangle  — flute / lead melody (soft, smooth)
//   square    — bass / driving rhythm (punchy)
//   sawtooth  — strings / eerie synth (bright, edgy)
//   sine      — pads / ambience (warm, gentle)

const THEMES = {

  // ── THE DESERT (world) ────────────────────────────────────
  // D pentatonic major — conjures sand dunes and distant pyramids.
  // Moderate 4/4 groove, triangle flute over a square bass.
  world: {
    bpm: 88,
    tracks: [
      { wave: 'triangle', gain: 0.20, seq: [         // Lead — flute
        [N.D4, 1], [N.Fs4, .5], [N.A4, .5], [N.D5, 2],
        [N.A4, .5], [N.G4, .5], [N.Fs4, 1], [N.D4, 2],
        [N.G4, .5], [N.A4, .5], [N.D5, 2],  [_,    1],
        [N.Fs4,.5], [N.D4, .5], [N.A3,  1], [_,    2],
      ]},                                             // 16 beats
      { wave: 'square', gain: 0.08, seq: [            // Bass — grounding pulse
        [N.D2, 2], [N.A2, 2],
        [N.G2, 2], [N.D2, 2],
        [N.D2, 2], [N.A2, 2],
        [N.G2, 2], [N.A2, 2],
      ]},                                             // 16 beats
      { wave: 'sine', gain: 0.11, seq: [              // Harmony — counter-melody
        [_,    2], [N.Fs4, 1], [N.A4, 1],
        [N.D4, 1], [N.Fs4, 1], [_,    2],
        [N.G4, 1], [N.A4,  1], [N.D5, 2],
        [_,    2], [N.A4,  1], [N.Fs4,1],
      ]},                                             // 16 beats
    ],
  },

  // ── THE OASIS (oasis) ─────────────────────────────────────
  // Same tonal centre as the desert but slower and airier;
  // the third track adds a shimmering water-ripple effect.
  oasis: {
    bpm: 76,
    tracks: [
      { wave: 'triangle', gain: 0.18, seq: [
        [N.D5, 1.5], [N.A4, .5], [N.Fs4, 1], [N.D4, 1],
        [N.G4, .5],  [N.A4, .5], [N.D5,  2], [_,    1],
        [N.Fs4,1],   [N.D4,  1], [N.A3,  2],
        [N.G4, 1],   [N.A4,  1], [N.D4,  2],
      ]},                                             // 16 beats
      { wave: 'square', gain: 0.07, seq: [
        [N.D2, 2], [N.A2, 2],
        [N.G2, 2], [N.D2, 2],
        [N.D2, 2], [N.A2, 2],
        [N.G2, 1], [N.A2, 1], [N.D2, 2],
      ]},                                             // 16 beats
      { wave: 'sine', gain: 0.09, seq: [              // Water shimmer
        [N.A4, 2], [N.Fs4, 2],
        [N.G4, 2], [N.A4,  2],
        [N.Fs4,2], [N.D4,  2],
        [_,    2], [N.A3,  2],
      ]},                                             // 16 beats
    ],
  },

  // ── BENEATH THE SPHINX (vault) ────────────────────────────
  // D natural minor — dark, subterranean, torch-lit mystery.
  // Slow tempo; sawtooth lead over a heavy square bass + sine drone.
  vault: {
    bpm: 62,
    tracks: [
      { wave: 'sawtooth', gain: 0.10, seq: [          // Lead — eerie
        [N.D4, 2], [_,    1], [N.F4,  1],
        [N.Eb4,1.5],[N.D4,.5],[_,     2],
        [N.C4, 2], [N.D4, 2],
        [_,    3], [N.A3, 1],
      ]},                                             // 16 beats
      { wave: 'square', gain: 0.10, seq: [            // Deep bass
        [N.D2, 4], [N.Bb1, 4],
        [N.F2, 4], [N.A2,  4],
      ]},                                             // 16 beats
      { wave: 'sine', gain: 0.08, seq: [              // Low drone
        [N.D3, 4], [N.C3, 4],
        [N.D3, 4], [N.A3, 4],
      ]},                                             // 16 beats
    ],
  },

  // ── THE CRYPT (chamber) ───────────────────────────────────
  // Alien techno: D diminished arpeggio at 138 bpm.
  // Square arpeggio + sawtooth bass = that raw 90s FM synth sound.
  chamber: {
    bpm: 138,
    tracks: [
      { wave: 'square', gain: 0.12, seq: [            // Techno arpeggio
        [N.D3,  .5], [N.F3,  .5], [N.Ab3, .5], [N.C4, .5],
        [N.D3,  .5], [N.F3,  .5], [N.Ab3, .5], [N.C4, .5],
        [N.Bb2, .5], [N.D3,  .5], [N.F3,  .5], [N.Ab3,.5],
        [N.Bb2, .5], [N.D3,  .5], [N.F3,  .5], [N.Ab3,.5],
        [N.G2,  .5], [N.Bb2, .5], [N.D3,  .5], [N.F3, .5],
        [N.G2,  .5], [N.Bb2, .5], [N.D3,  .5], [N.F3, .5],
        [N.A2,  .5], [N.C3,  .5], [N.Eb3, .5], [N.Ab3,.5],
        [N.A2,  .5], [N.C3,  .5], [N.Eb3, .5], [N.Ab3,.5],
      ]},                                             // 16 beats
      { wave: 'sawtooth', gain: 0.11, seq: [          // Driving bass
        [N.D2,  1], [N.D2, 1], [N.Bb1, 1], [N.F2,  1],
        [N.G2,  1], [N.G2, 1], [N.A2,  1], [N.D2,  1],
        [N.D2,  1], [N.D2, 1], [N.Bb1, 1], [N.F2,  1],
        [N.G2,  1], [N.A2, 1], [N.D2,  1], [_,     1],
      ]},                                             // 16 beats
      { wave: 'triangle', gain: 0.08, seq: [          // Eerie counter-melody
        [_,     1], [N.C4,  .5], [N.Eb4, .5], [N.D4, 2],
        [_,     1], [N.C4,  .5], [N.Bb4, .5], [N.Ab4,2],
        [_,     1], [N.Ab4, .5], [N.Bb4, .5], [N.C4, 2],
        [N.D4,  2], [_,     2],
      ]},                                             // 16 beats
    ],
  },

  // ── GALACTIC COUNCIL (council) ────────────────────────────
  // C major, cosmic and slow. Sine pads + detuned shimmer = 90s space RPG.
  council: {
    bpm: 70,
    tracks: [
      { wave: 'sine', gain: 0.16, seq: [              // Cosmic lead
        [N.C4, 2], [N.G4,  2],
        [N.E4, 1.5], [N.G4, .5], [N.B4, 2],
        [N.A4, 2], [N.E4,  2],
        [N.G4, 1.5], [N.E4, .5], [N.C4, 2],
      ]},                                             // 16 beats
      { wave: 'triangle', gain: 0.12, seq: [          // Bass foundation
        [N.C3, 4], [N.G2, 4],
        [N.A2, 4], [N.F2, 4],
      ]},                                             // 16 beats
      { wave: 'sine', gain: 0.08, detune: 12, seq: [ // Shimmer pad (detuned)
        [N.G4, 3], [N.E4, 1],
        [N.D4, 3], [N.C4, 1],
        [N.B3, 3], [N.G4, 1],
        [N.A4, 4],
      ]},                                             // 16 beats
    ],
  },
};

// Realm ID → theme name.
// Worlds sharing an aesthetic use the same theme (world/oasis both = Egyptian).
const REALM_THEME = {
  world:   'world',
  oasis:   'oasis',
  vault:   'vault',
  chamber: 'chamber',
  council: 'council',
};

// ── SoundManager singleton ────────────────────────────────

class SoundManagerClass {
  constructor() {
    this._ctx          = null;
    this._masterGain   = null;
    this._enabled      = true;
    this._volume       = 0.55;
    this._currentRealm = null;
    this._currentTheme = null;
    this._session      = 0;   // incremented on stop; stale loop callbacks check this
    this._oscillators  = [];

    // ── Restore preferences from localStorage ────────────
    try {
      const saved = JSON.parse(localStorage.getItem('ps_audio') || '{}');
      if (typeof saved.enabled === 'boolean') this._enabled = saved.enabled;
      if (typeof saved.volume  === 'number')  this._volume  = Math.max(0, Math.min(1, saved.volume));
    } catch { /* first launch or storage unavailable */ }
  }

  // ── Public API ──────────────────────────────────────────

  /**
   * Begin playing the theme associated with realmId.
   * No-op if that realm is already playing.
   */
  playRealm(realmId) {
    if (realmId === this._currentRealm) return;
    this._currentRealm = realmId;

    if (!this._enabled) return;

    const themeName = REALM_THEME[realmId];
    if (!themeName) return;

    this._ensureCtx();
    this._stop();

    if (this._ctx.state === 'suspended') {
      // Browser autoplay policy — will start after first user interaction
      // via resume().
      return;
    }

    this._startTheme(THEMES[themeName]);
  }

  /** Silence all audio and clear the current realm. */
  stop() {
    this._currentRealm = null;
    this._currentTheme = null;
    this._stop();
  }

  /**
   * Enable or disable music.
   * When re-enabling, immediately resumes the current realm's theme.
   * Persists to localStorage.
   */
  setEnabled(val) {
    this._enabled = Boolean(val);
    this._savePrefs();

    if (!this._ctx) return;

    if (!this._enabled) {
      this._masterGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.1);
      this._stop();
    } else {
      this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.15);
      if (this._currentRealm) {
        const theme = THEMES[REALM_THEME[this._currentRealm]];
        if (theme) this._startTheme(theme);
      }
    }
  }

  /**
   * Set master volume (0..1).
   * Persists to localStorage.
   */
  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    this._savePrefs();
    if (this._masterGain && this._enabled) {
      this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.08);
    }
  }

  /**
   * Resume the AudioContext after browser autoplay policy suspension.
   * Call this from any user-interaction handler (keydown, click, etc.)
   * once the player has interacted with the page.
   */
  resume() {
    if (!this._ctx || this._ctx.state !== 'suspended') return;
    this._ctx.resume().then(() => {
      if (this._enabled && this._currentRealm) {
        const theme = THEMES[REALM_THEME[this._currentRealm]];
        if (theme && !this._oscillators.length) {
          this._startTheme(theme);
        }
      }
    });
  }

  get enabled()      { return this._enabled; }
  get volume()       { return this._volume; }
  get currentRealm() { return this._currentRealm; }

  // ── Private helpers ──────────────────────────────────────

  _ensureCtx() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._enabled ? this._volume : 0;
    this._masterGain.connect(this._ctx.destination);
  }

  _stop() {
    this._session++;                      // invalidate pending loop callbacks
    for (const osc of this._oscillators) {
      try { osc.stop(0); } catch { /* already stopped — ignore */ }
    }
    this._oscillators = [];
  }

  /**
   * Schedule all tracks in a theme and queue a seamless loop.
   * @param {object} theme - A theme object from THEMES.
   * @param {number} [startT] - AudioContext time to begin. Defaults to now + 0.1 s.
   */
  _startTheme(theme, startT) {
    this._currentTheme = theme;
    const ctx      = this._ctx;
    const beatLen  = 60 / theme.bpm;
    const t0       = startT ?? (ctx.currentTime + 0.1);

    let totalBeats = 0;
    for (const track of theme.tracks) {
      const beats = this._scheduleTrack(track, beatLen, t0);
      if (beats > totalBeats) totalBeats = beats;
    }

    const seqDurSec  = totalBeats * beatLen;
    const nextStartT = t0 + seqDurSec;    // exact beat-accurate start for next loop
    const sessionId  = this._session;

    // Fire 350 ms before the sequence ends to pre-schedule the next pass.
    const loopDelay = Math.max(50, (seqDurSec - 0.35) * 1000);
    setTimeout(() => {
      if (this._session !== sessionId) return;  // stopped/switched — bail out
      this._oscillators = [];                   // old oscs have self-stopped; clear refs
      const safeStart = Math.max(nextStartT, ctx.currentTime + 0.05);
      this._startTheme(theme, safeStart);
    }, loopDelay);
  }

  /**
   * Schedule every note in a single track into the AudioContext timeline.
   * @returns {number} Total duration in beats.
   */
  _scheduleTrack(track, beatLen, startT) {
    const ctx = this._ctx;
    let t      = startT;
    let beats  = 0;

    for (const [freq, dur] of track.seq) {
      const durSec = dur * beatLen;

      if (freq !== null) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type            = track.wave;
        osc.frequency.value = freq;
        if (track.detune) osc.detune.value = track.detune;

        // ADSR-lite: fast attack, hold, quick release — prevents click artefacts.
        const attack  = Math.min(0.025, durSec * 0.08);
        const release = Math.min(0.07,  durSec * 0.18);
        env.gain.setValueAtTime(0,           t);
        env.gain.linearRampToValueAtTime(track.gain, t + attack);
        env.gain.setValueAtTime(track.gain,  t + durSec - release);
        env.gain.linearRampToValueAtTime(0,  t + durSec);

        osc.connect(env);
        env.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + durSec + 0.005);     // tiny buffer past envelope end
        this._oscillators.push(osc);
      }

      t     += durSec;
      beats += dur;
    }

    return beats;
  }

  _savePrefs() {
    try {
      localStorage.setItem('ps_audio', JSON.stringify({
        enabled: this._enabled,
        volume:  this._volume,
      }));
    } catch { /* storage blocked */ }
  }
}

export const SoundManager = new SoundManagerClass();
