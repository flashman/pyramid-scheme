# The Sea Voyage — Design

**Date:** 2026-09-12 · **Branch:** `feat/sea-voyage` · **Status:** approved in brainstorming, awaiting spec review

## Goal

The pharaoh buys passage at the bazaar, boards a ship at the Nile Delta, and
sails a **WebGL open sea** toward Crete: real-time Gerstner waves with
physical buoyancy, a steerable ship that the wind and current keep pulling
toward Crete, and a storm brooding on the horizon that grows as you approach
(or stray). On arrival the ship moors in Crete's bay. Crete itself is a later
realm — this chapter is the voyage.

This realm deliberately does **not** follow the 2D pixel-art look or the
`SolidRealm`/`FlatRealm` approach of past realms.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Scope | Voyage only; Crete is a destination on the horizon, not a playable realm |
| Water | Gerstner waves + multi-point buoyancy; one wave source for GPU and CPU |
| Viewport | In-frame, 780×540, stacked under the existing 2D canvas |
| Course | Real sailing (rudder + sail trim); prevailing wind/current pull toward Crete; straying raises the storm |
| Length | ~3–5 min sailing reasonably straight |
| Gate | A bazaar keepsake, **Letter of Passage**, bought **once** (no per-voyage cost) |
| Content | Log narration, landmarks at sea, lightning/rain storm set-piece |
| Camera | Chase cam, low and behind the stern |
| Arrival | Moor in Crete's bay (session-only); sail out to go home |
| Turn back | Allowed any time via the Shipmaster menu; Letter is kept |
| Tech | Vendored three.js + import map; WebGL canvas behind a transparent 2D overlay |

## 1. Architecture & integration

### Rendering stack

- `index.html`: add `<canvas id="gl" width="780" height="540" hidden>` inside
  `#cc`, absolutely positioned at `#c`'s exact spot, beneath it. `#c` gets
  `position:relative; z-index:1`. The global `canvas{border…}` rule applies to
  both, so the borders line up.
- `#gl` is hidden (`el.hidden`) except while `sea` is the current realm.
- `#c` stays on top. `main.js` already `clearRect`s it to transparent each
  frame, so the ocean shows through, and everything the 2D canvas and DOM
  provide keeps working unchanged: `#dlg` dialogue, trigger hints,
  `drawParts`, transition wipes, `AstralSession.renderOverlay`, the `#sl`
  scanlines, the log/panels, mobile controls.
- `main.js` does not change.

### Modules — `frontend/worlds/sea/`

| File | Role | May import |
|---|---|---|
| `SeaRealm.js` | `Realm` subclass: lifecycle, input, narration dispatch, portals, dialogues. **No static three.js import.** | engine, game, ui, sibling pure modules |
| `waves.js` | **Pure.** Gerstner component params; `heightAt(x,z,t,s)`, `normalAt(x,z,t,s)`, `glslWaves()` (emits the shader's wave function from the same params). | nothing |
| `voyage.js` | **Pure.** Ship state + `stepVoyage(state, input, dt)`: wind, current, rudder, sail, buoyancy, distance to Crete, storm intensity, arrival/bay state. | `waves.js`, `constants.js` |
| `narration.js` | **Pure.** Event → lines table with per-event cooldowns; `pickNarration(events, now, memory)`. | nothing |
| `scene.js` | three.js scene: ocean mesh + shader, sky dome, clouds, lightning, rain, ship, landmarks, Crete, chase cam, perf fallback. Reads voyage state; owns no game logic. | `three`, `waves.js`, `constants.js` |
| `dialogue.js` | Shipmaster dialogues (boarding, at-sea menu, arrival, bay exit). | engine dialogue, flags, events, ui |
| `constants.js` | Crete position, bay radius, corridor widths, landmark positions, tuning, storm ramp. | nothing |

### Loading three.js

- Vendor one pinned release as `frontend/vendor/three.module.min.js` (~600 KB).
  Add an import map to `index.html` **before** `main.js`:
  `{"imports": {"three": "./vendor/three.module.min.js"}}`.
- No npm, no build step, no runtime CDN dependency — works offline in dev and on
  the Render static host.
- `SeaRealm` does `await import('./scene.js')` lazily; the rest of the game never
  fetches three.js. The Shipmaster dialogue starts the import when it opens so the
  scene is usually ready by the time the player boards.
- `worlds/manifest.js` keeps an eager `new SeaRealm()` (cheap — no three.js). The
  `REALM_CATALOGUE` entry carries `module`/`export`/`sort` so Phase 2b lazy loading
  picks it up with no further change.

### Lifecycle

- `constructor`: registers portals only. It touches no `three` import and no DOM
  (the manifest constructs every realm at boot, so a lookup here would cost every
  page load and a missing element would break boot).
- `onEnter(fromId)`: resolve `#gl` (first entry only), unhide it; if the scene isn't loaded yet, show a
  "the sails are being raised…" overlay on `#c` until it is; build the scene once
  and reuse it on later voyages; reset voyage state to the departure point.
- `update(ts)`: compute real elapsed `dt` (clamped to 0.1 s) and call
  `stepVoyage`. Never per-frame constants — Chrome Energy Saver caps at 30 fps.
- `render()`: `scene.render(voyageState)` to `#gl`; draw only overlays on `#c`
  (then `DialogueManager.render()`).
- `onExit()`: hide `#gl`, stop rendering to it. Scene and GPU resources persist.
- `getPlayerPose()`: returns `null` (base default). The pharaoh is a 3D figure in
  the scene; no `drawRealmPharaoh` path runs.
- **No WebGL** (`canvas.getContext('webgl2')` fails): boarding is refused in
  character by the Shipmaster and the player stays at the Delta.

### Realm graph

- The seeded `{from:'nile', to:'sea', key:null, condition:()=>false}` in
  `NileRealm`'s constructor is **edited in place** (not duplicated) into the live
  boarding edge, with a transition renderer. The old Nile plan's `crete` id is
  stale; the realm id is `sea`.
- `SeaRealm`'s constructor registers `sea → nile` (used by turn-back and bay
  exit).
- New engine helper `PortalRegistry.use(fromId, toId)`: fires a registered edge
  programmatically (runs `condition`, `onUse`, the transition), returning `true`
  if it fired. Needed because boarding is a dialogue choice, not a key press.

## 2. Sea simulation (`waves.js`, `voyage.js`)

All integration is **dt-based**; world units are meters.

### Waves

- 7 Gerstner components: 3 long swells aligned with the wind, 4 shorter chop
  waves spread within ±40° of it. Each: direction, wavelength, steepness `Q`,
  amplitude. Phase speed from deep-water dispersion, `c = √(g/k)`.
- A single **storm intensity `s ∈ [0,1]`** scales amplitude and steepness.
  Steepness is clamped so `Σ Qᵢ·kᵢ·Aᵢ ≤ 0.95` at every `s` (no looping crests).
- `glslWaves()` generates the vertex-shader wave function from the same param
  array. The GPU receives only `uTime` and `uStorm`. The CPU and GPU surfaces
  cannot drift.
- Gerstner displaces horizontally, so `heightAt(x,z)` solves for the undisplaced
  point with a 4-iteration fixed-point loop, then evaluates height there.

### Buoyancy

- Rigid body sampled at 5 hull points: bow, stern, port, starboard, center.
- **Heave:** spring-damper toward the mean sampled water height (plus draft).
- **Pitch:** angular spring-damper driven by bow − stern height difference.
- **Roll:** angular spring-damper driven by port − starboard difference, plus
  **heel** proportional to sail force (leans away from the wind).
- Fixed 1/120 s substeps inside a `dt` accumulator → identical motion at
  30/60/144 fps.

### Sailing

- **Rudder** (←/→): rudder angle eases toward input; turn rate ∝ speed × rudder
  (a stopped ship can't spin).
- **Sail trim** (↑/↓): 0 (furled) … 1 (full).
- **Wind:** prevailing wind blows roughly toward Crete. Drive =
  `sail × windSpeed × polar(angle between heading and wind)`: running downwind is
  fastest, a beam reach is strong, within ~40° of the wind the ship is **in
  irons** (≈ no drive). Quadratic water drag → speed converges to a terminal
  velocity.
- **Current:** constant drift vector toward Crete added to ground velocity.
- **Course pull:** inside a corridor around the Delta→Crete line the wind is
  steady and the player may tack and wander freely. Beyond the corridor the wind
  veers progressively toward the course line and storm intensity rises. Past an
  outer limit the sea turns the bow back (soft wall — a heading torque, never a
  hard stop).
- **Length:** Crete's bay ≈ 2.4 km from the departure point; ~10 m/s sailing
  reasonably straight ≈ 4 min. All tunable in `constants.js`.

### Storm intensity

- `target = progressRamp(distanceToCrete) + offCourseBonus(distanceFromLine)`,
  where the ramp is ≈ 0.1 at the Delta, ≈ 0.35 on the open sea, ≈ 0.75 on the
  approach under the storm's edge; clamped to [0,1].
- Eased with `s += (target − s)·(1 − e^(−dt/τ))`.

### Arrival & mooring (session-only)

- Entering the bay radius fires the `arrived` event once per voyage.
- On arrival the **wind/current pull toward Crete switches off**, the storm
  target eases to 0.2, and a soft boundary circle keeps the ship in the bay (so
  the player is never pinned against the shore).
- Sailing out past the bay boundary fires `bay_exit` → "Sail home?" prompt.
- Moored state is never persisted. Turn-back, bay exit, or reload ends it. (The
  game does not persist the current realm; a reload starts in the Desert, as for
  every realm.)

### Turn back

Space opens the Shipmaster menu: **Keep sailing** / **Turn back — the Delta**.
Turn back fires `sea → nile`. The Letter of Passage is a keepsake and is kept.

## 3. The look (`scene.js`)

The only visual tie to the 2D game is the frame itself: gold border and `#sl`
scanlines over the ocean.

### Ocean

- Camera-centered grid, dense near the ship and coarse out to ~4 km, snapped to
  whole cells as the camera moves (no vertex swimming); ~60 k vertices displaced
  by the generated Gerstner code.
- Shader: analytic normals; Schlick Fresnel blending near-black deep teal with
  the sky color; subsurface green-teal glow through thin crests; sharp specular
  from lightning; distance fog fading exactly into the horizon color.
- **Crest foam** from crest compression (Gerstner Jacobian) broken with noise,
  growing with `s`. **Wake:** a ring buffer of the ship's last ~32 positions,
  passed as a uniform array, drives a spreading, fading foam trail. **Bow spray**
  particles when the bow slams into a wave.

### Sky & storm

- Sky dome dusk gradient: a bruised amber band **behind** (toward Egypt —
  continuity with the Nile's setting sun) darkening to slate and near-black indigo
  **ahead** (toward Crete).
- Layered animated noise clouds heavy on the Crete horizon, with one towering
  anvil. As `s` rises, cover creeps overhead and the amber band narrows.
- **Lightning:** intra-cloud flashes that light the cloud layer locally and glint
  on the water; visible jagged bolts near Crete; frequency scales with `s`.
  Thunder via `SoundManager`, delayed by distance.
- **Rain:** wind-slanted streaks around the camera when `s > 0.5`.

### Ship (procedural geometry — no model files)

Egyptian papyrus-reed ship: long curved hull, upturned papyrus-bundle stern, Eye
of Horus on the bow; single mast with a big square linen sail that billows with
trim and wind and goes slack in irons; stern steering oar that swings with the
rudder; the pharaoh at the prow in gold and white, cape flapping.

### Landmarks (positions in `constants.js`, near the course line)

1. A half-sunk ship with a broken mast, JUST POTS crates bobbing around it.
2. A lone rock with a guttering signal fire.
3. A Minoan horns-of-consecration marker on a reef.
4. **Crete:** Mount Ida's silhouette faint through haze from departure, growing;
   on approach, cliffs, a pale beach, and Knossos' red columns lit by torches;
   the bay.

### Camera

Chase cam ~16 m behind and ~6 m above the stern, looking at a point ahead of the
bow. Critically damped dt-based spring (lags on turns, no overshoot). Carries 20%
of the ship's roll so the horizon stays readable. FOV widens slightly with speed.

### Performance

Target 60 fps on an integrated laptop GPU. Device pixel ratio capped at 2. If the
average frame time exceeds 25 ms for 3 s, halve the ocean grid and disable rain
(one step, once).

## 4. Game flow & content

### The ware

- `SHOP_CATALOGUE["letter_of_passage"] = {"name": "A Letter of Passage",
  "price": 8, "kind": "keepsake"}` — existing buy flow unchanged.
- `worlds/nile/shop/catalogue.js`: `WARES` entry (tier `RELICS`,
  `art: 'letter_of_passage'`) and a `WARE_RETORTS` line; `draw/ware-art.js`: a
  sealed papyrus with a wave glyph.
- Merchant blurb stays cryptic about the destination, e.g.
  *"PASSAGE TO AN ISLAND THAT IS NOT READY FOR YOU. IT WILL BE READY WHEN YOU
  HAVE PAID. IT IS ALWAYS READY WHEN YOU HAVE PAID."*

### Boarding (Nile Delta boat)

The boat's `onInteract` is replaced with a **THE SHIPMASTER ✦ NON-REFUNDABLE
VOYAGES** dialogue:

- **No Letter** (`!Inventory.owned('letter_of_passage')`): he declines and points
  upriver to JUST POTS ("I DO NOT SELL PASSAGE. I HONOUR IT.").
- **Letter held:** offers "Board the ship". On choosing:
  1. `import('./scene.js')` (already started when the dialogue opened).
  2. WebGL2 check — if unavailable, an in-character refusal; stop.
  3. Logged in: `await POST /api/unlocks/evaluate` (grants `sea`; idempotent).
     Required because the Nile is granted directly by `invites.py` without an
     evaluation pass, so `sea` is not auto-granted.
  4. `PortalRegistry.use('nile', 'sea')` → ~2 s 2D wipe (darkening to storm, a
     horizon line drawing across).

### At sea — narration

`narration.js` maps voyage events (emitted by `stepVoyage`) to lines, each with a
cooldown. Lines go to `log()` in the established deadpan voice:

- `departure` — *"The Delta lets go of you. The sea does not ask your name. It
  asks for nothing. That is how you know it will take everything."*
- `first_swell`
- `landmark_near:<id>` — e.g. the sunk ship: *"A previous voyage. Also paid in
  full."*; the signal fire; the bull horns
- `strayed` (corridor exit; rate-limited)
- `in_irons`
- `storm_rising` (per threshold crossed)
- `first_lightning`
- `crete_clearer` (at 50% progress)

While any `#dlg` dialogue is open, steering input is ignored and the rudder
recenters, but the ship and ocean keep simulating. Follows the `#dlg` ownership
convention (`DialogueManager` emits `dialogue:start`/`end`; astral chat yields
and restores).

### Arrival

1. On `arrived`, a Shipmaster dialogue: *"CRETE. KING MINOS KEEPS A LABYRINTH
   HERE. SOMETHING IN IT KEEPS HIM. THE ISLAND IS NOT TAKING VISITORS. YOU MAY
   ANCHOR AND ADMIRE IT. ADMIRATION IS FREE. IT IS THE ONLY THING HERE THAT IS."*
2. Record it: logged in → `POST /api/progress {step_id: 'crete_reached'}`;
   guest → local `Flags.set('crete_reached', true)`.
3. Mooring per §2. On `bay_exit` → "Sail home?" dialogue → `sea → nile`.

### Returning to the Nile

`NileRealm.onEnter` gains a `fromId === 'sea'` branch placing the player on the
Delta beside the boat (`BOAT_X`), with the usual camera reset.

### Guests (walk this path explicitly — the #23 lesson)

- Buy the Letter with local credits (`Inventory.addLocal` via the existing guest
  buy branch); `Inventory.owned()` reads the same.
- Boarding skips the evaluate call; arrival is a local flag.
- No WebSocket, so no `realm_enter` gate to trip.
- A reload loses the Letter and progress, as for all guest state.

### Backend (catalogue data + test updates only)

- `REALM_CATALOGUE["sea"] = {"dir": "sea", "module": "/worlds/sea/SeaRealm.js",
  "export": "SeaRealm", "sort": 8, "unlock_rule": {"requires_realms": ["nile"]}}`
- `STEP_CONFIG["crete_reached"] = {"requires": {"requires_realms": ["sea"]},
  "sets_flag": "crete_reached"}` — reserved automatically by `app/flags.py`
  via `owned_flag_names()`.
- `SHOP_CATALOGUE["letter_of_passage"]` as above; `test_shop_catalogue.py`
  count 18 → 19.
- **Known, accepted gap:** the server does not verify Letter ownership before
  granting `sea` (no `requires_items` rule primitive). The Letter check is
  client-side; forging it yields only a free voyage. Close this with a
  `requires_items` primitive when the Crete realm makes arrival valuable.

### Audio

- `REALM_THEME.sea` → a new procedural theme in `audio/sound.js`: low drone plus
  filtered-noise wind and surf whose gain tracks `s`.
- Thunder one-shots, delayed by distance to the flash.

### Dev panel

A `🌊 SEA` entry in `ui/dev-panel.js` `REALMS`: its setup grants the Letter
locally, calls the DEBUG unlock for `sea` (accounts), and boards directly.

## 5. Build order, testing, scope

### Build order

1. **Look spike (throwaway).** A standalone Artifact page (three.js from an
   allowlisted CDN) with the real module boundaries — `waves.js`, ocean shader,
   sky/storm clouds, lightning, a placeholder ship, the chase cam, arrow-key
   steering. The user screenshots it back; iterate on color, wave scale, cloud
   mood, and camera until the look is right. Only tuned **params and shader code**
   carry forward; the page is discarded.
2. **Pure core, TDD.** `waves.js`, `voyage.js`, `narration.js`, `constants.js`
   with `node --test` suites.
3. **Integration.** Vendored three.js + import map, `#gl` canvas + CSS,
   `SeaRealm` + `scene.js`, `PortalRegistry.use` (+ test), dev-panel entry.
   Milestone: sail from the dev panel.
4. **Nile side.** Letter ware, Shipmaster dialogues, boarding flow, `fromId ===
   'sea'` return, guest path.
5. **Backend data** + pytest.
6. **Content & audio.** Landmarks, Crete, narration lines, sea theme and
   thunder, rain, performance fallback.
7. **Verify** (see below). One PR from `feat/sea-voyage`.

### Tests

**Frontend (`cd frontend && node --test tests/*.test.js`) — pure modules only:**

- `heightAt` matches the displaced Gerstner surface within 1 cm (fixed-point
  convergence).
- `Σ Q·k·A ≤ 0.95` at `s = 1`.
- On flat water (`s = 0`, zero amplitude) heave settles to the resting draft
  within 5 simulated seconds (residual < 1 cm).
- Same inputs stepped at 30 fps vs 60 fps agree within tolerance after 10
  simulated seconds.
- Speed converges to the terminal velocity (within 1%) after 60 simulated seconds
  downwind at full sail — traced through the drag feedback, not single-step;
  stays below 0.5 m/s in irons.
- Sailing straight with full sail reaches the bay in 180–300 simulated seconds.
- Holding hard rudder away from Crete never exceeds the outer limit.
- Storm intensity converges to its target; `arrived` switches off the pull and
  drops the target to 0.2; the bay boundary holds.
- Narration cooldowns: an event inside its cooldown yields no line; one-shot
  events fire once per voyage.
- `PortalRegistry.use` fires only a registered edge whose condition passes.

`scene.js`, `SeaRealm.js`, `dialogue.js`: `node --check` (DOM/WebGL-coupled).

**Backend (pytest):**

- `POST /api/progress {step_id:'crete_reached'}` → 403 without `sea`; OK with it.
- A forged `crete_reached` flag is stripped by `PUT /api/state`.
- `POST /api/unlocks/evaluate` grants `sea` to a user holding `nile`, not to one
  without it.
- WS `realm_enter sea` is denied before the grant and accepted after.
- `letter_of_passage` buys once; a second buy → 409.

### Verification

- Full playthrough on the dev stack **as an account and as a guest**: buy Letter →
  board → sail → stray → turn back → re-board → arrive → moor → sail home.
- Verify the shipped artifact, not just the diff: `vendor/three.module.min.js`
  is served with a JavaScript MIME type by nginx (dev and Render static), the
  import map resolves, and `GET /api/config` lists `letter_of_passage`.
- Visual quality is judged by the user (no headless browser available here).

### Out of scope

- The Crete realm or any landing content.
- Capsizing, damage, or failing the voyage (the storm is atmosphere).
- Astral projection into `sea`; multiplayer ships.
- Per-voyage cost; the `requires_items` server rule (follow-ups for when Crete
  exists).
- Phase 2b lazy realm loading (the catalogue entry is already shaped for it).
- Mobile layout changes — the existing pad covers every sea input: ←/→ rudder,
  ↑/↓ sail trim, Space for the Shipmaster menu and all dialogues.
- Persisting a voyage across reloads.
