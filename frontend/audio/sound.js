// ── FILE: audio/sound.js ─────────────────────────────────
// Procedural chiptune / electronic soundtrack for PYRAMID SCHEME™.
// Uses the Web Audio API — zero audio files; all sound synthesised live.
//
// v2 improvements inspired by Mario-era soundtrack design:
//   • 32-beat melodies (A+B sections) with dramatic octave climbs in B
//   • Compressor at output for instant polish
//   • Per-track BiquadFilter (warm bass, clear leads)
//   • Convolver reverb send for spatial depth
//   • Vibrato LFO on melodic leads
//   • StereoPanner for width
//
// Public API (unchanged):
//   SoundManager.playRealm(realmId)
//   SoundManager.stop()
//   SoundManager.setEnabled(bool)
//   SoundManager.setVolume(0..1)
//   SoundManager.resume()
//   SoundManager.enabled / .volume

// ── Note frequency table (Hz) ─────────────────────────────
const N = {
  // Octave 2
  D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, Fs2: 92.50, G2: 98.00,
  Ab2: 103.83, A2: 110.00, Bb2: 116.54, B2: 123.47,
  // Octave 3
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61,
  Fs3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
  // Octave 4
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  // Octave 5
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46,
  Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
};
const _ = null; // rest

// ── Theme definitions ─────────────────────────────────────
// bpm     — tempo
// tracks  — oscillator layers:
//   { wave, gain, pan?, filter?, vibrato?, detune?, seq: [[freq|null, beats], …] }
//   pan:     -1..1 stereo position
//   filter:  { type: 'lowpass'|'highpass'|'bandpass', freq }
//   vibrato: { rate (Hz), depth (Hz cents) }  — applied to melodic leads
//
// All tracks sum to 32 beats (A+B sections). B section pushes melody into
// the next octave — the Mario trick for dramatic energy lifts.

const THEMES = {

  // ── THE DESERT (world) ────────────────────────────────────
  // D Hijaz: D Eb F# G A Bb C — the augmented 2nd is the Egyptian fingerprint.
  // 132 bpm. A section: driving 4th-octave riff. B section: same motif an
  // octave higher with wider leaps — sun-bleached and heroic.
  world: {
    bpm: 132,
    tracks: [
      // Lead — sawtooth with vibrato: Egyptian riff, A oct4 → B oct5
      { wave: 'sawtooth', gain: 0.12, pan: -0.15,
        filter: { type: 'lowpass', freq: 4200 },
        vibrato: { rate: 5.5, depth: 12 },
        seq: [
          // ── A section (16 beats, octave 4) ──────────────────
          [N.D4,.5],[N.Eb4,.25],[N.Fs4,.25],[N.G4,.5],[N.A4,.5],            // 2
          [N.Bb4,.5],[N.A4,.25],[N.G4,.25],[N.Fs4,.5],[N.Eb4,.5],           // 2
          [N.D4,.25],[N.Eb4,.25],[N.Fs4,.25],[N.G4,.25],[N.A4,.5],[N.G4,.5],// 2
          [N.Fs4,.25],[N.G4,.25],[N.A4,.25],[N.Bb4,.25],[N.A4,.25],[N.G4,.25],[N.Fs4,.25],[N.Eb4,.25], // 2
          [N.D5,.5],[_,.25],[N.C5,.25],[N.Bb4,.5],[N.A4,.5],                // 2
          [N.G4,.25],[N.Fs4,.25],[N.Eb4,.25],[N.D4,.25],[N.A4,.5],[N.G4,.5],// 2
          [N.Fs4,.5],[N.G4,.5],[N.A4,.5],[N.Bb4,.5],                        // 2
          [N.A4,.5],[N.G4,.25],[N.Fs4,.25],[N.Eb4,.25],[N.D4,.75],          // 2
          // ── B section (16 beats, leaps to octave 5) ─────────
          [N.D5,.25],[N.Eb5,.25],[N.Fs5,.25],[N.G5,.25],[N.A5,.5],[_,.5],   // 2
          [N.G5,.25],[N.Fs5,.25],[N.Eb5,.25],[N.D5,.25],[N.A4,.5],[N.D5,.5],// 2
          [N.Eb5,.5],[N.Fs5,.5],[N.G5,.5],[N.Fs5,.5],                       // 2
          [N.Eb5,.5],[N.D5,.25],[N.C5,.25],[N.Bb4,.5],[N.A4,.5],            // 2
          [N.D5,.5],[N.Eb5,.25],[N.Fs5,.25],[N.G5,.5],[N.A5,.5],            // 2
          [N.Bb5,.5],[_,.25],[N.A5,.25],[N.G5,.5],[N.Fs5,.5],               // 2
          [N.Eb5,.5],[N.D5,.5],[N.A4,.5],[N.G4,.5],                         // 2
          [N.Fs4,.5],[N.Eb4,.25],[N.D4,.25],[N.D4,1],                       // 2
        ]},                                                                    // 32 beats
      // Bass — square: driving pulse, doubled to 32 beats
      { wave: 'square', gain: 0.09, pan: 0.0,
        filter: { type: 'lowpass', freq: 480 },
        seq: [
          [N.D2,.5],[N.D2,.5],[N.D2,.5],[N.A2,.5],
          [N.G2,.5],[N.G2,.5],[N.A2,.5],[N.G2,.5],
          [N.D2,.5],[N.D2,.5],[N.Bb2,.5],[N.A2,.5],
          [N.G2,.5],[N.A2,.5],[N.G2,.5],[N.D2,.5],
          [N.D2,.5],[N.D2,.5],[N.D2,.5],[N.A2,.5],
          [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.A2,.5],
          [N.D2,.5],[N.Fs2,.5],[N.G2,.5],[N.A2,.5],
          [N.D2,.5],[N.D2,.5],[N.D2,1],
          // bar 2 (slight variation)
          [N.D2,.5],[N.D2,.5],[N.A2,.5],[N.Bb2,.5],
          [N.G2,.5],[N.A2,.5],[N.D2,.5],[N.D2,.5],
          [N.D2,.5],[N.D2,.5],[N.G2,.5],[N.A2,.5],
          [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.D2,.5],
          [N.D2,.5],[N.G2,.5],[N.A2,.5],[N.D2,.5],
          [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.A2,.5],
          [N.D2,.5],[N.Fs2,.5],[N.G2,.5],[N.A2,.5],
          [N.D2,.5],[N.D2,.5],[N.D2,1],
        ]},                                                                    // 32 beats
      // Arpeggio — triangle: 16th-note harmonic shimmer, doubled
      { wave: 'triangle', gain: 0.07, pan: 0.3,
        filter: { type: 'highpass', freq: 280 },
        seq: [
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
          // B section arp climbs higher
          [N.D5,.25],[N.Fs5,.25],[N.A5,.25],[N.D5,.25],
          [N.A4,.25],[N.Fs4,.25],[N.D4,.25],[N.A3,.25],
          [N.Eb5,.25],[N.G5,.25],[N.Bb5,.25],[N.Eb5,.25],
          [N.G4,.25],[N.Bb4,.25],[N.G4,.25],[N.Eb4,.25],
          [N.D5,.25],[N.Fs5,.25],[N.A5,.25],[N.D5,.25],
          [N.D5,.25],[N.A4,.25],[N.Fs4,.25],[N.D4,.25],
          [N.A4,.25],[N.D5,.25],[N.Fs5,.25],[N.A5,.25],
          [N.G4,.25],[N.Bb4,.25],[N.D5,.25],[N.G5,.25],
          [N.D5,.25],[N.Fs5,.25],[N.A5,.25],[N.D5,.25],
          [N.C5,.25],[N.A4,.25],[N.Fs4,.25],[N.Eb4,.25],
          [N.D4,.25],[_,.25],[N.D4,.25],[_,.25],
          [N.Fs4,.25],[N.A4,.25],[N.D5,.25],[_,.25],
          [N.G4,.25],[N.Bb4,.25],[N.D5,.25],[N.G4,.25],
          [N.Fs4,.25],[N.A4,.25],[N.D5,.25],[N.Fs4,.25],
          [N.Eb4,.25],[N.G4,.25],[N.Bb4,.25],[N.Eb4,.25],
          [N.D4,.25],[_,.25],[N.D4,.5],
        ]},                                                                    // 32 beats
    ],
  },

  // ── THE OASIS (oasis) ─────────────────────────────────────
  // D minor pentatonic: D F G A C.
  // 114 bpm. A section: warm flowing melody in oct 4. B section: melody
  // floats up to A5/D5 with a dreamy, open quality then settles back.
  oasis: {
    bpm: 114,
    tracks: [
      // Lead — triangle, vibrato: flowing line
      { wave: 'triangle', gain: 0.15, pan: -0.2,
        filter: { type: 'lowpass', freq: 5000 },
        vibrato: { rate: 4.8, depth: 9 },
        seq: [
          // ── A section ───────────────────────────────────────
          [N.D4,.5],[N.F4,.25],[N.G4,.25],[N.A4,.5],[N.C5,.5],
          [N.D5,.5],[N.C5,.25],[N.A4,.25],[N.G4,.5],[N.F4,.5],
          [N.D4,.5],[N.G4,.5],[N.A4,.5],[N.G4,.5],
          [N.F4,.25],[N.D4,.25],[N.F4,.25],[N.G4,.25],[N.A4,1],
          [N.A4,.5],[N.C5,.5],[N.D5,.5],[N.C5,.5],
          [N.A4,.5],[N.G4,.5],[N.F4,.5],[N.D4,.5],
          [N.G4,.5],[N.A4,.5],[N.C5,.25],[N.A4,.25],[N.G4,.5],
          [N.D4,2],
          // ── B section (rises to oct 5) ──────────────────────
          [N.D5,.5],[N.F5,.25],[N.G5,.25],[N.A5,.5],[_,.5],
          [N.A5,.5],[N.G5,.25],[N.F5,.25],[N.D5,.5],[N.C5,.5],
          [N.D5,.5],[N.A4,.5],[N.D5,.5],[N.F5,.5],
          [N.G5,.5],[N.F5,.25],[N.D5,.25],[N.C5,.5],[N.A4,.5],
          [N.A4,.5],[N.C5,.5],[N.D5,.25],[N.F5,.25],[N.G5,.5],
          [N.A5,.5],[N.G5,.25],[N.F5,.25],[N.D5,.5],[N.C5,.5],
          [N.A4,.5],[N.G4,.5],[N.F4,.25],[N.G4,.25],[N.A4,.5],
          [N.D4,2],
        ]},                                                                    // 32 beats
      // Bass — square: syncopated funk, doubled
      { wave: 'square', gain: 0.09, pan: 0.0,
        filter: { type: 'lowpass', freq: 420 },
        seq: [
          [N.D2,.5],[_,.25],[N.D2,.25],[N.G2,.5],[N.G2,.5],
          [N.A2,.5],[N.A2,.25],[N.G2,.25],[N.D2,.5],[N.D2,.5],
          [N.G2,.5],[_,.25],[N.G2,.25],[N.A2,.5],[N.G2,.5],
          [N.D2,.5],[N.F2,.5],[N.G2,.5],[N.D2,.5],
          [N.D2,.5],[_,.25],[N.D2,.25],[N.G2,.5],[N.A2,.5],
          [N.C3,.5],[N.A2,.5],[N.G2,.5],[N.D2,.5],
          [N.D2,.5],[N.F2,.5],[N.D2,.5],[N.G2,.5],
          [N.A2,.5],[N.G2,.5],[N.D2,1],
          // bar 2 variant
          [N.D2,.5],[_,.25],[N.D2,.25],[N.A2,.5],[N.G2,.5],
          [N.G2,.5],[N.A2,.25],[N.G2,.25],[N.D2,.5],[N.D2,.5],
          [N.G2,.5],[_,.25],[N.G2,.25],[N.A2,.5],[N.C3,.5],
          [N.D3,.5],[N.C3,.5],[N.A2,.5],[N.D2,.5],
          [N.D2,.5],[_,.25],[N.D2,.25],[N.G2,.5],[N.A2,.5],
          [N.C3,.5],[N.A2,.5],[N.G2,.5],[N.D2,.5],
          [N.D2,.5],[N.F2,.5],[N.G2,.5],[N.A2,.5],
          [N.D2,.5],[N.D2,.5],[N.D2,1],
        ]},                                                                    // 32 beats
      // Arp — sine: shimmering harmonic bed, doubled
      { wave: 'sine', gain: 0.07, pan: 0.35,
        filter: { type: 'highpass', freq: 300 },
        seq: [
          [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.D5,.5],
          [N.D5,.5],[N.A4,.5],[N.F4,.5],[N.D4,.5],
          [N.G3,.5],[N.D4,.5],[N.G4,.5],[N.D4,.5],
          [N.A3,.5],[N.D4,.5],[N.A4,.5],[N.D4,.5],
          [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.C5,.5],
          [N.A4,.5],[N.G4,.5],[N.F4,.5],[N.D4,.5],
          [N.D4,.5],[N.G4,.5],[N.C5,.5],[N.A4,.5],
          [N.D4,.5],[N.A4,.5],[N.D4,1],
          // bar 2 (goes higher)
          [N.D5,.5],[N.F5,.5],[N.A5,.5],[N.D5,.5],
          [N.D5,.5],[N.A4,.5],[N.F4,.5],[N.D4,.5],
          [N.G4,.5],[N.D5,.5],[N.G5,.5],[N.D5,.5],
          [N.A4,.5],[N.D5,.5],[N.A5,.5],[N.D5,.5],
          [N.D5,.5],[N.F5,.5],[N.A5,.5],[N.C5,.5],
          [N.A4,.5],[N.G4,.5],[N.F4,.5],[N.D4,.5],
          [N.D4,.5],[N.G4,.5],[N.C5,.5],[N.A4,.5],
          [N.D4,.5],[N.A4,.5],[N.D4,1],
        ]},                                                                    // 32 beats
    ],
  },

  // ── BENEATH THE SPHINX (vault) ────────────────────────────
  // D Phrygian: D Eb F G A Bb C — flat-2 tension.
  // 108 bpm. A: sparse menace in low register. B: creeping climb through
  // Eb5/D5 with ominous wide leaps — like descending deeper underground.
  vault: {
    bpm: 108,
    tracks: [
      // Lead — sawtooth, dark and sparse
      { wave: 'sawtooth', gain: 0.11, pan: -0.1,
        filter: { type: 'lowpass', freq: 3600 },
        vibrato: { rate: 4.2, depth: 7 },
        seq: [
          // ── A section ───────────────────────────────────────
          [_,.5],[N.D4,.5],[N.Eb4,.5],[N.D4,.5],
          [N.F4,.5],[_,.5],[N.Eb4,.5],[N.D4,.5],
          [N.G4,.5],[N.Ab4,.5],[N.G4,.5],[_,.5],
          [N.F4,.25],[N.Eb4,.25],[N.D4,.5],[_,1],
          [_,.25],[N.D4,.25],[_,.25],[N.D4,.25],[N.Eb4,.5],[N.F4,.5],
          [N.G4,.5],[N.F4,.25],[N.Eb4,.25],[N.D4,.5],[_,.5],
          [N.Bb4,.5],[N.Ab4,.5],[N.G4,.25],[N.F4,.25],[N.Eb4,.5],
          [N.D4,1.5],[_,.5],
          // ── B section (climbs into oct 5) ───────────────────
          [_,.5],[N.D5,.5],[N.Eb5,.5],[N.D5,.5],
          [N.F5,.5],[_,.25],[N.Eb5,.25],[N.D5,.5],[N.C5,.5],
          [N.Bb4,.5],[N.Ab4,.5],[N.G4,.5],[N.F4,.5],
          [N.Eb4,.25],[N.D4,.25],[N.Eb5,.5],[_,1],
          [N.D5,.5],[N.Eb5,.5],[N.F5,.25],[N.G5,.25],[N.F5,.5],
          [N.Eb5,.5],[N.D5,.25],[N.C5,.25],[N.Bb4,.5],[N.Ab4,.5],
          [N.G4,.5],[N.F4,.5],[N.Eb4,.5],[N.D4,.5],
          [N.D4,1],[_,.5],[N.D4,.5],
        ]},                                                                    // 32 beats
      // Bass — square: heavy industrial, doubled
      { wave: 'square', gain: 0.13, pan: 0.0,
        filter: { type: 'lowpass', freq: 360 },
        seq: [
          [N.D2,.5],[N.D2,.5],[_,.5],[N.D2,.5],
          [N.D2,.25],[N.D2,.25],[N.D2,.25],[N.D2,.25],[N.F2,.5],[N.G2,.5],
          [N.Bb2,.5],[N.A2,.5],[N.G2,.5],[N.F2,.5],
          [N.D2,1],[_,.5],[N.D2,.5],
          [N.D2,.5],[_,.25],[N.D2,.25],[_,.5],[N.D2,.5],
          [N.Eb3,.5],[N.D3,.5],[N.Eb3,.5],[N.D3,.5],
          [N.F3,.5],[N.G3,.5],[N.F3,.5],[N.Eb3,.5],
          [N.D3,.5],[N.D3,.5],[N.D2,1],
          // bar 2 (more movement)
          [N.D2,.5],[N.D2,.5],[N.Eb2,.5],[N.D2,.5],
          [N.F2,.25],[N.F2,.25],[N.G2,.25],[N.G2,.25],[N.F2,.5],[N.Eb2,.5],
          [N.D2,.5],[_,.5],[N.Bb2,.5],[N.A2,.5],
          [N.G2,1],[_,.5],[N.D2,.5],
          [N.D2,.5],[_,.25],[N.Eb2,.25],[N.D2,.5],[N.D2,.5],
          [N.Eb3,.5],[N.D3,.5],[N.C3,.5],[N.Bb2,.5],
          [N.F2,.5],[N.G2,.5],[N.F2,.5],[N.Eb2,.5],
          [N.D2,.5],[N.D2,.5],[N.D2,1],
        ]},                                                                    // 32 beats
      // Pulse — triangle: constant arp, detuned for unease
      { wave: 'triangle', gain: 0.06, detune: -10, pan: 0.3,
        filter: { type: 'bandpass', freq: 600 },
        seq: [
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
          [N.D3,.25],[_,.25],[N.F3,.25],[N.A3,.25],
          // bar 2 arp (higher register)
          [N.D4,.25],[N.F4,.25],[N.A4,.25],[N.D5,.25],
          [N.D5,.25],[N.A4,.25],[N.F4,.25],[N.D4,.25],
          [N.D4,.25],[N.G4,.25],[N.Bb4,.25],[N.D5,.25],
          [N.D5,.25],[N.Bb4,.25],[N.G4,.25],[N.D4,.25],
          [N.D4,.25],[N.F4,.25],[N.A4,.25],[N.D5,.25],
          [N.Eb4,.25],[N.G4,.25],[N.Bb4,.25],[N.Eb5,.25],
          [N.F4,.25],[N.A4,.25],[N.C5,.25],[N.F5,.25],
          [N.G4,.25],[N.Bb4,.25],[N.D5,.25],[N.G5,.25],
          [N.D4,.25],[N.F4,.25],[N.A4,.25],[N.D5,.25],
          [N.D5,.25],[N.A4,.25],[N.F4,.25],[N.D4,.25],
          [N.Eb4,.25],[N.G4,.25],[N.Bb4,.25],[N.Eb5,.25],
          [N.Eb5,.25],[N.Bb4,.25],[N.G4,.25],[N.Eb4,.25],
          [N.D4,.25],[N.F4,.25],[N.A4,.25],[N.D5,.25],
          [N.Ab4,.25],[N.D5,.25],[N.Ab4,.25],[N.F4,.25],
          [N.D4,.5],[N.D4,.5],[_,.5],[N.D4,.25],[_,.25],
          [N.D3,.25],[_,.25],[N.D3,.5],
        ]},                                                                    // 32 beats
    ],
  },

  // ── THE CRYPT (chamber) ───────────────────────────────────
  // D diminished: D F Ab B. 145 bpm — relentless alien techno.
  // A: 16th-note square arp assault. B: same motif driven an octave up,
  // then a sudden drop for maximum shock effect.
  chamber: {
    bpm: 145,
    tracks: [
      // Lead — square, driving 16th arp
      { wave: 'square', gain: 0.09, pan: 0.1,
        filter: { type: 'bandpass', freq: 1400 },
        seq: [
          // ── A section ───────────────────────────────────────
          [N.D4,.25],[N.F4,.25],[N.Ab4,.25],[N.B4,.25],
          [N.B4,.25],[N.Ab4,.25],[N.F4,.25],[N.D4,.25],
          [N.D4,.25],[N.F4,.25],[N.Ab4,.25],[N.B4,.25],
          [N.D5,.25],[N.B4,.25],[N.Ab4,.25],[N.F4,.25],
          [N.D4,.25],[N.Ab4,.25],[N.D4,.25],[N.Ab4,.25],
          [N.F4,.25],[N.B4,.25],[N.F4,.25],[N.B4,.25],
          [N.Ab4,.25],[N.D5,.25],[N.Ab4,.25],[N.D4,.25],
          [N.B3,.25],[N.F4,.25],[N.B3,.25],[N.D4,.25],
          [N.D4,.25],[N.F4,.25],[N.Ab4,.25],[N.B4,.25],
          [N.D5,.25],[N.B4,.25],[N.Ab4,.25],[N.F4,.25],
          [N.D4,.25],[_,.25],[N.D4,.25],[N.F4,.25],
          [N.Ab4,.25],[N.B4,.25],[N.D5,.25],[_,.25],
          [N.Ab4,.25],[N.F4,.25],[N.D4,.25],[N.B3,.25],
          [N.D4,.25],[N.Ab4,.25],[N.F4,.25],[N.D4,.25],
          [N.B3,.25],[N.F4,.25],[N.Ab4,.25],[N.B4,.25],
          [N.D4,.5],[_,.25],[N.D4,.25],
          // ── B section (octave up) ────────────────────────────
          [N.D5,.25],[N.F5,.25],[N.Ab5,.25],[N.B5,.25],
          [N.B5,.25],[N.Ab5,.25],[N.F5,.25],[N.D5,.25],
          [N.D5,.25],[N.F5,.25],[N.Ab5,.25],[N.B5,.25],
          [N.D5,.25],[N.B4,.25],[N.Ab4,.25],[N.F4,.25],
          [N.D5,.25],[N.Ab5,.25],[N.D5,.25],[N.Ab5,.25],
          [N.F5,.25],[N.B5,.25],[N.F5,.25],[N.B5,.25],
          [N.Ab5,.25],[N.D5,.25],[N.Ab4,.25],[N.D4,.25],
          [N.B3,.25],[N.D4,.25],[N.F4,.25],[N.Ab4,.25],
          [N.D5,.25],[N.F5,.25],[N.Ab5,.25],[N.B5,.25],
          [N.D5,.25],[N.B4,.25],[N.Ab4,.25],[N.F4,.25],
          [N.D4,.25],[_,.25],[N.D5,.25],[N.F5,.25],
          [N.Ab5,.25],[N.B5,.25],[N.D5,.25],[_,.25],
          [N.Ab4,.25],[N.F4,.25],[N.D4,.25],[N.B3,.25],
          [N.D4,.25],[N.Ab4,.25],[N.F4,.25],[N.D5,.25],
          [N.B4,.25],[N.Ab4,.25],[N.F4,.25],[N.D4,.25],
          [N.D4,.5],[_,.25],[N.D4,.25],
        ]},                                                                    // 32 beats
      // Bass — sawtooth slams, doubled
      { wave: 'sawtooth', gain: 0.11, pan: 0.0,
        filter: { type: 'lowpass', freq: 440 },
        seq: [
          [N.D2,.5],[_,.25],[N.D2,.25],[N.D2,.5],[N.D2,.5],
          [N.F2,.5],[_,.25],[N.F2,.25],[N.Ab2,.5],[N.F2,.5],
          [N.D2,.5],[N.D2,.5],[N.B2,.5],[N.D2,.5],
          [N.Ab2,.5],[N.F2,.5],[N.D2,1],
          [N.D2,.5],[N.D2,.5],[N.F2,.5],[N.Ab2,.5],
          [N.B2,.5],[N.Ab2,.5],[N.F2,.5],[N.D2,.5],
          [N.D2,.25],[N.D2,.25],[N.F2,.25],[N.Ab2,.25],[N.B2,.5],[N.D2,.5],
          [N.D2,.5],[N.Ab2,.5],[N.D2,1],
          // bar 2
          [N.D2,.5],[_,.25],[N.D2,.25],[N.F2,.5],[N.D2,.5],
          [N.Ab2,.5],[_,.25],[N.Ab2,.25],[N.B2,.5],[N.Ab2,.5],
          [N.D2,.5],[N.D2,.5],[N.F2,.5],[N.D2,.5],
          [N.B2,.5],[N.Ab2,.5],[N.D2,1],
          [N.D2,.5],[N.D2,.5],[N.Ab2,.5],[N.F2,.5],
          [N.D2,.5],[N.B2,.5],[N.Ab2,.5],[N.F2,.5],
          [N.D2,.25],[N.F2,.25],[N.Ab2,.25],[N.B2,.25],[N.D2,.5],[N.D2,.5],
          [N.D2,.5],[N.D2,.5],[N.D2,1],
        ]},                                                                    // 32 beats
      // Stabs — triangle: syncopated, doubled
      { wave: 'triangle', gain: 0.08, pan: -0.3,
        filter: { type: 'highpass', freq: 400 },
        seq: [
          [N.D4,.25],[_,.25],[N.Ab4,.25],[_,.25],
          [N.F4,.25],[_,.25],[N.B4,.25],[_,.25],
          [N.D4,.25],[N.F4,.25],[N.Ab4,.25],[_,.25],
          [N.B4,.25],[_,.25],[N.D4,.5],
          [_,.25],[N.Ab4,.25],[_,.25],[N.D4,.25],
          [N.F4,.25],[N.B4,.25],[_,.25],[N.Ab4,.25],
          [N.D4,.25],[_,.25],[N.F4,.25],[N.Ab4,.25],
          [N.B4,.25],[N.D4,.25],[_,.5],
          [N.D4,.25],[_,.25],[N.Ab4,.25],[_,.25],
          [N.F4,.25],[N.B4,.25],[_,.25],[N.D5,.25],
          [_,.25],[N.Ab4,.25],[N.F4,.25],[_,.25],
          [N.D4,.5],[_,.25],[N.B3,.25],
          [N.D4,.25],[N.F4,.25],[_,.25],[N.Ab4,.25],
          [N.B4,.25],[_,.25],[N.D5,.25],[_,.25],
          [N.Ab4,.25],[N.F4,.25],[N.D4,.25],[_,.25],
          [N.D4,.5],[_,.5],
          // bar 2 (higher)
          [N.D5,.25],[_,.25],[N.Ab5,.25],[_,.25],
          [N.F5,.25],[_,.25],[N.B5,.25],[_,.25],
          [N.D5,.25],[N.F5,.25],[N.Ab5,.25],[_,.25],
          [N.B5,.25],[_,.25],[N.D5,.5],
          [_,.25],[N.Ab5,.25],[_,.25],[N.D5,.25],
          [N.F5,.25],[N.B5,.25],[_,.25],[N.Ab5,.25],
          [N.D5,.25],[_,.25],[N.F5,.25],[N.Ab5,.25],
          [N.B5,.25],[N.D5,.25],[_,.5],
          [N.D5,.25],[_,.25],[N.Ab4,.25],[_,.25],
          [N.F4,.25],[N.B4,.25],[_,.25],[N.D5,.25],
          [_,.25],[N.Ab4,.25],[N.F4,.25],[_,.25],
          [N.D4,.5],[_,.25],[N.B3,.25],
          [N.D4,.25],[N.F4,.25],[_,.25],[N.Ab4,.25],
          [N.B4,.25],[_,.25],[N.D5,.25],[_,.25],
          [N.Ab4,.25],[N.F4,.25],[N.D4,.25],[_,.25],
          [N.D4,.5],[_,.5],
        ]},                                                                    // 32 beats
    ],
  },

  // ── THE COUNCIL (council) ────────────────────────────────
  // A minor: A C D E G. 128 bpm. Space house.
  // A section: hypnotic hook in oct 4. B section: hook rises to A5/E5 with
  // sweeping synth energy, then an octave drop for impact.
  council: {
    bpm: 128,
    tracks: [
      // Lead — sine: clean and pure, vibrato for warmth
      { wave: 'sine', gain: 0.16, pan: -0.2,
        filter: { type: 'lowpass', freq: 6000 },
        vibrato: { rate: 5.0, depth: 10 },
        seq: [
          // ── A section ───────────────────────────────────────
          [N.A4,.5],[N.C5,.5],[N.E4,.5],[N.A4,.5],
          [N.G4,.5],[N.E4,.5],[N.D4,.5],[N.A4,.5],
          [N.A4,.5],[N.E4,.5],[N.G4,.5],[N.A4,.5],
          [N.C5,.5],[N.A4,.25],[N.G4,.25],[N.E4,.5],[N.D4,.5],
          [N.A4,.5],[N.C5,.5],[N.E5,.5],[N.C5,.5],
          [N.A4,.5],[N.G4,.5],[N.E4,.5],[N.D4,.5],
          [N.A4,.25],[N.C5,.25],[N.E5,.25],[N.G4,.25],[N.A4,.5],[N.E4,.5],
          [N.A4,2],
          // ── B section (soars into oct 5) ────────────────────
          [N.A5,.5],[N.C5,.5],[N.E5,.5],[N.A5,.5],
          [N.G5,.5],[N.E5,.5],[N.D5,.5],[N.A4,.5],
          [N.A5,.5],[N.E5,.5],[N.G5,.5],[N.A5,.5],
          [N.C5,.5],[N.A4,.25],[N.G4,.25],[N.E5,.5],[N.D5,.5],
          [N.A5,.5],[N.G5,.25],[N.E5,.25],[N.D5,.5],[N.C5,.5],
          [N.A4,.5],[N.G4,.5],[N.E4,.5],[N.D4,.5],
          [N.A4,.25],[N.C5,.25],[N.E5,.25],[N.A5,.25],[N.E5,.5],[N.C5,.5],
          [N.A4,2],
        ]},                                                                    // 32 beats
      // Kick / bass — square: 4-on-the-floor, doubled
      { wave: 'square', gain: 0.09, pan: 0.0,
        filter: { type: 'lowpass', freq: 400 },
        seq: [
          [N.A2,.5],[N.A2,.5],[N.A2,.5],[N.A2,.5],
          [N.F2,.5],[N.G2,.5],[N.F2,.5],[N.G2,.5],
          [N.A2,.5],[N.B2,.5],[N.A2,.5],[N.G2,.5],
          [N.A2,.5],[N.A2,.5],[N.A2,1],
          [N.A2,.5],[N.A2,.5],[N.E2,.5],[N.A2,.5],
          [N.G2,.5],[N.E2,.5],[N.D2,.5],[N.A2,.5],
          [N.A2,.5],[N.A2,.5],[N.E2,.5],[N.G2,.5],
          [N.A2,.5],[N.A2,.5],[N.A2,1],
          // bar 2
          [N.A2,.5],[N.A2,.5],[N.A2,.5],[N.A2,.5],
          [N.F2,.5],[N.G2,.5],[N.F2,.5],[N.G2,.5],
          [N.A2,.5],[N.B2,.5],[N.G2,.5],[N.E2,.5],
          [N.A2,.5],[N.A2,.5],[N.A2,1],
          [N.A2,.5],[N.E2,.5],[N.A2,.5],[N.G2,.5],
          [N.F2,.5],[N.G2,.5],[N.A2,.5],[N.E2,.5],
          [N.D2,.5],[N.F2,.5],[N.G2,.5],[N.A2,.5],
          [N.A2,.5],[N.A2,.5],[N.A2,1],
        ]},                                                                    // 32 beats
      // Pad — sawtooth, detuned shimmer, doubled
      { wave: 'sawtooth', gain: 0.06, detune: 7, pan: 0.35,
        filter: { type: 'lowpass', freq: 2800 },
        seq: [
          [N.A4,.5],[N.C5,.5],[N.E4,.5],[N.A4,.5],
          [N.A4,.25],[_,.25],[N.A4,.25],[_,.25],[N.C5,.25],[_,.25],[N.A4,.25],[_,.25],
          [N.G4,.5],[N.B4,.5],[N.D5,.5],[N.B4,.5],
          [N.A4,.5],[N.G4,.5],[N.E4,.5],[N.A4,.5],
          [N.A4,.5],[N.C5,.5],[N.A4,.5],[N.E4,.5],
          [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.D5,.5],
          [N.C5,.5],[N.A4,.5],[N.G4,.5],[N.E4,.5],
          [N.A4,.5],[N.A4,.5],[N.A4,1],
          // bar 2 (higher shimmer)
          [N.A5,.5],[N.C5,.5],[N.E5,.5],[N.A5,.5],
          [N.A5,.25],[_,.25],[N.A5,.25],[_,.25],[N.C5,.25],[_,.25],[N.E5,.25],[_,.25],
          [N.G5,.5],[N.B4,.5],[N.D5,.5],[N.B4,.5],
          [N.A4,.5],[N.G4,.5],[N.E5,.5],[N.A5,.5],
          [N.A5,.5],[N.G5,.5],[N.E5,.5],[N.C5,.5],
          [N.D4,.5],[N.F4,.5],[N.A4,.5],[N.D5,.5],
          [N.C5,.5],[N.A4,.5],[N.G4,.5],[N.E4,.5],
          [N.A4,.5],[N.A4,.5],[N.A4,1],
        ]},                                                                    // 32 beats
    ],
  },

  // ── ATLANTIS (atlantis) ────────────────────────────────────────────────
  // D Phrygian: D Eb F G A Bb C — the lowered 2nd is the Mediterranean dark,
  // the sound of something very old and very wet. 52 bpm — barely a pulse,
  // more like pressure. No clear melody. Two noise layers carry the texture:
  // deep ocean rumble (bandpass ~200Hz) + high surface shimmer (~3kHz).
  // Oscillator voices are sparse and isolated — single notes surfacing into
  // silence like bubbles. The reverb does most of the work.
  atlantis: {
    bpm: 52,
    tracks: [
      // ── Deep ocean rumble — filtered noise, the pressure of fathoms
      { wave: 'noise', gain: 0.055, pan: 0.0,
        filter: { type: 'bandpass', freq: 210, Q: 0.35 },
        reverb: true,
        seq: [[1, 32]] },

      // ── Water surface shimmer — high filtered noise, light through water
      { wave: 'noise', gain: 0.028, pan: 0.0,
        filter: { type: 'bandpass', freq: 3100, Q: 1.1 },
        reverb: true,
        seq: [[1, 32]] },

      // ── Deep bass — sine, very sparse, like the city breathing
      { wave: 'sine', gain: 0.10, pan: 0.0,
        filter: { type: 'lowpass', freq: 300 },
        reverb: true,
        seq: [
          // ── A section (16 beats) ─────────────────
          [N.D2, 3],   [_,   1.5],  [N.Eb2, 2],  [_,   1.5], // 8
          [N.G2, 2.5], [_,   2.5],  [N.A2,  1.5],[_,   1.5], // 8
          // ── B section (16 beats) ─────────────────
          [_,   2],    [N.D2, 3.5], [_,     2.5],             // 8
          [N.F2, 2],   [_,   2],    [N.Bb2, 2],  [_,   2],   // 8
        ]},

      // ── Sparse lead — sine, almost inaudible, notes drifting in from nowhere
      { wave: 'sine', gain: 0.055, pan: -0.2,
        filter: { type: 'lowpass', freq: 1600 },
        vibrato: { rate: 1.6, depth: 4 },
        seq: [
          // ── A section (16 beats) ─────────────────
          [_,    3],   [N.D4,  2.5], [_,    2.5],             // 8
          [N.Eb4,1.5], [_,     2.5], [N.F4, 1.5], [_,  2.5], // 8
          // ── B section (16 beats) ─────────────────
          [_,    4],   [N.A3,  2.5], [_,    1.5],             // 8
          [_,    2],   [N.C4,  1.5], [_,    2.5], [N.G3, 1], [_, 1], // 8
        ]},

      // ── High sparkle — sine, very infrequent, like shafts of light through water
      { wave: 'sine', gain: 0.038, pan: 0.35,
        filter: { type: 'bandpass', freq: 2000, Q: 2.5 },
        reverb: true,
        seq: [
          // ── A section (16 beats) ─────────────────
          [_,    7.5], [N.A5, 0.5],                            // 8
          [_,    8],                                            // 8
          // ── B section (16 beats) ─────────────────
          [_,    6],   [N.D5, 0.5], [_,   1.5],               // 8
          [_,    7],   [N.F5, 0.5], [_,   0.5],               // 8
        ]},
    ],
  },
};

// Realm ID → theme name.
const REALM_THEME = {
  world:   'world',
  oasis:   'oasis',
  vault:   'vault',
  chamber: 'chamber',
  council:  'council',
  atlantis: 'atlantis',
};

// ── SoundManager singleton ────────────────────────────────

class SoundManagerClass {
  constructor() {
    this._ctx          = null;
    this._masterGain   = null;
    this._compressor   = null;
    this._reverb       = null;
    this._reverbGain   = null;
    this._enabled      = true;
    this._volume       = 0.55;
    this._currentRealm = null;
    this._currentTheme = null;
    this._session      = 0;
    this._oscillators  = [];

    try {
      const saved = JSON.parse(localStorage.getItem('ps_audio') || '{}');
      if (typeof saved.enabled === 'boolean') this._enabled = saved.enabled;
      if (typeof saved.volume  === 'number')  this._volume  = Math.max(0, Math.min(1, saved.volume));
    } catch { /* first launch */ }
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
    if (this._ctx.state === 'suspended') return;
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

    // Dynamics compressor — instant polish, glues the mix together
    this._compressor = this._ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -20;
    this._compressor.knee.value      = 15;
    this._compressor.ratio.value     = 4;
    this._compressor.attack.value    = 0.003;
    this._compressor.release.value   = 0.22;
    this._compressor.connect(this._ctx.destination);

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._enabled ? this._volume : 0;
    this._masterGain.connect(this._compressor);

    // Convolver reverb — algorithmically generated impulse response
    this._reverb = this._buildReverb(1.2, 0.9);
    this._reverbGain = this._ctx.createGain();
    this._reverbGain.gain.value = 0.14;   // wet level — subtle spatial wash
    this._reverb.connect(this._reverbGain);
    this._reverbGain.connect(this._masterGain);
  }

  /** Build a simple decaying-noise impulse response for reverb. */
  _buildReverb(durationSec, decay) {
    const ctx    = this._ctx;
    const rate   = ctx.sampleRate;
    const len    = Math.floor(rate * durationSec);
    const ir     = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
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

    // Build per-track shared nodes (filter + panner)
    const filter = ctx.createBiquadFilter();
    if (track.filter) {
      filter.type            = track.filter.type;
      filter.frequency.value = track.filter.freq;
      filter.Q.value         = track.filter.Q ?? 1.0;
    } else {
      filter.type = 'allpass';
    }

    const panner = ctx.createStereoPanner();
    panner.pan.value = track.pan ?? 0;

    // Routing: filter → panner → masterGain  (dry)
    //          filter → reverb  (wet, shared reverb bus)
    filter.connect(panner);
    panner.connect(this._masterGain);

    // Reverb send (melodic leads, or tracks explicitly flagged reverb: true)
    if (track.vibrato || track.reverb) {
      filter.connect(this._reverb);
    }

    // ── Noise track handler ──────────────────────────────────
    // wave: 'noise' — generates a looping filtered white noise source.
    // track.seq is still used to determine total duration; freq values ignored.
    if (track.wave === 'noise') {
      const rate   = ctx.sampleRate;
      const bufLen = Math.floor(rate * 2.7); // 2.7s buffer, loops seamlessly
      const buf    = ctx.createBuffer(1, bufLen, rate);
      const ch     = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) ch[i] = Math.random() * 2 - 1;

      const totalSec = track.seq.reduce((s, [, d]) => s + d * beatLen, 0);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0,           startT);
      env.gain.linearRampToValueAtTime(track.gain, startT + 0.8);
      env.gain.setValueAtTime(track.gain,  startT + totalSec - 0.7);
      env.gain.linearRampToValueAtTime(0,  startT + totalSec);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      src.connect(env);
      env.connect(filter);
      src.start(startT);
      src.stop(startT + totalSec);
      this._oscillators.push(src);
      return track.seq.reduce((s, [, d]) => s + d, 0);
    }

    for (const [freq, dur] of track.seq) {
      const durSec = dur * beatLen;
      if (freq !== null) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type            = track.wave;
        osc.frequency.value = freq;
        if (track.detune) osc.detune.value = track.detune;

        // Vibrato LFO — adds expressiveness to melodic leads
        if (track.vibrato && dur >= 0.4) {
          const lfo     = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.value  = track.vibrato.rate;
          lfoGain.gain.value   = track.vibrato.depth;
          // Delay vibrato onset slightly (natural performer gesture)
          const vibratoOnset = t + Math.min(0.12, durSec * 0.3);
          lfoGain.gain.setValueAtTime(0,                   t);
          lfoGain.gain.linearRampToValueAtTime(0,          vibratoOnset);
          lfoGain.gain.linearRampToValueAtTime(track.vibrato.depth,
                                               vibratoOnset + 0.06);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start(t);
          lfo.stop(t + durSec + 0.01);
          this._oscillators.push(lfo);
        }

        // ADSR: fast attack, full sustain, clean release — no clicks
        const attack  = Math.min(0.018, durSec * 0.05);
        const release = Math.min(0.055, durSec * 0.15);
        env.gain.setValueAtTime(0,           t);
        env.gain.linearRampToValueAtTime(track.gain, t + attack);
        env.gain.setValueAtTime(track.gain,  t + durSec - release);
        env.gain.linearRampToValueAtTime(0,  t + durSec);

        osc.connect(env);
        env.connect(filter);
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
