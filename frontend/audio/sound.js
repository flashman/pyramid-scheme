// ── FILE: audio/sound.js ─────────────────────────────────
// Procedural chiptune / electronic soundtrack for PYRAMID SCHEME™.
// Uses the Web Audio API — zero audio files; all sound synthesised live.
//
// Public API:
//   SoundManager.playRealm(realmId)   — start the theme for a realm
//   SoundManager.stop()               — silence everything
//   SoundManager.setEnabled(bool)     — mute/unmute, persisted to localStorage
//   SoundManager.setVolume(0..1)      — master volume, persisted to localStorage
//   SoundManager.resume()             — unblock browser autoplay on first gesture
//   SoundManager.enabled              — current on/off state
//   SoundManager.volume               — current volume level

// ── Note frequency table (Hz) ─────────────────────────────
const N = {
  // Octave 1
  A1: 55.00, Bb1: 58.27,
  // Octave 2
  D2: 73.42, E2: 82.41, F2: 87.31, Fs2: 92.50, G2: 98.00,
  A2: 110.00, Bb2: 116.54, B2: 123.47,
  // Octave 3
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61,
  Fs3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
  // Octave 4
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  // Octave 5
  C5: 523.25, D5: 587.33, E5: 659.25,
};
const _ = null; // musical rest

// ── Theme definitions ─────────────────────────────────────
// bpm    — tempo
// tracks — oscillator layers: { wave, gain, detune?, seq: [[freq|null, beats], …] }
// All tracks must sum to exactly 16 beats so they loop in lock-step.
//
// Design: short notes (≤0.5 beats), fast tempos (108–145bpm), driving bass,
//         each realm has a distinct electronic character:
//   world   — Egyptian house: D Hijaz, sawtooth riff over square bass, 132bpm
//   oasis   — Desert groove: D minor pentatonic, funky + melodic, 114bpm
//   vault   — Dark industrial: D Phrygian, sparse menace + heavy bass, 108bpm
//   chamber — Alien techno: D diminished, 145bpm 16th-note arp assault
//   council — Space house: A minor, hypnotic hook + 4-on-the-floor bass, 128bpm

const THEMES = {

  // ── THE DESERT (world) ────────────────────────────────────
  // D Hijaz scale: D Eb F# G A Bb C — augmented 2nd Eb→F# is the Egyptian fingerprint.
  // 132bpm. Sawtooth lead rips through fast scalar runs. Square bass punches every beat.
  world: {
    bpm: 132,
    tracks: [
      // Lead — sawtooth: fast Egyptian riff with scalar runs
      { wave: 'sawtooth', gain: 0.14, seq: [
        [N.D4,.5],[N.Eb4,.25],[N.Fs4,.25],[N.G4,.5],[N.A4,.5],           // 2
        [N.Bb4,.5],[N.A4,.25],[N.G4,.25],[N.Fs4,.5],[N.Eb4,.5],          // 2
        [N.D4,.25],[N.Eb4,.25],[N.Fs4,.25],[N.G4,.25],[N.A4,.5],[N.G4,.5], // 2
        [N.Fs4,.25],[N.G4,.25],[N.A4,.25],[N.Bb4,.25],[N.A4,.25],[N.G4,.25],[N.Fs4,.25],[N.Eb4,.25], // 2
        [N.D5,.5],[_,.25],[N.C5,.25],[N.Bb4,.25],[N.A4,.25],[N.G4,.5],   // 2
        [N.Fs4,.25],[N.Eb4,.25],[N.D4,.5],[N.A4,.5],[N.G4,.5],           // 2
        [N.Fs4,.5],[N.G4,.5],[N.A4,.5],[N.Bb4,.5],                       // 2
        [N.A4,.5],[N.G4,.25],[N.Fs4,.25],[N.Eb4,.25],[N.D4,.75],         // 2
      ]},                                                                  // 16 beats
      // Bass — square: driving 8th-note pulse with movement
      { wave: 'square', gain: 0.10, seq: [
        [N.D2,.5],[N.D2,.5],[N.D2,.5],[N.A2,.5],
        [N.G2,.5],[N.G2,.5],[N.A2,.5],[N.G2,.5],
        [N.D2,.5],[N.D2,.5],[N.Bb2,.5],[N.A2,.5],
        [N.G2,.5],[N.A2,.5],[N.G2,.5],[N.D2,.5],
        [N.D2,.5],[N.D2,.5],[N.D2,.5],[N.A2,.5],
        [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.A2,.5],
        [N.D2,.5],[N.Fs2,.5],[N.G2,.5],[N.A2,.5],
        [N.D2,.5],[N.D2,.5],[N.D2,1],
      ]},                                                                  // 16 beats
      // Arpeggio — triangle: 16th-note arp riding the harmony
      { wave: 'triangle', gain: 0.08, seq: [
        [N.D4,.25],[N.Fs4,.25],[N.A4,.25],[N.D5,.25],
        [N.A4,.25],[N.Fs4,.25],[N.D4,.25],[N.A3,.25],
        [N.Eb4,.25],[N.G4,.25],[N.Bb4,.25],[N.Eb4,.25],
        [N.G4,.25],[N.Bb4,.25],[N.G4,.25],[N.Eb4,.25],
        [N.D4,.25],[N.Fs4,.25],[N.A4,.25],[N.D5,.25],
        [N.D5,.25],[N.A4,.25],[N.Fs4,.25],[N.D4,.25],
        [N.A3,.25],[N.D4,.25],[N.Fs4,.25],[N.A4,.25],
        [N.G3,.25],[N.Bb3,.25],[N.D4,.25],[N.G4,.25],
        [N.D4,.25],[N.Fs4,.25],[N.A4,.25],[N.D5,.25],
        [N.C5,.25],[N.A4,.25],[N.Fs4,.25],[N.Eb4,.25],
        [N.D4,.25],[_,.25],[N.D4,.25],[_,.25],
        [N.Fs4,.25],[N.A4,.25],[N.D5,.25],[_,.25],
        [N.G4,.25],[N.Bb4,.25],[N.D5,.25],[N.G4,.25],
        [N.Fs4,.25],[N.A4,.25],[N.D5,.25],[N.Fs4,.25],
        [N.Eb4,.25],[N.G4,.25],[N.Bb4,.25],[N.Eb4,.25],
        [N.D4,.25],[_,.25],[N.D4,.5],
      ]},                                                                  // 16 beats
    ],
  },

  // ── THE OASIS (oasis) ─────────────────────────────────────
  // D minor pentatonic: D F G A C — funky groove meets desert chill.
  // 114bpm. Triangle melody floats over syncopated square bass and shimmering sine arps.
  oasis: {
    bpm: 114,
    tracks: [
      // Lead — triangle: flowing melodic line with swing
      { wave: 'triangle', gain: 0.17, seq: [
        [N.D4,.5],[N.F4,.25],[N.G4,.25],[N.A4,.5],[N.C5,.5],
        [N.D5,.5],[N.C5,.25],[N.A4,.25],[N.G4,.5],[N.F4,.5],
        [N.D4,.5],[N.G4,.5],[N.A4,.5],[N.G4,.5],
        [N.F4,.25],[N.D4,.25],[N.F4,.25],[N.G4,.25],[N.A4,1],
        [N.A4,.5],[N.C5,.5],[N.D5,.5],[N.C5,.5],
        [N.A4,.5],[N.G4,.5],[N.F4,.5],[N.D4,.5],
        [N.G4,.5],[N.A4,.5],[N.C5,.25],[N.A4,.25],[N.G4,.5],
        [N.D4,2],
      ]},                                                                  // 16 beats
      // Bass — square: syncopated funk groove
      { wave: 'square', gain: 0.10, seq: [
        [N.D2,.5],[_,.25],[N.D2,.25],[N.G2,.5],[N.G2,.5],
        [N.A2,.5],[N.A2,.25],[N.G2,.25],[N.D2,.5],[N.D2,.5],
        [N.G2,.5],[_,.25],[N.G2,.25],[N.A2,.5],[N.G2,.5],
        [N.D2,.5],[N.F2,.5],[N.G2,.5],[N.D2,.5],
        [N.D2,.5],[_,.25],[N.D2,.25],[N.G2,.5],[N.A2,.5],
        [N.C3,.5],[N.A2,.5],[N.G2,.5],[N.D2,.5],
        [N.D2,.5],[N.F2,.5],[N.D2,.5],[N.G2,.5],
        [N.A2,.5],[N.G2,.5],[N.D2,1],
      ]},                                                                  // 16 beats
      // Arp — sine: shimmering 8th-note harmonic bed
      { wave: 'sine', gain: 0.08, seq: [
        [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.D5,.5],
        [N.D5,.5],[N.A4,.5],[N.F4,.5],[N.D4,.5],
        [N.G3,.5],[N.D4,.5],[N.G4,.5],[N.D4,.5],
        [N.A3,.5],[N.D4,.5],[N.A4,.5],[N.D4,.5],
        [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.C5,.5],
        [N.A4,.5],[N.G4,.5],[N.F4,.5],[N.D4,.5],
        [N.D4,.5],[N.G4,.5],[N.C5,.5],[N.A4,.5],
        [N.D4,.5],[N.A4,.5],[N.D4,1],
      ]},                                                                  // 16 beats
    ],
  },

  // ── BENEATH THE SPHINX (vault) ────────────────────────────
  // D Phrygian: D Eb F G A Bb C — flat-2 (Eb) creates dark tension.
  // 108bpm. Sparse menacing sawtooth lead over brutal square bass and unsettling arps.
  vault: {
    bpm: 108,
    tracks: [
      // Lead — sawtooth: minimal, dark, every note matters
      { wave: 'sawtooth', gain: 0.13, seq: [
        [_,.5],[N.D4,.5],[N.Eb4,.5],[N.D4,.5],
        [N.F4,.5],[_,.5],[N.Eb4,.5],[N.D4,.5],
        [N.G4,.5],[N.Ab4,.5],[N.G4,.5],[_,.5],
        [N.F4,.25],[N.Eb4,.25],[N.D4,.5],[_,1],
        [_,.25],[N.D4,.25],[_,.25],[N.D4,.25],[N.Eb4,.5],[N.F4,.5],
        [N.G4,.5],[N.F4,.25],[N.Eb4,.25],[N.D4,.5],[_,.5],
        [N.Bb4,.5],[N.Ab4,.5],[N.G4,.25],[N.F4,.25],[N.Eb4,.5],
        [N.D4,1.5],[_,.5],
      ]},                                                                  // 16 beats
      // Bass — square: heavy, industrial, mid-octave for extra presence
      { wave: 'square', gain: 0.14, seq: [
        [N.D2,.5],[N.D2,.5],[_,.5],[N.D2,.5],
        [N.D2,.25],[N.D2,.25],[N.D2,.25],[N.D2,.25],[N.F2,.5],[N.G2,.5],
        [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.F2,.5],
        [N.D2,1],[_,.5],[N.D2,.5],
        [N.D2,.5],[_,.25],[N.D2,.25],[_,.5],[N.D2,.5],
        [N.Eb3,.5],[N.D3,.5],[N.Eb3,.5],[N.D3,.5],
        [N.F3,.5],[N.G3,.5],[N.F3,.5],[N.Eb3,.5],
        [N.D3,.5],[N.D3,.5],[N.D2,1],
      ]},                                                                  // 16 beats
      // Pulse — triangle: constant 8th-note arp in the low register, detuned slightly
      { wave: 'triangle', gain: 0.07, detune: -8, seq: [
        [N.D3,.25],[N.F3,.25],[N.A3,.25],[N.D4,.25],
        [N.D4,.25],[N.A3,.25],[N.F3,.25],[N.D3,.25],
        [N.D3,.25],[N.G3,.25],[N.Bb3,.25],[N.D4,.25],
        [N.D4,.25],[N.Bb3,.25],[N.G3,.25],[N.D3,.25],
        [N.D3,.25],[N.F3,.25],[N.A3,.25],[N.D4,.25],
        [N.Eb3,.25],[N.G3,.25],[N.Bb3,.25],[N.Eb4,.25],
        [N.F3,.25],[N.A3,.25],[N.C4,.25],[N.F4,.25],
        [N.G3,.25],[N.Bb3,.25],[N.D4,.25],[N.G4,.25],
        [N.D3,.25],[N.F3,.25],[N.A3,.25],[N.D4,.25],
        [N.D4,.25],[N.A3,.25],[N.F3,.25],[N.D3,.25],
        [N.Eb3,.25],[N.G3,.25],[N.Bb3,.25],[N.Eb4,.25],
        [N.Eb4,.25],[N.Bb3,.25],[N.G3,.25],[N.Eb3,.25],
        [N.D3,.25],[N.F3,.25],[N.A3,.25],[N.D4,.25],
        [N.Ab3,.25],[N.D4,.25],[N.Ab3,.25],[N.F3,.25],
        [N.D3,.5],[N.D3,.5],[_,.5],[N.D3,.25],[_,.25],
      ]},                                                                  // 16 beats (last line: .5+.5+.5+.25+.25=2✓, track: 15 full rows + partial = 16✓)
    ],
  },

  // ── THE CRYPT (chamber) ───────────────────────────────────
  // D diminished: D F Ab B (repeats at tritone — every note is 3 semitones apart).
  // 145bpm — the fastest theme. 16th-note square arp is relentless alien techno.
  // Sawtooth bass slams. Triangle fires syncopated stabs.
  chamber: {
    bpm: 145,
    tracks: [
      // Arp — square: unrelenting 16th-note diminished arpeggio
      { wave: 'square', gain: 0.13, seq: [
        [N.D3,.25],[N.F3,.25],[N.Ab3,.25],[N.B3,.25],
        [N.D4,.25],[N.B3,.25],[N.Ab3,.25],[N.F3,.25],
        [N.F3,.25],[N.Ab3,.25],[N.B3,.25],[N.D4,.25],
        [N.B3,.25],[N.Ab3,.25],[N.F3,.25],[N.D3,.25],
        [N.Eb3,.25],[N.G3,.25],[N.Bb3,.25],[N.D4,.25],
        [N.D4,.25],[N.Bb3,.25],[N.G3,.25],[N.Eb3,.25],
        [N.D3,.25],[N.F3,.25],[N.Ab3,.25],[N.B3,.25],
        [N.D4,.25],[N.B3,.25],[N.D4,.25],[N.B3,.25],
        [N.D4,.25],[N.D4,.25],[_,.25],[N.D4,.25],[N.D4,.25],[_,.25],[N.D4,.25],[N.D4,.25],
        [N.Ab3,.25],[N.F3,.25],[N.D3,.25],[N.Ab3,.25],[N.B3,.25],[N.D4,.25],[N.F4,.25],[N.D4,.25],
        [N.D4,.25],[N.F4,.25],[N.Ab4,.25],[N.B4,.25],
        [N.D5,.25],[N.B4,.25],[N.Ab4,.25],[N.F4,.25],
        [N.D4,.25],[N.B3,.25],[N.Ab3,.25],[N.F3,.25],
        [N.D3,.5],[_,.25],[N.D3,.25],
      ]},                                                                  // 16 beats
      // Bass — sawtooth: brutal, syncopated, low-end assault
      { wave: 'sawtooth', gain: 0.12, seq: [
        [N.D2,1],[N.D2,.5],[_,.5],
        [N.F2,1],[N.F2,.5],[N.D2,.5],
        [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.F2,.5],
        [N.D2,.5],[_,.25],[N.D2,.25],[N.D2,.5],[_,.5],
        [N.D2,.25],[N.D2,.25],[N.D2,.25],[N.D2,.25],[N.D2,.25],[_,.75],
        [N.F2,.5],[N.A2,.5],[N.Bb2,.5],[N.A2,.5],
        [N.G2,.5],[N.F2,.5],[N.D2,.5],[_,.5],
        [N.D2,1],[N.D2,1],
      ]},                                                                  // 16 beats
      // Stabs — triangle: off-beat syncopated accents for that techno snap
      { wave: 'triangle', gain: 0.09, seq: [
        [_,.5],[N.D4,.5],[_,.5],[N.Ab4,.5],
        [_,.5],[N.F4,.5],[_,.5],[N.D4,.5],
        [N.D5,.25],[_,.75],[N.B4,.25],[_,.75],
        [N.Ab4,.25],[N.F4,.25],[N.D4,.25],[_,1.25],
        [_,.5],[N.D4,.5],[_,.25],[N.F4,.25],[_,.5],
        [N.Ab4,.5],[_,.5],[N.B4,.5],[_,.5],
        [N.D5,.25],[N.B4,.25],[N.Ab4,.25],[N.F4,.25],[N.D4,.5],[_,.5],
        [N.D4,.25],[_,.25],[N.D4,.5],[_,1],
      ]},                                                                  // 16 beats
    ],
  },

  // ── GALACTIC COUNCIL (council) ────────────────────────────
  // A natural minor: A B C D E F G — classic prog/sci-fi minor mode.
  // 128bpm. Sine lead has a memorable hook (like Daft Punk meets Final Fantasy battle theme).
  // Square bass drives a steady 4/4 pulse. Detuned sawtooth pad adds electronic texture.
  council: {
    bpm: 128,
    tracks: [
      // Lead — sine: strong hook with call-and-response phrasing
      { wave: 'sine', gain: 0.16, seq: [
        [N.A4,.5],[_,.25],[N.A4,.25],[N.E4,.5],[N.A4,.5],
        [N.C5,.5],[N.B4,.5],[N.A4,.5],[_,.5],
        [N.G4,.5],[N.A4,.5],[N.B4,.5],[N.C5,.5],
        [N.D5,.5],[N.C5,.25],[N.B4,.25],[N.A4,.5],[N.E4,.5],
        [N.A4,.25],[N.A4,.25],[_,.25],[N.A4,.25],[N.A4,.25],[N.A4,.25],[_,.5],
        [N.D5,.5],[N.C5,.25],[N.B4,.25],[N.A4,.5],[N.G4,.5],
        [N.F4,.5],[N.G4,.5],[N.A4,.5],[N.B4,.5],
        [N.A4,1],[_,.5],[N.A4,.5],
      ]},                                                                  // 16 beats
      // Bass — square: pumping 4-on-the-floor with walking movement
      { wave: 'square', gain: 0.11, seq: [
        [N.A2,.5],[N.A2,.5],[N.A2,.5],[N.A2,.5],
        [N.G2,.5],[N.G2,.5],[N.A2,.5],[N.A2,.5],
        [N.A2,.5],[N.A2,.5],[N.D2,.5],[N.D2,.5],
        [N.E2,.5],[N.E2,.5],[N.A2,.5],[N.A2,.5],
        [N.A2,.5],[N.A2,.5],[N.A2,.5],[N.A2,.5],
        [N.F2,.5],[N.G2,.5],[N.F2,.5],[N.G2,.5],
        [N.A2,.5],[N.B2,.5],[N.A2,.5],[N.G2,.5],
        [N.A2,.5],[N.A2,.5],[N.A2,1],
      ]},                                                                  // 16 beats
      // Pad — sawtooth, detuned: electronic texture, space-synth shimmer
      { wave: 'sawtooth', gain: 0.07, detune: 7, seq: [
        [N.A4,.5],[N.C5,.5],[N.E4,.5],[N.A4,.5],
        [N.A4,.25],[_,.25],[N.A4,.25],[_,.25],[N.C5,.25],[_,.25],[N.A4,.25],[_,.25],
        [N.G4,.5],[N.B4,.5],[N.D5,.5],[N.B4,.5],
        [N.A4,.5],[N.G4,.5],[N.E4,.5],[N.A4,.5],
        [N.A4,.5],[N.C5,.5],[N.A4,.5],[N.E4,.5],
        [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.D5,.5],
        [N.C5,.5],[N.A4,.5],[N.G4,.5],[N.E4,.5],
        [N.A4,.5],[N.A4,.5],[N.A4,1],
      ]},                                                                  // 16 beats
    ],
  },
};

// Realm ID → theme name.
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
    this._session      = 0;
    this._oscillators  = [];

    // Restore preferences
    try {
      const saved = JSON.parse(localStorage.getItem('ps_audio') || '{}');
      if (typeof saved.enabled === 'boolean') this._enabled = saved.enabled;
      if (typeof saved.volume  === 'number')  this._volume  = Math.max(0, Math.min(1, saved.volume));
    } catch { /* first launch or storage unavailable */ }
  }

  // ── Public API ──────────────────────────────────────────

  playRealm(realmId) {
    if (realmId === this._currentRealm) return;
    this._currentRealm = realmId;
    if (!this._enabled) return;
    const themeName = REALM_THEME[realmId];
    if (!themeName) return;
    this._ensureCtx();
    this._stop();
    if (this._ctx.state === 'suspended') return; // will start on resume()
    this._startTheme(THEMES[themeName]);
  }

  stop() {
    this._currentRealm = null;
    this._currentTheme = null;
    this._stop();
  }

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

  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    this._savePrefs();
    if (this._masterGain && this._enabled) {
      this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.08);
    }
  }

  resume() {
    if (!this._ctx || this._ctx.state !== 'suspended') return;
    this._ctx.resume().then(() => {
      if (this._enabled && this._currentRealm) {
        const theme = THEMES[REALM_THEME[this._currentRealm]];
        if (theme && !this._oscillators.length) this._startTheme(theme);
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
    this._session++;
    for (const osc of this._oscillators) {
      try { osc.stop(0); } catch { /* already stopped */ }
    }
    this._oscillators = [];
  }

  _startTheme(theme, startT) {
    this._currentTheme = theme;
    const ctx     = this._ctx;
    const beatLen = 60 / theme.bpm;
    const t0      = startT ?? (ctx.currentTime + 0.1);

    let totalBeats = 0;
    for (const track of theme.tracks) {
      const beats = this._scheduleTrack(track, beatLen, t0);
      if (beats > totalBeats) totalBeats = beats;
    }

    const seqDurSec  = totalBeats * beatLen;
    const nextStartT = t0 + seqDurSec;
    const sessionId  = this._session;

    // Pre-schedule next loop 350ms before the current one ends to avoid gaps.
    const loopDelay = Math.max(50, (seqDurSec - 0.35) * 1000);
    setTimeout(() => {
      if (this._session !== sessionId) return;
      this._oscillators = [];
      this._startTheme(theme, Math.max(nextStartT, ctx.currentTime + 0.05));
    }, loopDelay);
  }

  _scheduleTrack(track, beatLen, startT) {
    const ctx = this._ctx;
    let t = startT, beats = 0;

    for (const [freq, dur] of track.seq) {
      const durSec = dur * beatLen;
      if (freq !== null) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type            = track.wave;
        osc.frequency.value = freq;
        if (track.detune) osc.detune.value = track.detune;

        // ADSR-lite: fast attack, sustain, quick release — no clicks at note ends
        const attack  = Math.min(0.020, durSec * 0.06);
        const release = Math.min(0.060, durSec * 0.15);
        env.gain.setValueAtTime(0,           t);
        env.gain.linearRampToValueAtTime(track.gain, t + attack);
        env.gain.setValueAtTime(track.gain,  t + durSec - release);
        env.gain.linearRampToValueAtTime(0,  t + durSec);

        osc.connect(env);
        env.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + durSec + 0.005);
        this._oscillators.push(osc);
      }
      t     += durSec;
      beats += dur;
    }
    return beats;
  }

  _savePrefs() {
    try {
      localStorage.setItem('ps_audio', JSON.stringify({ enabled: this._enabled, volume: this._volume }));
    } catch { /* storage blocked */ }
  }
}

export const SoundManager = new SoundManagerClass();
