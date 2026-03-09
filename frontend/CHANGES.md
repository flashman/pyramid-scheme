# PYRAMID SCHEME™ — CHANGELOG

---

## v1.37 — Atlantis realm: vault-gated entry, alt-history sphinx lore

> *The pool was always the way in. But to open it you must first go beneath the sphinx and learn what the sphinx actually is. The stele tells you. Then the altar opens the door. The flow is non-linear by design.*

### Player flow

1. Solve sphinx riddles → descend to vault
2. Read the Dream Stele (extended — see below)
3. Walk to the altar, press **[SPACE]** → altar grinds aside, ancient water rises
4. Return to oasis, walk to pool → statue emerges from the water
5. When statue is fully risen, press **[↓]** in the pool → dive to Atlantis
6. Swim freely with arrow keys; swim up past the surface threshold + press **[↑]** → back to oasis

### `worlds/oasis/VaultRealm.js`
- **Dream Stele dialogue extended** from 7 nodes to 15.
  - The original Thutmose IV / pyramid-scheme allegory nodes are preserved verbatim.
  - After the final allegory node, the text changes register to `BENEATH THE INSCRIPTION  ✦  ~10,500 BC`:
    - **Hydraulic weathering** — the sphinx body shows rainfall erosion, not wind/sand. The last rains capable of this fell before 7000 BC (Schoch / West theory).
    - **Astronomical alignment** — on the spring equinox of 10,500 BC the sphinx faced the rising of Leo precisely, pointing to a pre-pharaonic builder.
    - **Pre-diluvian civilisation** — the builders had a system, believed it was permanent; rising sea levels at the end of the last Ice Age drowned their coastal world.
    - **The passage** — they left a record beneath the altar in this room, connected to the same aquifer as the pool above. They called it *the House of the Inundated*.
    - **The mirror** — their civilisation also had uplines, also promised thrones, also had princes who dug and were not recorded. We are their downline.
  - `stele_read` flag is now set at the final node (`door`) rather than at `question`. The altar hint fires here.
- **Altar entity registered** in `InteractableRegistry` alongside the stele NPC.
  - Uses base `Entity` class with an `onInteract` override.
  - If stele not yet read: generic "old altar" log message; no effect.
  - If stele read and vault not opened: sets `atlantis_vault_opened`, shake 18, log messages, tells player to return to the pool.
  - If already opened: ambient water log.
- `onEnter()` log messages updated to reflect current state (stele unread / stele read but altar intact / vault opened).
- Imports updated: `Entity` added from `engine/entity.js`; `ALTAR_X` added from constants.

### `worlds/oasis/draw/vault.js`
- `drawAltar()` signature updated: `(ax, fy, t, steleRead, vaultOpened)`.
- When `vaultOpened`: teal-blue glow bleeds from stone joints; animated crack-light lines; rising water-drop particles above the altar base.
- When `steleRead && !vaultOpened`: a subtle radial pulse glow on the altar top surface to signal interactivity.
- When player is within 70px of altar and `steleRead && !vaultOpened`: pulsing `[SPACE] THE ALTAR AWAITS` prompt in screen space.
- `drawVault()` and `drawHUD()` updated to pass and consume these flags.
- HUD hint updates to `✦  PASSAGE OPEN` when `vaultOpened`.
- Imports updated: `ALTAR_X` added from constants.

### `worlds/oasis/constants.js`
- **Removed**: `SLAB_WX`, `SLAB_INTERACT` (the pool slab mechanic is gone).
- **Added**: `ALTAR_X = 310` (world-x of the vault altar, used by VaultRealm and draw/vault.js).
- **Added**: `POOL_CENTER_WX = 800` (dive point — centre of pool, replaces SLAB_WX).
- **Added**: `POOL_DIVE_RANGE = 110` (proximity threshold for dive prompt, replaces SLAB_INTERACT).

### `worlds/oasis/OasisRealm.js`
- **Removed**: `_slabToppled`, `_slabToppleTime` state and all associated logic.
- **Removed**: SPACE-in-pool "push the slab" handler.
- Statue rise now triggered by `atlantis_vault_opened` flag (set in vault) rather than a pool interaction.
  - State: `_statueRising`, `_statueRiseStart`, `_statueProgress`, `_statueRisen`.
  - In `update()`: if `atlantis_vault_opened` is newly detected and statue not risen, starts the rise animation (5 s).
  - On `onEnter()`: if vault opened and statue not risen, resumes animation with a 500 ms head start.
- Pool centre dive uses `POOL_CENTER_WX` / `POOL_DIVE_RANGE` (no named slab position).
- Log messages updated throughout to reflect the new flow.
- Imports updated: `SLAB_WX/SLAB_INTERACT` replaced with `POOL_CENTER_WX/POOL_DIVE_RANGE`.
- SPACE in pool when vault not opened but stele read: context-sensitive hint log.

### `worlds/oasis/draw/oasis.js`
- `drawAtlantisGate()` **replaced** by `drawPoolStatue()`:
  - No slab at all — the pool is visually unobstructed before the ritual.
  - If `atlantis_vault_opened` is false: function returns immediately, pool unchanged.
  - If rising: concentric elliptical ripple rings on the water surface.
  - Statue rises with a clip-rect animation (0 → full height over 5 s): dark teal stone body with raised arms, Atlantean crown with five spires, glowing eye slits, carved inscription lines on torso.
  - Aura glow intensifies as statue rises.
  - When fully risen: elliptical portal glow at pool floor; `[↓] DIVE INTO ATLANTIS` prompt near dive point.
- HUD hint updated: `[SPACE] PUSH/SPEAK` → `[SPACE] SPEAK`.
- Imports updated: `SLAB_WX/SLAB_INTERACT` replaced with `POOL_CENTER_WX/POOL_DIVE_RANGE`.

### `worlds/atlantis/` (AtlantisRealm.js, constants.js, draw/atlantis.js)
- No changes — the realm itself is unchanged. Entry and exit mechanics are identical.

---

## v1.36 — Engine abstraction pass: TriggerZone, Enemy, Collectible, getPlayerPose

> *No gameplay changes. Purely structural: removes copy-paste patterns, adds missing game-object abstractions, and closes a long-standing G-sync bug in non-world realms.*

### `engine/trigger.js` (new)
- New **`TriggerZone`** class: world-space proximity region with `condition`, `onEnter`, `onExit`, `onStay` callbacks and an optional pulsing hint text rendered by the canvas.
- New **`TriggerRegistry`**: owns a list of zones, drives them from `update(px)`, and renders all active hints via `renderHints(camX)`.
- Replaces the three hardcoded `_oasisGateNear()` / `_cryptDoorNear()` / `_capstoneTipNear()` helpers in `WorldRealm` with registered zones. Adding a new door, gate, or area trigger anywhere is now 5 lines.

### `engine/entity.js`
- New **`Enemy`** class (extends `Entity`): patrol-and-bounce AI driven by `{ patrol: { x1, x2 }, speed }`, terrain surface-snapping via `surfaceFn(wx)`, stun state (`stun(ts)` / `isStunned`), and `hurtCheck(px, py)` for player collision. Walk animation and facing handled internally. Registers with `InteractableRegistry` like any entity.
- New **`Collectible`** class (extends `Entity`): auto-collected on proximity — no button press required. `onNear()` fires `onCollect(item)` once, then deactivates. `type` and `value` fields for semantic tagging (coins, scrolls, gems, etc.). Override `draw(sx, sy)` in a subclass to render the item.
- `NPC` unchanged.

### `engine/realm.js`
- `Realm` base class gains **`getPlayerPose()`** → `{ px, py, camX, pZ, facing, frame } | null`. Default returns `null`. Each concrete realm overrides it. Used by `drawRealmPharaoh(realm)` so draw files no longer need realm-specific pharaoh wrappers.

### `worlds/FlatRealm.js`
- **`getPlayerPose()`** implemented: returns fixed-camera pose with `camX: 0, pZ: 0`.
- **`_walkStep(ts)`** now syncs `G.px / G.py / G.facing / G.pmoving / G.pframe` after each frame. Previously, `FlatRealm` subclasses had their own `this.px/facing` that never propagated to G — HUD and any G-reading system saw stale world position while in chamber/council/vault.

### `worlds/constants.js`
- New **`inputDx(baseSpeed)`** helper: reads `G.keys` for `ArrowLeft/Right/A/D/Shift`, sets `G.facing` and `G.pmoving`, returns `dx`. Consolidates the identical key-reading block that was duplicated in `WorldRealm.update()` and `OasisRealm.update()`.

### `worlds/oasis/OasisRealm.js`
- **`getPlayerPose()`** implemented: returns scrolling-world pose including `this.camX`.
- New **`_syncToG()`**: writes `this.px/py/pvy/camX/facing/frame/moving` → G at the end of every `update()` call. Fixes the bug where G held stale world-realm coordinates while in the oasis, causing HUD and minimap to misreport player position.
- Pool entry/exit callbacks moved to a **`TriggerZone('pool', ...)`** via a `TriggerRegistry`. The `_wasInPool` manual diff-flag is removed.

### `worlds/earth/WorldRealm.js`
- `_oasisGateNear()`, `_cryptDoorNear()`, `_capstoneTipNear()` **removed**. Replaced by registered `TriggerZone` objects in a `TriggerRegistry`.
- New **`_rebuildDynamicTriggers()`**: reconstructs the crypt-door and capstone-tip zones (whose bounds depend on player pyramid position) on every `onEnter()`. Called in constructor and on re-entry.
- `render()` hint drawing replaced by `this.triggers.renderHints(G.camX)` — one line instead of two separate inline canvas blocks.
- `onKeyDown()` `ArrowUp` branches use `this.triggers.isInside('id')` instead of calling private helpers.
- Horizontal movement uses `inputDx(SPEED)` instead of the inline key-reading block.

### `draw/pharaoh.js`
- Dead realm-floor constant imports (`CHAMBER_FLOOR`, `COUNCIL_FLOOR`, `OASIS_FLOOR`, `VAULT_FLOOR`) **removed** — those values now live in each realm's `getPlayerPose()`.
- New **`drawRealmPharaoh(realm)`**: calls `realm.getPlayerPose()` and passes the result to `drawPharaoh()`. Preferred over the legacy named variants for any new draw file.
- `drawChamberPharaoh`, `drawCouncilPharaoh`, `drawOasisPharaoh`, `drawVaultPharaoh` preserved as one-line shims for backward compatibility.

### `main.js`
- New **`_hydrateState(me)`**: extracts the 15-line `/api/me` → G + Flags hydration block from `init()` into a named function.
- New **`_wireWsEvents(token)`**: extracts `gameSocket.connect()` and all three `ws:*` event handlers from `init()` into a named function. `init()` calls both; each is independently readable and testable.

---



### `ui/auth.js`
- New **Terms of Participation modal** (`#tos-overlay`) injected alongside the auth overlay at startup.
- Clicking the **REGISTER** tab (or arriving via an invite link) now opens the ToS modal *before* showing the registration form. The form is inaccessible until the player accepts.
- The ToS document is a fully-scrollable, styled panel containing nine numbered sections:
  1. **Nature of the Game** — explicitly identifies PYRAMID SCHEME™ as satirical entertainment, not a financial product.
  2. **Participation Fee** — buy-in pays for game access only; not an investment; non-refundable.
  3. **Discretionary Rewards** — achievements *may* yield real rewards at the operator's sole discretion; none are guaranteed. Includes a prominent plain-language callout.
  4. **This Is Not a Pyramid Scheme** — explains the MLM mechanic as players introducing players to the game (analogous to mainstream referral programmes); no recruitment required to recoup fees.
  5. **Limitation of Liability** — operator not liable for losses; aggregate liability capped at prior 12 months' fees.
  6. **Participant Representations** — age of majority, entertainment intent, no guarantee expectation, prohibition on misrepresenting the game as an investment.
  7. **Intellectual Property** — limited personal-use licence.
  8. **Modifications** — operator may revise terms; continued participation = acceptance.
  9. **Governing Law & Disputes** — individual binding arbitration; class-action waiver.
- Checkbox at the bottom of the modal (`#tos-checkbox`) must be ticked before the **I AGREE** button enables. Both the checkbox and button reset each time the modal opens.
- **Decline** returns the player to the login tab with no registration access.
- After accepting, a small **☰ review terms of participation** link appears beneath the confirm-password field so players can re-read the terms at any time without losing their form state.
- On game start, both auth and ToS overlays are removed from the DOM cleanly.
- Document reference: `PSE-TOS-2025-R1`.

---

## v1.34 — Sphinx dialogue migrated to shared HTML panel

### `worlds/oasis/riddles.js`
- **Removed all canvas drawing** from `RiddleManager.render()`. The previous implementation drew a bespoke panel directly onto the game canvas (low-resolution text, fixed pixel coordinates, overlay covering the scene).
- `RiddleManager.render()` now populates the shared `#dlg` / `#dlg-speaker` / `#dlg-text` / `#dlg-choices` / `#dlg-hint` HTML elements — identical to the `DialogueManager` used by every other NPC in the game. Sizing, typography, gold border, and inner inset line are all inherited from `style.css` with no extra code.
- Speaker label set to `THE SPHINX`.
- Phase-specific text colours applied via `textEl.style.color` (`#e8d090` correct, `#d06020` wrong, default amber for reading).
- Answer input rendered inline in `#dlg-choices` as a `.dlg-choice` div with a blinking block cursor, matching the visual language of the choice-selection UI.
- `#dlg` panel is explicitly hidden (`classList.remove('active')`) on Escape, correct-answer confirmation, and any deactivation — no stale panel left visible.
- **UX fix:** riddle question now remains visible during the typing phase (previously disappeared), so players can refer back to it while composing their answer.
- **Security fix:** player input is HTML-escaped before injection into `innerHTML` to prevent rendering artefacts from characters such as `<`, `>`, `&`.
- Removed stale `import { X, CW, CH }` — canvas symbols were no longer used after the drawing code was removed.
- Updated file header comment to accurately describe the HTML-panel approach.

---

## v1.33 — Audio bugfix: missing note frequencies

### `audio/sound.js`
- Added `Eb2: 77.78` and `Ab2: 103.83` to the note-frequency table `N`. Both notes were referenced in the vault (bass line) and chamber (bass line) themes introduced in v1.32 but absent from the table, causing `osc.frequency.value = undefined` → `TypeError: Failed to set the 'value' property on 'AudioParam': The provided float value is non-finite` on those realms.

---

## v1.32 — Soundtrack v2: Mario-style 32-beat melodies, modern audio chain

### `audio/sound.js`
- **32-beat sequences** (doubled from 16) on all five themes. Each theme is now structured as an **A section** (beats 1–16, mid-register) followed by a **B section** (beats 17–32) that drives the melody into the next octave — the classic technique used throughout the Mario and Zelda soundtracks for dramatic energy lifts within a loop.
- Extended note table: added full octave-5 coverage (`C5`–`B5`) and the previously-missing `Eb2`, `Ab2`.
- **DynamicsCompressor** inserted at the master output (`threshold −20 dB`, `ratio 4:1`, `attack 3ms`, `release 220ms`). Prevents inter-track clipping, glues the mix, and gives the whole soundtrack a polished, mastered feel with zero additional work.
- **Convolver reverb** — algorithmically-generated decaying-noise impulse response (1.2s, decay 0.9). Fed from melodic lead tracks only (bass stays dry) at a 14% wet level for spatial depth without mud.
- **Per-track BiquadFilter** — bass tracks (`lowpass ~400–480 Hz`) for warmth and weight; lead tracks (`lowpass 3600–6000 Hz`) to cut harshness; some tracks use `bandpass` or `highpass` for presence and clarity.
- **StereoPanner** — each track assigned a stereo position (`pan: -0.35`–`+0.35`) so layers occupy distinct width positions rather than collapsing to mono centre.
- **Vibrato LFO** — melodic lead tracks (world, oasis, vault, council) have a secondary `OscillatorNode` → `GainNode` → `osc.frequency` chain. Rate ~4–5.5 Hz, depth 7–12 cents. Onset is delayed by ≈120ms (or 30% of note duration) to mimic a natural performer's expressive vibrato rather than a mechanical tremolo.
- B-section arpeggio climbs: triangle/sine arp tracks now use octave-5 chord tones in the B section to match the melody's register shift.
- Routing: `oscillator → env → filter → panner → masterGain` (dry); lead tracks also send `filter → convolver` (wet reverb bus).

---

## v1.31 — Chiptune soundtrack; per-realm themes; sound settings

### `audio/sound.js` (new)
- New `SoundManager` singleton — procedural electronic music via the Web Audio API.
  Zero audio files; every note synthesised live with oscillators and per-note ADSR envelopes.
- Expanded note-frequency table now covers A1–E5 including E2, Fs2, E3, Fs3, Bb3.
- Five realm-specific themes at 108–145bpm with 3 simultaneous oscillator tracks each.
  All tracks are exactly 16 beats so they loop in beat-accurate lock-step:
  - **world** (`THE DESERT`) — D Hijaz scale (D Eb F# G A Bb C), **132bpm**.
    Sawtooth lead blazes fast scalar runs and augmented-2nd jumps (that Egyptian fingerprint).
    Square bass hammers 8th-note movement. Triangle 16th-note arpeggios drive the groove.
  - **oasis** (`THE OASIS`) — D minor pentatonic, **114bpm**.
    Triangle melody floats over a syncopated square bass groove.
    Sine arpeggio shimmers underneath. Funky and driving, not sappy.
  - **vault** (`BENEATH THE SPHINX`) — D Phrygian (flat-2 = Eb → dark tension), **108bpm**.
    Sparse sawtooth lead: every note an event, big gaps create dread.
    Square bass punches mid-octave (Eb3/D3) for extra presence, not just sub-bass rumble.
    Slightly detuned triangle arp drones on dimished/minor voicings.
  - **chamber** (`THE CRYPT`) — D diminished (D F Ab B), **145bpm** — the fastest.
    Square oscillator hammers relentless 16th-note diminished arpeggios for two full octaves.
    Sawtooth bass syncopates and slams. Off-beat triangle stabs add a techno snap.
  - **council** (`GALACTIC COUNCIL`) — A natural minor, **128bpm**.
    Sine lead has a real hook — call-and-response phrasing. Square bass does steady 4-on-the-floor
    with walking movement (A→G→D→E). Detuned sawtooth pad (+7 cents) adds electronic shimmer.
- All notes use ADSR-lite envelopes (fast attack ≤20ms, quick release ≤60ms) to eliminate click artefacts.
- Browser autoplay policy handled: `AudioContext` is lazy; `SoundManager.resume()` is called on
  every `keydown` to unblock it after the first user gesture.
- Preferences (`enabled`, `volume`) persisted to `localStorage` under `ps_audio`.

### `frontend/Dockerfile`
- Added `COPY audio/ /usr/share/nginx/html/audio/` — the Dockerfile enumerates each source
  directory explicitly, so new directories must be listed or nginx returns 404 on the import.

### `engine/realm.js`
- Added `import { Events }` from `./events.js`.
- `RealmManager.transitionTo()` now emits `Events.emit('realm:enter', { id, fromId })` after
  every realm swap. Clean hook point for the music system and future cross-cutting listeners.

### `main.js`
- Imports `SoundManager` from `./audio/sound.js`.
- `Events.on('realm:enter', ({ id }) => SoundManager.playRealm(id))` — music switches on every realm transition.
- `SoundManager.resume()` called in the `keydown` handler to satisfy browser autoplay policy.
- `SoundManager.playRealm('world')` called at the end of `init()` to start the desert theme immediately.
- `window.toggleSound` exposed for the sidebar button.

### `ui/profile.js`
- Imports `SoundManager`.
- New **▶ SOUND SETTINGS** section in the profile modal (above log-out):
  - Toggle button: `♪ ON` / `✕ OFF` — calls `SoundManager.setEnabled()`.
  - Volume slider `<input type="range">` — calls `SoundManager.setVolume(pct/100)`.

### `index.html`
- New **▶ SOUND** panel in the right sidebar with a quick-mute button (`window.toggleSound()`).


- New `SoundManager` singleton — procedural chiptune music using the Web Audio API. Zero audio files; every note is synthesised on the fly with oscillators.
- Five realm-specific themes, each with 3 simultaneous oscillator tracks (melody, bass, and harmony/pad) for a classic 90s RPG/platformer feel:
  - **world** (`THE DESERT`) — D pentatonic major at 88 bpm. Triangle-wave flute lead over a punchy square bass and sine harmony. Warm, sandy, Egyptian.
  - **oasis** (`THE OASIS`) — Same tonal centre, slower (76 bpm). Gentler triangle melody with a shimmering water-ripple sine counter-track.
  - **vault** (`BENEATH THE SPHINX`) — D natural minor at 62 bpm. Sawtooth lead with haunting attack, heavy square bass, and a low sine drone. Ominous underground torch-light.
  - **chamber** (`THE CRYPT`) — D diminished arpeggio at 138 bpm. Fast square arpeggio + driving sawtooth bass = raw alien techno. Triangle counter-melody adds an eerie hook.
  - **council** (`GALACTIC COUNCIL`) — C major at 70 bpm. Slow-moving sine pad lead over a triangle bass, plus a detuned shimmer pad for cosmic depth.
- All sequences are exactly 16 beats (4 bars of 4/4); tracks loop seamlessly with beat-accurate scheduling to avoid gap or overlap artefacts.
- ADSR-lite envelope on each note (fast attack, hold, quick release) eliminates click artefacts at note boundaries.
- Browser autoplay-policy handled: the `AudioContext` is created lazily on first use; `SoundManager.resume()` is called on every `keydown` to unblock the context after the first user interaction.
- Preferences (`enabled`, `volume`) persisted to `localStorage` under the key `ps_audio`.

### `frontend/Dockerfile`
- Added `COPY audio/ /usr/share/nginx/html/audio/` — the Dockerfile enumerates directories explicitly, so the new `audio/` folder must be listed or nginx returns 404 on the module import and the entire game fails to load.

### `engine/realm.js`
- Added `import { Events }` from `./events.js`.
- `RealmManager.transitionTo()` now emits `Events.emit('realm:enter', { id, fromId })` after every realm swap (including animated transitions that ultimately call `transitionTo`). This is the hook point for the music system and any other cross-cutting realm-change listeners.

### `main.js`
- Imports `SoundManager` from `./audio/sound.js`.
- `Events.on('realm:enter', ({ id }) => SoundManager.playRealm(id))` — music switches automatically whenever the player moves between realms.
- `SoundManager.resume()` called inside the existing `keydown` listener so the AudioContext is unblocked on the first key press (satisfies browser autoplay policies without requiring a separate click handler).
- `SoundManager.playRealm('world')` called at the end of `init()` to start the desert theme immediately on load.
- `window.toggleSound` exposed — flips `SoundManager.enabled` and updates the sidebar button label.

### `ui/profile.js`
- Imports `SoundManager`.
- New **▶ SOUND SETTINGS** section in the profile overlay (inserted above the log-out button):
  - **MUSIC toggle button** — flips `SoundManager.setEnabled()` and relabels itself `♪ ON` / `✕ OFF`. Also updates the sidebar button to stay in sync.
  - **VOLUME slider** (`<input type="range">`) — calls `SoundManager.setVolume(pct/100)` on `input`; displays the current percentage alongside the slider.

### `index.html`
- New **▶ SOUND** panel added to the right sidebar (below CONTROLS):
  - Quick-mute `♪ MUSIC ON` / `✕ MUSIC OFF` toggle button — calls `window.toggleSound()`.
  - Sub-caption hints that volume lives in the ◈ PROFILE panel.



### `worlds/oasis/constants.js`
- `POOL_WX` moved from 80 → 620. Pool is now a destination you walk to, not a wall at the entry. Player spawns on dry sand at x=60, walks ~560px before reaching the water.
- `POOL_WIDTH` reduced 500 → 360.
- Added `VAULT_FLOOR = 436`, `STELE_X = 390` for the new vault realm.
- `PASSAGE_WX` tightened 1720 → 1680 (centers on the staircase opening).

### `worlds/oasis/draw/oasis.js`
- **Paw gap fix:** a solid stone masonry base is now always drawn in the area between the sphinx's front paws. Horizontal mortar lines and edge recesses make it read as a continuous stone surface. No dark gap is visible before any riddles are solved.
- **Staircase replaces archway:** when `riddlesSolved > 0`, the masonry base gives way to a descending staircase — 5 steps narrowing with perspective, warm amber glow rising from below, dust motes at riddles ≥ 2. Looks like it leads somewhere rather than through somewhere.
- **Pool reflection updated:** archway shimmer in pool replaced with vault-glow shimmer (same riddle thresholds, same prophetic effect).
- **Two early palms added** at x=210 and x=430 to populate the now-longer dry entry stretch.
- **Passage hint** updated to `[↓] DESCEND INTO THE VAULT`.

### `worlds/oasis/OasisRealm.js`
- Passage entry key changed `ArrowUp` → `ArrowDown` (descending a staircase).
- Transition target changed `'world'` → `'vault'`.
- Detection range tightened 160 → 100px.
- Log message updated.

### `worlds/oasis/VaultRealm.js` (new)
- Flat `Realm` subclass (no physics). Player walks freely left/right (40–740px).
- Contains the Dream Stele NPC at `STELE_X=390` with 110px interact range.
- `[SPACE]` triggers the stele dialogue. `[↑]` returns to oasis.
- Sets `Flags.vault_entered` on entry, `Flags.stele_read` when dialogue completes.

### `worlds/oasis/draw/vault.js` (new)
- Underground stone chamber: warm amber/brown, low ceiling with block joints, left + right carved stone walls.
- Ceiling staircase opening (top-left) with oasis light leaking down.
- Two pairs of flickering torches with per-torch flicker phase.
- Floor stone slabs with sand drifts at both walls.
- Hieroglyph panels on walls: eye of Horus, ankh, pyramid, ibis, wavy water lines.
- **Dream Stele** centered at `STELE_X`: granite tablet with lunette top, four carved register scenes (pharaoh offering, text lines, dream figure, throne glyph). Glows faintly after being read.
- Scattered clay offerings and canopic jars at stele base.

### `draw/pharaoh.js`
- Added `drawVaultPharaoh(realm)` — renders player at `VAULT_FLOOR`.
- Added `VAULT_FLOOR` import from oasis constants.

### `main.js`
- Imports and registers `VaultRealm`.



> *A distant landmark shimmers on the horizon as you walk east. Press `[↑]` at the desert's edge to enter the Oasis — a golden-hour pocket of ancient life where a colossal sphinx speaks only in riddles. Solve them and the passage beyond begins to glow.*

### `worlds/oasis/constants.js` (new)
- World-space layout: `OASIS_FLOOR` (440), `OASIS_WORLD_W` (3000), `POOL_WX` (80), `POOL_WIDTH` (500), `SPHINX_WX` (1800), `POOL_FLOOR` (468, used when wading), `PASSAGE_WX` (1720, the hidden archway between the sphinx's paws).

### `worlds/oasis/riddles.js` (new)
- `RiddleManager` — canvas-rendered riddle system. No HTML elements; entirely self-contained.
- Pool of 12 thematic riddles with single-word answers and accepted synonyms. Each correct answer delivers a lore response tying the riddle to the pyramid-scheme theme.
- State machine: `reading` (typewriter) → `typing` (player types) → `wrong` / `correct` (lore response). Three attempts before the answer is gently revealed.
- Tracks solved count via `Flags.inc('sphinx_riddles_solved')`.
- **UI:** Rendered as a bottom dialogue panel (162px, flush sides, gold top-border) matching the `#dlg` aesthetic. The top 2/3 of the screen receives a soft darkener so the sphinx remains visible while answering. No more full-screen overlay.

### `worlds/oasis/OasisRealm.js` (new)
- `PhysicsRealm` subclass — full scrolling world with gravity, camera tracking, and jump (`Z` key). World is 3000px wide.
- Player enters from world-x 60. Walking back to the west edge auto-returns to the main world.
- **Pool wading:** entering `POOL_WX..POOL_WX+POOL_WIDTH` reduces movement speed to 55%, lowers the floor to `POOL_FLOOR` (player sinks slightly), reduces jump power, and spawns a blue water-droplet particle burst on entry and every jump.
- **Hidden passage (`[↑]`):** once `sphinx_riddles_solved ≥ 1`, pressing `[↑]` near `PASSAGE_WX` triggers a gold-blaze → darkness passage transition back to the world, incrementing `Flags.passage_crossed`.
- `[SPACE]` within 220px of `SPHINX_WX` starts a riddle.
- Transition renderer `_passageTransRender(progress)` — radial gold blaze-in, then full-dark fade-out.

### `worlds/oasis/draw/oasis.js` (new)
- Full scrolling scene. Sky, stars, horizon dunes drawn screen-space; all ground objects under `X.translate(-camX, 0)`.
- Pool (500px wide) with animated ripple rings. Accepts player world-x and riddles-solved count:
  - **Player splash ripples** — expanding ellipse rings + V-shaped wake centered on player when wading.
  - **Prophetic reflection** — 0 riddles: plain gold-sky reflection. 1+: impossible nighttime stars appear in the water. 2+: archway shimmer reflected. 3+: full golden-gate radial glow in the water.
- Five palm trees with per-tree sway phase, trunk segments, frond leaflets.
- Full-detail pixel-art sphinx (lion body, nemes headdress with alternating blue/gold stripes, uraeus cobra, kohl eye, royal beard, historically-accurate missing nose tip, ancient-power aura glow).
- **Hidden passage** — dark archway void between the front paws, drawn when `sphinx_riddles_solved ≥ 1`. Interior glow scales with riddles solved. Floating light motes appear at 2+. Sand-spill glow from the passage mouth at 1+.
- `[↑] ENTER THE PASSAGE` hint pulses when player is within 160px of `PASSAGE_WX` and has solved ≥1 riddle.

### `worlds/earth/WorldRealm.js`
- **Removed** auto-entry trigger in `update()`. Player is now clamped at the east edge.
- Added `_oasisGateNear()` helper: `pZ === 0 && |px - OASIS_ENTRY_X| < 220`.
- `render()`: pulsing `[↑] ENTER THE OASIS` hint appears when near the gate.
- `ArrowUp` handler: highest-priority branch now checks `_oasisGateNear()` → `scheduleTransition('oasis', { duration: 1200, render: _oasisTransRender })`.
- `_oasisTransRender(progress)` — heat-ripple band sweep + warm golden fade.

### `worlds/earth/draw/background.js`
- `_drawDistantSphinx()` — detailed parallax silhouette (paws, body, haunch, nemes headdress with stripes, cobra, head, eye). Parallax at 0.08× ground speed. Fades in from camX 2000.
- **Scale fix:** distant sphinx now drawn at 35% via `ctx.scale()` transform anchored to its base — it was previously full-size (looming). Blur filter scales with distance (far = 2.2px blur; close = sharp).
- Base Y fixed to sit on the sand horizon line (`desertTop + 72`) rather than floating above it.

---

## v1.27 — Movement speed, jump key & physics fix

### `engine/realm.js`
- **Fixed `_gravityStep` swallowing jump velocity.** Previously, when the player was standing on a surface, the else-branch unconditionally set `pvy = 0` every frame — meaning any jump impulse set in `onKeyDown` (e.g. `G.pvy = -9`) was wiped out before the player could move. Gravity is now always applied first, and the surface snap only fires on actual landing (`py >= surfY` after integration).


### `worlds/constants.js`
- `SPEED` increased from `4` → `5`. Affects all realms (World, Crypt, Council).

### `worlds/earth/WorldRealm.js`
- Walk animation cycle threshold lowered from `180ms` → `120ms` — footstep cadence now matches the faster base speed.
- Jump moved to **`Z`** key. `ArrowUp` was doing too many things (enter crypt, ascend to council, change z-layer) and was swallowing jump inputs. `Z` is unambiguous and only jumps.
- `ArrowUp` no longer handles jump at all — its remaining uses (crypt door, capstone ascend, z-layer exit) are unchanged.
- `Space` restored to interact-only (no jump fallback).
- **Note:** `Shift + Arrow` sprint (2× speed) was already wired here; no change needed.

### `worlds/crypt/ChamberRealm.js`
- Added `Shift + Arrow` sprint support (was missing — only the World realm had it).
- Walk animation cycle threshold lowered from `180ms` → `120ms`.

### `worlds/council/CouncilRealm.js`
- Added `Shift + Arrow` sprint support (was missing — only the World realm had it).
- Walk animation cycle threshold lowered from `180ms` → `120ms`.

---

## v1.26 — Session persistence & user profile

### `game/api.js`
- `setToken(t)` now also writes the token to `localStorage` under the key `ps_auth_token`. Token persists across page refreshes.
- `clearToken()` now also removes the token from `localStorage`.
- New `restoreToken()` — reads the stored token, validates it against `GET /api/me`, returns the token string if valid, `null` otherwise (invalid/expired tokens are cleared automatically).
- New profile helpers: `getProfile()`, `changeUsername()`, `changePassword()`, `changeEmail()` — wrappers for the new `PATCH /api/profile/*` endpoints.

### `ui/auth.js`
- `requireAuth()` is now `async`. Before showing the login overlay, it attempts `Api.restoreToken()`. If a valid stored session is found, the overlay is skipped entirely and the token is returned immediately — no login required on refresh.
- Invite-link arrivals (`?invite=TOKEN`) still force the register tab as before; session restore is skipped in that case to avoid confusion.

### `ui/profile.js` (new)
- New `openProfile(Api, G, onLogout)` — renders a full-screen modal for account management:
  - **Account section** — read-only display of username, email, and member-since date.
  - **Finances section** — read-only balance, total earned, total invested, net P&L, and recruit count (fetched live from `GET /api/profile`).
  - **Change username** — updates the username; swaps the stored JWT for the new token returned by the server (keeps the username claim in sync).
  - **Change email** — update or clear email address.
  - **Change password** — requires current password; validated client-side before submitting.
  - **Log out** — clears token from memory and `localStorage`, then reloads the page.
- Consistent with existing game aesthetic (dark background, gold monospace, `--gold` / `--tan` palette).

### `main.js`
- Imports and exposes `window.openProfile`.
- After successful login the `◈ PROFILE` button in the title bar is made visible.

### `index.html`
- Added `◈ PROFILE` button (`#profile-btn`) to the right side of the title bar. Hidden until the user is authenticated.

### `style.css`
- `#title-bar` gains `position: relative` to anchor the absolutely-positioned profile button.

---

## v1.25 — Backend owns payout config; client-side rate editor removed


> *Payout parameters are no longer user-configurable in the frontend. The ⚙ TUNE RATES panel has been removed. On login, the frontend fetches the authoritative values from `GET /api/config` and uses them for all display and calculations.*

### `game/config.js`
- Mutable `CFG` export removed entirely.
- New `loadConfig(Api)` — async, fetches `GET /api/config`, populates internal `_cfg`. Call once after login.
- New `getCFG()` — returns a read-only snapshot of `_cfg`. Use wherever `CFG.*` was used before.
- `payoutAtDepth()`, `maxPayDepth()`, `totalPool()` unchanged in API; now read from `_cfg` instead of the old exported object.

### `ui/config-editor.js`
- `openConfig`, `closeConfig`, `validateConfig`, `applyConfig` all deleted.
- Only `renderPayoutTable()` remains. Updated to call `getCFG()` for platform fee and entry fee display rows.

### `game/recruits.js`
- Import updated: `CFG` → `getCFG`.
- All `CFG.entryFee` / `CFG.platformFee` usages replaced with `getCFG().entryFee` / `getCFG().platformFee`.

### `main.js`
- Dead imports (`openConfig`, `closeConfig`, `validateConfig`, `applyConfig`) removed.
- Dead `window.*` assignments for those functions removed.
- `init()` now calls `await loadConfig(Api)` then `renderPayoutTable()` after login (before loading game state). Guest path falls through to `updateStats()` as before.
- `scheduleSyncState()` now only sends `{ flags }` — `bought`, `earned`, `invested`, `invites_left` were removed (server-owned, rejected by `PUT /api/state`).
- `beforeunload` beacon updated to match: only sends `{ flags }`.

### `index.html`
- `⚙ TUNE RATES` button removed from the payout rates panel.
- Entire `#cfg-panel` div removed.

### `style.css`
- Removed dead rules: `.cfg-btn`, `.cfg-btn:hover`, `#cfg-panel`, `#cfg-panel.show`, `#cfg-panel h3`, `.cfg-row`, `.cfg-row label`, `.cfg-row input`, `.cfg-note`, `#cfg-valid`.
- Removed `--cfg-btn-hover` CSS variable.

### `ui/modal.js`
- Removed orphaned `Escape` key handler that hid `#cfg-panel` (element no longer exists).

---



> *Removes mock recruits for authenticated users. Recruits now arrive in real-time via WebSocket when real users in your downline buy in. The SEND SCROLL button sends an actual invite email.*

### `game/ws.js` (new)
WebSocket client module.  Connects to `ws://host/ws?token=JWT` after auth, auto-reconnects with exponential back-off, sends keep-alive pings every 25 s.  Dispatches all server events onto the `Events` bus as `ws:<type>`.  Singleton exported as `gameSocket`.

### `main.js`
- `gameSocket.connect(token)` called after login.
- `ws:recruit_joined` → calls `addRecruit(name, depth, parentRec, { dbId })` so the pyramid appears in the world in real time.
- `ws:state_update` → updates `G.bought`, `G.earned`, `G.invitesLeft` and re-renders HUD.
- `ws:invite_accepted` → logs that an invitee has registered; refreshes invite panel.
- Loads and renders the invite panel (`Api.getInvites()`) immediately after login.

### `game/recruits.js`
- **`addRecruit(name, depth, parentRec, opts = {})`** — accepts optional `opts.dbId`. After slot assignment, calls `Api.patchRecruitMeta(dbId, layout)` so the server record gets the visual coordinates. No longer calls `Api.saveRecruit` (removed — server creates Recruit rows during buy-in).
- **`recruitFriend()`** — for authenticated users: opens the `showPrompt` email modal, calls `Api.sendInvite(email)`, updates `G.invitesLeft` from the server response, refreshes the invite panel. Guest/demo mode unchanged (random-name mock recruit).
- **`scheduleSubRecruits`** — returns immediately for authenticated users. Mock cascading recruits are guest-only demo behaviour. Real sub-recruits arrive from the server when real chain members buy in.
- **`buyIn()`** now calls `Api.buyIn()` for both auth'd and guest users (guest still works via stub path).

### `game/api.js`
- `sendInvite(email)` → `POST /api/invites`
- `getInvites()` → `GET /api/invites`
- `patchRecruitMeta(dbId, layout)` → `PATCH /api/recruits/{id}/meta`
- `patch()` HTTP verb helper added.
- `saveRecruit()` removed (server-side responsibility now).

### `ui/modal.js`
- `showPrompt(title, body, placeholder)` — single-input modal returning a `Promise<string|null>`. Used by `recruitFriend()` for email capture.

### `ui/panels.js`
- `updateInvitePanel(invites)` — renders the "INVITES SENT" panel with email addresses and ✓ JOINED / ⏳ PENDING status badges.

### `ui/auth.js`
- Reads `?invite=TOKEN` from the URL on load.
- If present: auto-switches to the Register tab, passes `invite_token` in the register request.
- Clean registration URL: the `?invite=...` param stays in the address bar but doesn't affect gameplay.

### `index.html`
- Added `#invites-panel` / `#invite-list` section in the right panel (hidden until user has sent at least one invite).

---

## v1.23 — Backend state sync
## v1.22 — Terrain / Data / Draw Separation
