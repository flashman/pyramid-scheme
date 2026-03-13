# PYRAMID SCHEME™ — CHANGELOG

---

## v1.42 — THE DEEP: new realm, three gods, primordial lore

> *Below Atlantis. Below the city, the franchise, the myth. Four zones. Three gods. One tablet that was here before the gods. The pyramid does not end at the ocean floor.*

### New realm: `worlds/deep/`

The Deep is accessible through a crack in the Atlantis vault floor, revealed only after reading the deepest tablet. It extends 3,800 world-pixels down — twice the height of Atlantis — with four distinct zones, three god characters with full branching dialogue, one enemy type, a procedural Leviathan, and a primordial tablet at the bottom that predates everything above it.

#### `worlds/deep/constants.js`
- `DEEP_WORLD_W/H`, `DEEP_ENTRY_Y`, `DEEP_EXIT_Y`, `DEEP_FLOOR_Y`
- Zone boundaries: `SHELF_END` (900), `FRANCHISE_END` (1900), `PELAGIC_END` (3000); Zone IV (The Abyss) is 3000–3800
- NPC positions: `HERALD_WX/WY`, `HIERARCHY_WX/WY`, `POSEIDON_WX/WY`, `OKEANOS_WX/WY`, `PRIMORDIAL_WX/WY`
- Angler constants: `ANGLER_POSITIONS` (3 spawn points), `ANGLER_AGGRO`, `ANGLER_SPEED`, `ANGLER_CHASE_SPD`, `ANGLER_HURT`
- Leviathan bounds: `LEVIATHAN_Y_MIN/MAX`, `LEVIATHAN_HURT_RANGE`
- Physics: `SWIM_ACC=0.38`, `SWIM_DRAG=0.89`, `SWIM_MAX_SPD=5.5`, `SWIM_BUOY=-0.02` (slightly heavier than Atlantis)

#### `worlds/deep/DeepRealm.js`
Extends `FreeMoveRealm`. Full realm with HealthSystem, InteractableRegistry, 3 anglers, Leviathan, and 4 interactable entities.

**Four zones:**
| Zone | Depth | Character |
|---|---|---|
| I — The Shelf | Entry–900 | Atlantean debris sinking through the dark. The Herald waits here — a bioluminescent ancient creature that has watched every civilisation arrive from above. |
| II — The Franchise Office | 900–1900 | Poseidon's domain. Stone walls carved with the divine org chart. He's still filing quarterly reports on Atlantis sinking. He has opinions. |
| III — The Pelagic | 1900–3000 | Okeanos drifts here as a vast, barely-visible coiled presence. Pre-franchise, pre-everything. He does not file reports. He does not respond to memos. |
| IV — The Abyss | 3000–3800 | No zone label. A dim light that is not bioluminescent. The primordial tablet rests in the floor sediment. Below the tablet: the Leviathan occasionally passes. |

**Three NPCs:**
- **The Herald** (Zone I) — 7-node branching dialogue. Watched Atlantis rise and sink. Watched Khem-Atef arrive in a small wooden boat with a stylus and a clean piece of clay. Has no tier and no name. "Names are how they track you."
- **Poseidon** (Zone II) — 8-node branching dialogue. Tier 7, Sea Franchise #1. Built Atlantis for love (concentric rings for Kleito); someone turned the shape into a system; he has been thinking about this for twelve thousand years. Still filing compliance forms on a stone clipboard. His trident has a KPI tracker.
- **Okeanos** (Zone III) — 6-node branching dialogue. Tier 12, pre-franchise. Spoke in geological time. Was the ocean before oceans had a name. Has received 11,462 compliance memos from Poseidon. Has not responded to any. Deeply envied by Poseidon.
- **Primordial Tablet** (Zone IV) — one-shot read. Inscription in no known language and yet the player can read it. "THE SHAPE PRECEDES THE HAND THAT DRAWS IT. THE PYRAMID PRECEDES THE DESERT. THE OCEAN PRECEDES THE PYRAMID. SOMETHING PRECEDES THE OCEAN... IT MIGHT BE YOU. HELLO. PASS IT ON."

**Enemies:**
- **Anglers** (3, Zones II–III) — bioluminescent ambush hunters. Lure orb is teal when idle, red when chasing. Passive once Poseidon acknowledges the player (`poseidon_spoken`). Drive-by aggression only — `aggressiveFn` gates chase entirely after Zone II. Rendered by `drawAngler()` in the draw file with articulated teeth, dorsal spine, pectoral fins.
- **The Leviathan** — not a standard enemy; a procedural presence. Begins passing through Zones III–IV after a 45-second grace period on entry. 1800px body, semi-transparent, barely visible. Multiple eyes. Periodic passes at random intervals (28–48 seconds). Reverses direction each pass. Hurt range 120px×72px. Death message: "LEVIATHAN IS NOT PART OF THE SYSTEM. LEVIATHAN IS WHY THERE IS A SYSTEM."

**Death messages** — 3 causes (`angler`, `leviathan`, `pressure`), 3–4 messages each, escalating milestones at death counts 4/8/12. All thematically consistent: the angler messages frame attraction to the lure as a transaction; the leviathan messages situate it as pre-systemic; the pressure messages are the quiet existential ones.

**Zone entry logs** — four distinct log sequences as the player crosses each zone boundary, each setting a `_zoneLogged` flag to fire only once per dive.

**Flags set:**
- `deep_visited`, `deep_deaths`, `deep_herald_spoken`, `deep_herald_lore`, `deep_herald_below_known`, `deep_herald_atlantis`
- `poseidon_spoken`, `deep_poseidon_office`, `deep_poseidon_atlantis`, `deep_poseidon_rings`, `deep_poseidon_upline`, `deep_poseidon_responsible`, `deep_poseidon_send_down`, `deep_poseidon_okeanos`
- `okeanos_spoken`, `okeanos_what_known`, `okeanos_atlantis`, `okeanos_scheme`, `okeanos_below`, `okeanos_tablet_known`
- `deep_primordial_read`

**Exit:** `[↑]` above `DEEP_EXIT_Y` → transition back to `atlantis` via `deepTransRender`.

#### `worlds/deep/draw/deep.js`
Full visual implementation. All world-space drawing happens under `X.translate(-camX, -camY)`.

- `drawWaterBg(camY)` — gradient from near-black at shallow to absolute void at floor; deepens as camera descends
- `drawZoneAtmosphere(camY)` — faint colour overlay per zone (deep blue → dark purple → near-void → black)
- `drawBioglints(t)` — 90 pre-generated bioluminescent particles scattered across the full world height; six colours; pulsing phase-offset glow with `shadowBlur`
- `drawDebris(t)` — 30 Atlantean stone fragments in the Shelf zone; drifting side-to-side based on depth and sine time
- `drawShelf(t)` — fallen arch sections from Atlantis above; stone slabs at zone boundary; the Herald rendered as an elongated bioluminescent dolphin-form with etched markings, ancient eye, and aura glow
- `drawFranchiseOffice(t)` — faint stone walls; the Hierarchy Tablet (org chart stone: Tier ∞/12/8/7/4/1/0 with labels, connecting lines); office floor tiles; calls `drawPoseidon(t)`
- `drawPoseidon(t)` — full character: bureaucratic throne with carved tier symbols and arm rests; massive seated figure with weathered bronze skin, long tangled beard (with individual beard lines), star-crowned tiara, trident with KPI glow; stone clipboard on lap with Q3 report; nameplate below
- `drawPelagic(t)` — three hydrothermal vents with superheated plumes (animated particles); calls `drawOkeanos(t)`
- `drawOkeanos(t)` — five concentric vortex rings rotating slowly; a vast partially-visible coiled serpentine body (90px stroke); scale detail on coil; single eye visible on the rotating arc with vertical pupil slit; nameplae
- `drawAbyss(t)` — absolute floor sediment; calls `drawPrimordialTablet(t)`
- `drawPrimordialTablet(t)` — dim purple glow; inscribed text visible only after `deep_primordial_read`; pre-read state shows only eroded marks
- `export drawAngler(angler, camX, camY, t)` — full character: dark elliptical body, teeth (gap scales with `angler.chasing`), dorsal spine, lure orb (teal/red with `shadowBlur` halo and inner bright spot), yellow eyes, pectoral fins; flipped by `angler.facing`
- `export drawLeviathan(realm, camX, camY, t)` — 1800px semi-transparent body; scale pattern; four eye positions; visibility fades in/out as Leviathan enters/exits; controlled by `realm._leviathan.visibility`
- `drawDeepSwimmer(realm)` — swimming pharaoh identical to Atlantis but with depth-proportional purple pressure aura
- `drawDeepSurface(camX, camY)` — entry shimmer at world top
- `drawInteractHint(realm)` — four entity labels (Herald, Poseidon, Okeanos, primordial tablet)
- `drawDeepHUD(realm)` — depth, zone name, dissolution counter, controls legend
- `drawDeathOverlay(realm, t)` — dark blue death colour scheme (distinct from Atlantis)
- `drawImmunityFlash(realm)` — dark blue immunity tint

---

### Modified files

#### `worlds/atlantis/AtlantisRealm.js`
- **Deepest tablet updated:** first read now fires a delayed sequence that sets `atlantis_crack_visible` (10.5s in) and logs the crack appearing in the vault floor; repeat reads include a reminder about the crack
- **New entity: vault crack** at `(TABLET_WX + 80, ATLANTIS_FLOOR_Y - 18)` — inactive until `atlantis_crack_visible`; Space to inspect, Down to descend
- **New key handler:** `ArrowDown/S` near the crack while `atlantis_crack_visible` → `scheduleTransition('deep', { duration: 1800, render: deepTransRender })`
- Imports: `ATLANTIS_FLOOR_Y` added from constants; `deepTransRender` added from transitions

#### `worlds/atlantis/draw/atlantis.js`
- **`drawVaultCrack(t)`** (new) — only renders when `atlantis_crack_visible`; jagged crack line through the vault floor; purple glow bleeding upward; `[↓] THE DEEP` label above; called in main draw after `drawNameAlcove(t)`
- Imports: `TABLET_WX`, `ATLANTIS_FLOOR_Y` added from constants
- **Interact hints** updated: `vault_crack: '[↓] DESCEND INTO THE DEEP'` added to the label map

#### `worlds/transitions.js`
- **`deepTransRender(progress)`** (new) — crack-light phase (purple flare from bottom, crack line spreading across screen), then absolute void collapse. Reversed for the ascent (same function, water → void → crack light → back to Atlantis).

#### `audio/sound.js`
- **`deep` theme** added (34 bpm — the slowest theme in the game):
  - Sub-bass rumble: noise → bandpass 82Hz Q=0.28, reverb — the sound of geological pressure
  - Void shimmer: noise → bandpass 7800Hz Q=1.4, reverb — near-ultrasonic hiss
  - Single bass note: D1 (36.71 Hz), surfaces once per 32-beat loop then disappears — "an event, not a melody"
  - One voice: A3 bandpass, appears once per loop like a question, then 16 beats of silence
- **D1 (36.71 Hz)** and **Eb1 (38.89 Hz)** added to the note table (sub-bass octave 1)
- `REALM_THEME` mapping updated: `deep: 'deep'`

#### `main.js`
- `DeepRealm` imported from `worlds/deep/DeepRealm.js`
- `.register(new DeepRealm())` added to the realm chain

---

---

## v1.41 — Atlantis: audio redesign, death counter reset, greeter/tablet lore expansion

> *The Atlantis theme is no longer a melody. It's pressure. The death counter resets on each dive. The Greeter now knows the system's prior upline. The deepest tablet now ends at the ocean — as a door, not an answer.*

### `audio/sound.js`
- **Atlantis theme rebuilt** from D Dorian melodic (88 BPM) to D Phrygian ambient soundscape (52 BPM). Five tracks:
  - Deep ocean rumble: noise → bandpass 210Hz Q=0.35, reverb — the pressure of fathoms
  - Surface shimmer: noise → bandpass 3100Hz Q=1.1, reverb — light through water
  - Sparse sine bass: D Phrygian root movement, very long rests, reverb — "like the city breathing"
  - Barely-there lead: isolated sine notes, slow vibrato (rate 1.6, depth 4), lots of silence
  - High sparkle: single notes every ~8 beats, bandpass 2000Hz, reverb — light shafts
- Engine: `_scheduleTrack()` gains `wave: 'noise'` support. Creates looping 2.7s white noise buffer, routes through bandpass filter + gain envelope. `reverb: true` property added to tracks.

### `worlds/atlantis/AtlantisRealm.js`
- **Death counter reset on entry:** `Flags.set('atlantis_deaths', 0)` added to `onEnter()`. Atlantis deaths are now per-dive, not per-session.
- **Greeter "clarify" dialogue expanded:** now mentions the prior upline chain — "THE FOUNDER RECEIVED THE SYSTEM / FROM ONE WHO ARRIVED BY SEA. / THE ONE BY SEA HAD IT FROM SOMEONE OLDER. / EVERY SYSTEM HAS A PRIOR UPLINE."
- **Archive completion log updated:** threshold `>= 3` tablets, door message "Three tablets."
- **Deepest Tablet** — ending lines added after "THE SYSTEM IS THE UPLINE / PASS IT ON": "AND BELOW THE SYSTEM? / THE OCEAN. / THERE IS ALWAYS AN OCEAN." Ends here — a door, not an answer.

---

---

## v1.40 — Engine abstraction pass: FreeMoveRealm, HealthSystem, TimedHazard, FreeRoamEnemy

> *Four new engine modules extract the physics, damage, hazard, and enemy AI that were inline in AtlantisRealm into reusable, game-agnostic systems. No gameplay changes. The refactored AtlantisRealm is ~200 lines shorter and every new underwater world gets these systems for free.*

### New files

#### `engine/freemove.js` — `FreeMoveRealm`
Base class for freely-swimming, 2D-scrolling underwater worlds. Extends `Realm`.

- `_moveStep(ts)` — one call advances 2D physics (yDrift + input acceleration + drag + speed cap + bottom bounce), updates walk animation frame clock, clamps player to world bounds, tracks camera in X and Y, and syncs everything to G. Replaces ~60 lines of inline physics in AtlantisRealm.
- `_syncCamera()` — lerps camera toward player in both axes, clamped to world bounds. Callable standalone during death/frozen states.
- `_syncToG()` — writes `px/py/pvx/pvy/camX/camY/facing/pmoving/pframe` → G so the HUD always sees current state.
- `getPlayerPose()` — standard pose object for `drawRealmPharaoh(realm)`.
- `_aboveSurface()` — returns `true` when `py ≤ surfaceExitY`; use in `onKeyDown` to gate the "swim up → exit realm" transition.
- `resetToEntry(jitter)` — teleports player to the entry point with zeroed velocity; intended for respawn callbacks.
- Constructor options: `worldW`, `worldH`, `entryX`, `entryY`, `floorY`, `surfaceExitY`, `physics: { acc, drag, maxSpd, yDrift }`.

#### `engine/health.js` — `HealthSystem`
Standalone player damage / death-screen / respawn / immunity system. No realm inheritance required — any realm can own one.

- `kill(cause, msg)` — sets dying state, fires `onKill(cause, msg)` callback immediately.
- `update()` — call at top of `realm.update()`; returns `true` while dying (realm should skip normal update). Fires `onRespawn()` once the `respawnDelay` elapses and resets immunity timer.
- `canTakeDamage()` — `true` when not dying and not immune; check before calling `kill()` from enemy/hazard code.
- `setImmunity(ms)` — grants temporary invincibility (call from `onEnter()` to prevent spawn-kills).
- Getters: `isDying`, `deathMsg`, `deathCause`, `deathElapsed` (ms since kill, for death-screen fade), `progress` (0–1 fraction toward respawn).

#### `engine/hazard.js` — `TimedHazard`
Circular world-space zone where standing still for too long has consequences. Generalises the choir mechanic.

Two modes, switchable at runtime via `setMode()`:
- **Danger mode** (`surviveDuration = null`): player must leave within `dangerDuration` ms or `onDanger` fires.
- **Survival mode** (`surviveDuration > 0`): player must stay the full duration; `onSurvive` fires once, then zone becomes inert.

AtlantisRealm initialises the choir as danger mode, then calls `choir.setMode({ surviveDuration: 5000, onSurvive: … })` once `atlantis_cleared` is true — the mode switch is idempotent and happens transparently mid-session.

Getters: `isInside`, `elapsed` (ms since entry), `progress` (0–1, useful for vignette opacity).

#### `FreeRoamEnemy` added to `engine/entity.js`
2D underwater enemy. Extends `Entity`. Replaces the three anonymous enemy structs and `_updateEnemies()` in AtlantisRealm.

Two chase styles:
- `'direct'` — constant-speed steering toward the player each frame (shark, devoted: snappy, responsive).
- `'momentum'` — accumulates velocity with a max-speed cap (squid: heavy and inevitable).

Key options:
- `patrolBounds: { x1, x2, y }` — horizontal patrol bounce when idle (shark).
- `driftFreq / driftAmp / driftSpeed` — sinusoidal ambient drift when idle (squid, devoted).
- `aggressiveFn: () => bool` — gates chase entirely (squid → passive when CLEARED; devoted → passive when name known).
- `aggroZoneY` — player must be above this Y to trigger aggro (shark only chases in zones 1–2).
- `zoneBounds: { yMin, yMax }` — keeps enemy inside its vertical zone.
- `drawFn: (enemy, sx, sy, ts) => void` — optional inline renderer, called by `draw()`.
- `hurtCheck(px, py)` — returns true only when chasing and within `hurtRange`.
- `update(ts, px, py)` — full AI tick; call from realm `update()`.

Also: `drawFn` option added to the existing `Enemy` class and `draw(sx, sy, ts)` now calls it — fixes the long-standing no-op `draw()` stub.

---

### Modified files

#### `engine/flags.js`
- Added `Events.on('flag:change', () => QuestManager.check())` at module level.
- **`QuestManager.check()` now fires automatically** after every `Flags.set()`, `Flags.inc()`, and `Flags.toggle()` call.
- Removes the need for the 10+ scattered manual `QuestManager.check()` calls that were spread across realm code, dialogue `onEnter` callbacks, and entity `onInteract` handlers. Callers that still call it explicitly are harmless (check is idempotent).

#### `draw/hud.js`
- `drawParts(camX = G.camX)` — added explicit `camX` parameter (defaults to `G.camX` for backward compatibility with WorldRealm).
- Fixes the long-standing bug where particles emitted in non-world realms (atlantis, oasis) rendered at the wrong screen position because `drawParts()` always subtracted `G.camX` which holds a stale world-realm value during realm transitions.
- Non-world realms should now call `drawParts(this.camX)` to pass their own camera offset.

#### `worlds/atlantis/AtlantisRealm.js`
- Now extends `FreeMoveRealm` instead of `Realm`.
- Swim physics loop (`~60 lines`) replaced by `this._moveStep(ts)`.
- `_syncCamera()` / `_syncToG()` / `getPlayerPose()` removed — provided by `FreeMoveRealm`.
- `_killPlayer()` / `_respawn()` / `_immuneUntil` (`~30 lines`) replaced by `this.health = new HealthSystem(…)`.
- `_updateEnemies()` (`~80 lines`) replaced by `FreeRoamEnemy` instances (`this.shark`, `this.squid`, `this.devoted[]`) with `update(ts, px, py)` and `hurtCheck(px, py)` called from `update()`.
- Choir circle timer logic (`~30 lines`) replaced by `this.choir = new TimedHazard(…)` with `choir.setMode()` called once when `atlantis_cleared` becomes true.
- Net reduction: ~200 lines. Dialogue content, entity interactions, zone-entry logs, and render call are **unchanged**.
- All `QuestManager.check()` calls removed from dialogue `onEnter` callbacks (now auto-fired by `flag:change`).

---

## v1.39 — Atlantis: full game loop, puzzles, and richer dialogue

> *The city now has a reason to explore. Every piece of lore pays off mechanically. Every gate opens with knowledge, not arbitrary progress. The Founder has a name. The name is earned.*

### Game loop

```
PILLAR → GREETER (Tier 1) → TESTIMONIALS (5 plaques, zones 1–2)
→ Testimonial 2 has the keyword: "ASCENSION AWAITS THE BELIEVING HEART"
→ Return to Greeter with keyword → Tier 3 + hint about audit chair
→ PROCESSING CHAIR (zone 3): 3 questions, answers earned by exploration → CLEARED
→ CLEARED unlocks: squid becomes non-aggressive + Archive Door opens
→ ARCHIVE (zone 3, far west): 3 tablets — pre-Founder civilization, same system
→ CHOIR (zone 4): if CLEARED, survive 5s → name alcove opens
→ NAME TABLET: Founder's real name was KHEM-ATEF, a scribe, age 23, terrified
→ FOUNDER with name: drops the performance, raw confession
→ DEEPEST TABLET: final revelation, hits harder now
```

### New interactables (9 added)

- **5 testimonial plaques** (zones 1–2) — carved stone plaques scattered through the city. Each tells a story. Testimonial 2 (Compliance Officer Taweret, Tier 7) contains the keyword. Testimonials 2 and 3 hint at the archive. Visual state: unread (dark) / read (glowing, with tier badge).
- **Processing Chair** (zone 3, wx=900) — the special audit chair. Glows cyan when Tier 3 (accessible), green when Cleared. Floor runes pulse beneath it. Locked to Tier 3+ with clear error messages.
- **Archive Door** (zone 3 far west, wx=185) — a sealed stone door. Shows compliance lock symbol. Opens on CLEARED. Animated door-glow when open.
- **3 Archive Tablets** inside the archive chamber — records of the Khet-Amun civilization that preceded Atlantis and used the same system. Each flagged individually. Chamber only illuminated when `atlantis_archive_open`.
- **Name Tablet** (zone 4, east of choir, wx=1750) — sealed alcove with barely-visible hairline crack. Opens only after `atlantis_choir_survived`. Contains Compliance Officer's private record: the Founder's birth name.

### Dialogue rewrites

**Greeter** — fully rebuilt with dynamic `text: () => ...` and conditional branches:
- First visit: enrollment flow (unchanged)
- Return visit (enrolled, no keyword): hints at the plaques
- Return visit (keyword found): tier upgrade to 3, tells you about the Processing Chair and what the three questions will be
- Return visit (Tier 3, not cleared): reminds you about the audit
- Return visit (Tier 3, cleared): tells you about the archive

**Audit Dialogue** (new, 11 nodes):
- Three questions with choices. Correct answers require actual exploration:
  - Q1: requires reading the welcome archway text in the Atrium
  - Q2: requires having spoken to the Greeter (conditional choice — doesn't appear if not enrolled)
  - Q3: requires having spoken to the Greeter (same condition)
- Wrong answers flag the account but let the session continue
- Verdict node: `text: () => ...` dynamically reads flag score (0/1/2/3 correct)
- Score 3 → CLEARED, archive opens; score < 3 → retry message with specific hint

**Founder Dialogue** — rebuilt with two parallel paths:
- Without `atlantis_founder_name`: original mysterious version (7 nodes)
- With `atlantis_founder_name` (KHEM-ATEF): completely different path (5 nodes). No performance. Drops "Tier ∞" title. Admits he was twenty-three. Admits he followed instructions because it was easier than not. The final line: *"You found the room. You are reading the documents. I wonder what that makes you."*

### Mechanic changes

**Squid aggression** — The Auditor squid is now only aggressive when `!atlantis_cleared`. When cleared, it drifts passively. Getting cleared changes Zone 3 from dangerous to navigable.

**Devoted aggression** — The Devoted are only aggressive when `!atlantis_founder_name`. When you know the Founder's real name, they drift past harmlessly. Their arms are still outstretched. But they don't pursue.

**Choir mechanic** — Two modes:
- Without `atlantis_cleared`: 2.4s → death (unchanged)
- With `atlantis_cleared`: 5s survive → `atlantis_choir_survived` + name alcove opens, no death

### New draw functions

- `drawTestimonialPlaques(t)` — 5 plaques with carved inscription lines, read/unread states, tier badges, subtle shimmer when unread
- `drawAuditChair(t)` — the special processing chair with state-dependent colour (dark/cyan/green), floor runes, carved tier symbol
- `drawArchiveRoom(t)` — the archive chamber (zone 3 far west): stone walls, door frame, lock symbol, 3 tablets inside (only visible when open)
- `drawNameAlcove(t)` — sealed/open alcove east of choir; hairline crack when sealed, purple glow and inscription when open

### HUD updates

- CLEARED status shown top-right in green when active
- Plaque count shown top-right when plaques found but not yet cleared
- Interact hints updated for all 9 new entity IDs (context-sensitive: chair shows "YOU ARE ALREADY CLEARED" when done, door shows "THE ARCHIVE IS OPEN" when open, etc.)

---

## v1.38 — Atlantis world expansion: five zones, three predators, the drowned org chart

> *Atlantis didn't sink because of the sea. It sank because of its own system. The civilization was a multi-level ascension cult — equal parts Scientology, Heaven's Gate, and a property investment seminar. Every citizen was a recruit. They went deeper and deeper to prove their devotion. The flood came. Nobody swam up. They were still waiting for their upline to tell them it was okay to leave. The city is a drowned org chart.*

### Summary

Full Atlantis world replaced with five depth-stratified zones, three enemy types, cult NPC dialogues, a death and reincarnation system with 20+ escalating messages, and a full 5-zone architectural draw overhaul. The core revelation: the Founder found the system already built, already ancient, already furnished with a throne. They added their layer on top. As did whoever came before. As does the player.

---

### `worlds/atlantis/constants.js` (rewritten)

**Added:**
- `ZONE_1_END / ZONE_2_END / ZONE_3_END / ZONE_4_END` — Y-axis zone boundaries
- `GREETER_WX/WY`, `PILLAR_WX/WY`, `FOUNDER_WX/WY`, `TABLET_WX/WY` — NPC / interactable positions
- `CHOIR_WX/WY`, `CHOIR_RADIUS` — death-circle centre and radius (zone 4)
- `SHARK_PATROL_Y/X1/X2`, `SHARK_SPEED/CHASE_SPD/AGGRO/HURT` — Compliance Shark parameters
- `SQUID_START_WX/WY`, `SQUID_SPEED/CHASE_SPD/AGGRO/HURT` — Auditor squid parameters
- `DEVOTED_SPEED/AGGRO/HURT` — Devoted skeletal swimmer parameters

---

### `worlds/atlantis/AtlantisRealm.js` (rewritten)

#### Five zones
| Zone | Depth | Character |
|---|---|---|
| I — The Atrium | Entry | False welcome. A 12,000-year-old skeleton still at the reception desk. |
| II — The Abundance Hall | Mid-shallow | Gold-painted columns. The paint is visibly flaking. |
| III — The Processing Chamber | Mid | Rows of seated skeletons facing The Auditor face. The Auditor squid lives here. |
| IV — The Devoted Quarter | Deep | Founder portraits on every surface. The Choir circle. |
| V — The Founder's Vault | Deepest | A throne. A cage locked from the inside. The skeleton of the Founder, still crowned, still waiting. |

#### Three enemies
- **Compliance Shark** — patrols zones 1–2. Chases on proximity. Accelerates toward player when aggroed. Red eye-glow when chasing. Death message: recruitment/collections language.
- **The Auditor** (giant squid) — zones 2–3. Slow ambient drift; accelerates to inevitable pursuit on aggro. Wide rectangular pupils (like a real squid). Death message: scientology-adjacent processing language.
- **The Devoted** (3 skeletal swimmers) — zones 4–5. Arms permanently outstretched toward the player. Drift slowly when idle, pursue when in range. Death message: well-meaning harmonization language.

#### Choir hazard (zone 4)
- Entering the circle in the Devoted Quarter begins a 2.4-second countdown
- On-screen warning and red vignette builds during countdown
- Escaping the circle in time cancels the timer
- Staying the full duration: choir death

#### Death and reincarnation system
- `_killPlayer(cause)` called by all four hazards — increments `atlantis_deaths`, sets `_dying`, freezes player
- 2.8-second death screen: white flash → settles to deep void → message appears
- Death messages are tiered by death count and cause:
  - Deaths 1–4: cause-specific messages (shark = collections; squid = processing; devoted = harmonizing; choir = devotion)
  - Deaths 5/10/15/20: milestone messages that override cause ("TIER 3 ACTIVITY", "PLATINUM TIER OF DYING", etc.)
  - After reading the deepest tablet: all deaths append *"YOU KNOW TOO MUCH. THE SYSTEM CANNOT ALLOW A CLEAR WHO UNDERSTANDS THE SYSTEM."*
- Respawn: player returns to `ATLANTIS_ENTRY_Y` at world centre with short log; message changes with death count

#### NPC dialogues
**The Greeter** (`GREETER_WX/WY`, zone 1):
- 7-node branching dialogue
- Admits it has waited 12,000 years for a prospect
- Offers to enrol you regardless of your answer (the choice is cosmetic)
- Waives the enrolment fee. "Today only. It has been today only since 9,800 BC."
- Sets `atlantis_recruited`, sets `atlantis_tier = 1`, logs tier enrollment

**The Founder** (`FOUNDER_WX/WY`, zone 5, behind the cage):
- 8-node linear dialogue
- Charismatic, self-justifying, gradually honest
- Reveals: they found this room already built, already furnished with a throne, already containing a tablet describing their system exactly
- Directs player to the deepest tablet. Sets `atlantis_founder_read`

**The Deepest Tablet** (`TABLET_WX/WY`, zone 5):
- Locked behind `atlantis_founder_read` flag — shows generic "worn inscription" text before founder dialogue
- First read: screen shake 14, 5-part revelation log sequence over 5.6 seconds
- Sets `atlantis_deepest_tablet`
- Core text: *"WE DID NOT INVENT THIS. WE FOUND THEIR SYSTEM. THE PYRAMID GOES DEEPER THAN THE OCEAN. THERE IS NO UPLINE. THERE NEVER WAS AN UPLINE. THE SYSTEM IS THE UPLINE. PASS IT ON."*

**Welcome Pillar** (`PILLAR_WX/WY`, zone 1):
- One-shot readable: the founding doctrine carved in stone
- "THIS IS NOT A PYRAMID SCHEME. THE PYRAMID IS A SYMBOL OF ASCENSION. THE SCHEME IS THE PATH. THESE ARE DIFFERENT THINGS."
- After first read, revisiting gives: "THE PILLAR STILL SAYS WHAT IT SAYS."

#### Flags added
- `atlantis_recruited` — Greeter added you to the downline
- `atlantis_tier` — numeric (starts at 1)
- `atlantis_pillar_read` — read the welcome pillar
- `atlantis_founder_read` — completed the Founder dialogue
- `atlantis_deepest_tablet` — read the final truth
- `atlantis_deaths` — counter (drives escalating death messages)
- `atlantis_zone2/3/4/5` — first-entry logs per zone

#### Zone HUD
- Depth indicator updated with zone name label (replaces plain depth only)
- Tier indicator top-right when enrolled
- Death counter top-right when > 0
- Interactable hint bar shows context label per entity (`[SPACE] READ THE TABLET`, etc.)
- Choir warning vignette with countdown text

---

### `worlds/atlantis/draw/atlantis.js` (major expansion, ~1000 lines added)

#### Zone atmosphere system
`drawZoneAtmosphere(camY)` — screen-space colour overlay that bleeds in per zone:
- Zone 1: cold blue-white (welcoming, false)
- Zone 2: false gold (fading)
- Zone 3: sickly green
- Zone 4: crimson
- Zone 5: deep void purple — near black

#### New draw functions
- `drawAtrium(t)` — welcome archway above greeter; reception desk with stacked applications; Greeter skeleton (outstretched arm swaying, enthusiasm-glow eyes); Welcome Pillar (animated sway, carved doctrine text)
- `drawAbundanceHall(t)` — four gold-painted columns with visible flaking patches; a collapsed Abundance Zone archway; a fallen keystone
- `drawProcessingChamber(t)` — two rows of stone chairs with seated skeletons (some empty — they ascended); The Auditor Face carved into a massive wall slab (pulsing eye-sockets, no mouth, inscription)
- `drawDevotedQuarter(t)` — six Founder portrait plaques on every surface; the floor ring of 12 skeletal figures in the Choir circle (arms outstretched inward, swaying, devotion-red eye glow); animated centre glow
- `drawFounderVault(t)` — tiled throne room floor; the cage (vertical bars, inside lock); throne (tier symbols carved into back); Founder skeleton slumped but crowned (glow in eye sockets); the Deepest Tablet (half-buried, inscription glow that intensifies after reading)
- `drawShark(shark, camX, camY, t)` — torpedo body, white underbelly, dorsal fin, teeth visible when chasing, red eye when chasing, red glow aura when chasing
- `drawSquid(squid, camX, camY, t)` — large elliptical mantle, 8 animated arm-tentacles, 2 long grasping tentacles, chromatophore spots pulsing when chasing, rectangular pupils when chasing (biologically accurate), iris glow
- `drawDevoted(d, camX, camY, t)` — horizontal skeleton swimmer, arms permanently outstretched forward, ribs/spine visible, red devotion glow in eye sockets, carved cult markings on bones, gentle ambient sway
- `drawInteractHint(realm)` — pulsing screen-space prompt per nearest entity ID
- `drawDeathOverlay(realm, t)` — white flash → void → message with tiered text; tier label footer
- `drawChoirWarning(realm, t)` — red vignette + countdown text building over 2.4 seconds
- `drawAtlantisHUD(realm)` — zone name + depth + tier + death count + full control legend

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
