# The Nile — Design Spec

**Date:** 2026-06-14
**Status:** Draft — pending user review

## Overview

A new realm, **The Nile**, reached by walking **west** off the Desert. Where every
existing realm moves *up* (capstone → Council → cosmos) or *down into the buried past*
(crypt → Atlantis → Deep), the Nile is the game's missing fourth axis: the **living
downline**. It is the only realm about the player *specifically* — the actual people
they recruited, flowing away from them downstream, right now, in the present tense.

The realm is a **live mirror of `G.recruits`**: the riverbank is populated by the
player's real recruits, by name, depth, and the dollars they paid up the chain. It is
**fully open from buy-in** and scales with the player's chain — empty and eerie for a
new player, teeming and damning for a veteran.

The realm flows, west = downstream, via a one-way current mechanic. Its mouth (the
Delta) seeds a future chapter (Crete / Minos / the Minotaur) without building it.

## Thesis & tone

The game already has a complete recursive cosmology: "levels all the way up" (Council)
and "levels all the way down" (Atlantis — *the system is the upline; the shape always
repeats*). The Nile completes the compass:

- **UP** — the upline. Profit, lies.
- **DOWN** — the *dead* downline. History, buried founders (Atlantis as archaeology).
- **EAST** (oasis) — the present; the Sphinx, the riddles.
- **WEST → the Nile** — the *living* downline. The recruits *you* sent, as
  accountability rather than myth.

Historically exact: the Egyptians buried their dead on the **west bank** because the
sun dies in the west. Walking west is walking toward death and toward everyone the
scheme shed on its way up.

**Tonal gradient** runs with the geography: sunlit and playful at the Banks (bazaar,
crocodile-hopping) → cold and still at the Delta (your downline, Joseph's confession).
Precedent for blending deadpan comedy and quiet horror is Atlantis.

## Engine

`NileRealm extends PhysicsRealm` (`engine/realm.js`) — same base as `WorldRealm`. Gives
gravity, walk, the existing `Z` jump, camera follow (`_trackCameraX`), world clamp
(`_clampX`), and the terrain interface (`surfaceAt`, `canStepTo`).

The river adds **one new force**: a constant **westward current** applied to the player
whenever they are in the water zone (feet at or below water level).

- On land: normal movement.
- In water: the current pushes the player west every frame, and **current speed >
  upstream walk speed** — so the player can never make headway back east *on the water*.
- Escape is vertical/lateral: scramble onto a bank, a papyrus reed, or a crocodile's
  back (all are `surfaceAt` terrain above water level).

The one-way drift *is* the thesis ("the scheme only flows one way for the people
below"), implemented as a single velocity rule. No new movement system — it is the
Desert's physics plus a current vector.

### Approaches considered

- **PhysicsRealm + westward current** *(chosen)* — reuses Desert physics, supports
  bank-walking, the bazaar, jumping, and crocodile-platforming; the current gives the
  drift. Lowest new surface area.
- Atlantis-style `FreeMoveRealm` free-swim — rejected: no gravity/ground makes the
  bazaar and platforming awkward; the realm needs solid banks.
- Mario-style auto-scroll raft — kept as an *optional downstream set-piece* within the
  chosen approach (board a papyrus raft → a momentum/auto-scroll stretch), not the base
  movement model.

## The four beats (entry → downstream, ending at the Delta)

### 1. The Banks & the Bazaar of Believers

Entry from the Desert's west edge. Sunlit, playful.

- **The Merchant** sells "downline-insurance" charms and scarab amulets on
  installments, for in-game credits. The satire is the *upsell*, not the item — wares do
  almost nothing mechanically (see "Bazaar economics" below).
- **Moses-in-the-bulrushes** gag: a basket in the reeds you can "adopt."
- **Crocodile-hopping** platforming across floating papyrus reeds. Crocs are
  `FreeRoamEnemy` (the Atlantis shark/squid class) patrolling the shallows;
  `HealthSystem` handles the bite, death message, and respawn.

### 2. The Crossing & Sobek

- **The Ferryman** charges a toll to carry the player downstream — a literal buy-in to
  descend toward death.
- **Sobek**, crocodile-god and the scheme's *enforcer*: weeps crocodile tears for the
  recruits he eats when they cannot pay up the chain. `Dialogue` / `DialogueManager`.

### 3. The Granary & Joseph

The biblical anchor and the thesis-character.

- **Joseph** hoarded grain through seven fat years and sold it back to a starving
  people until they sold their land and themselves (Genesis 47 — verbatim the mechanic).
  The original founder, 4,000 years before Khem-Atef drowned in Atlantis. He recognizes
  the player as his heir.
- **The Nilometer** conspiracy lives here: priests read the flood level in a hidden
  well and set the year's taxes *before* anyone knew the harvest — ancient insider
  trading, real history.

### 4. The Delta & your downline

The quiet, heavy end. The river spreads thin; the banks fill with the player's **actual
recruits**.

- Rendered from `G.recruits` — each recruit is a bank figure/marker showing `name`,
  `depth`, the `parentName` chain, and `payoutToPlayer`.
- **Scales with the chain** (the "fully open" design solution): zero recruits → a dry,
  empty riverbed, which is its own gut-punch ("you came to meet the people beneath you
  and there's no one here yet"). Many recruits → a crowded, damning river. The heavy
  beats (Joseph, the Delta) are always present but their weight scales with how many
  real people the player has actually sent downstream.
- At the river's mouth: a boat and a horizon, with a **disabled portal to Crete**
  (registered in the graph, `condition: () => false`) — pointing at Minos, the
  Labyrinth, and the Minotaur without building them.

## Mechanics detail

### The current

- Active only within the water zone (a world-X range with `py` at/below water level).
- Applied in `NileRealm.update()` as a westward delta to the player's X each frame.
- Tuned so `currentSpeed > SPEED` (the Desert walk speed in `worlds/constants.js`):
  the player drifts west on water regardless of input.
- Banks/reeds/crocodile backs are raised `surfaceAt` terrain; standing on them removes
  the player from the water zone and stops the drift.

### Crocodiles

- `FreeRoamEnemy` instances (`engine/entity.js`) with patrol bounds along the shallows,
  `chaseStyle: 'direct'`, aggro/hurt ranges — modeled on the Atlantis shark.
- `HealthSystem` (`engine/health.js`) for damage, death-screen, respawn, and immunity.
  Death messages in the established Nile voice (see Atlantis `_DEATH` for the pattern).

### Recruit-bank rendering

- Iterate `G.recruits` (records: `{ id, name, depth, pid, rootPid, parentName,
  payoutToPlayer, dbId }`).
- Place each as a figure on the bank, deeper recruits further downstream (by `depth`).
- Read-only: this realm renders the downline; it does not mutate recruit state.

### Bazaar economics

- Spends **in-game credits only** (e.g. against `G.earned`); **no real money** — Stripe
  is stubbed and must stay that way (per `CLAUDE.md` Phase 1 blockers).
- Default stance: wares are satirical and near-cosmetic (the upsell is the joke). Any
  functional boon (e.g. an extra scroll) is a later detail to nail in the plan, kept
  minor; payout math stays owned by the backend `PAYOUT_CONFIG`.

## Plumbing & integration points

All existing patterns — `main.js` does not change.

- **New realm class:** `frontend/worlds/nile/NileRealm.js` extending `PhysicsRealm`.
- **Manifest:** add `import { NileRealm }` and `new NileRealm()` to
  `frontend/worlds/manifest.js` (`ALL_REALMS`).
- **Inbound portal:** register `{ from: 'world', to: 'nile', ... }` in `NileRealm`'s
  *own* constructor (per the portal convention in `CLAUDE.md` — no edit to
  `WorldRealm.js` required). Triggered at the Desert's west edge.
- **Outbound portal:** `{ from: 'nile', to: 'world' }` (return east), and a disabled
  `{ from: 'nile', to: 'crete', condition: () => false }` for graph completeness.
- **Crocodiles:** `FreeRoamEnemy` + `HealthSystem`.
- **NPCs / dialogue:** `Dialogue` + `DialogueManager` (Merchant, Ferryman, Sobek,
  Joseph).
- **Bazaar UI:** `ui/modal.js` (`showModal` / `showPrompt`).
- **Audio:** `SoundManager.playRealm('nile')` via the `realm:enter` event wiring in
  `main.js` (add a Nile theme in `audio/sound.js`).
- **Draw:** `frontend/worlds/nile/draw/` per the per-realm draw convention;
  `getPlayerPose()` returns `{ px, py, camX, pZ, facing, frame }` so
  `drawRealmPharaoh()` works unchanged.
- **Constants:** `frontend/worlds/nile/constants.js` (world width, water level, current
  speed, zone X boundaries, entity positions).

New realm authoring follows `worlds/WORLD_TEMPLATE.md`.

## Out of scope (this realm)

- **Crete / Minos / the Labyrinth / the Minotaur / Saturn-boss** — seeded by the
  disabled Delta portal; a separate future chapter.
- **First-person / 3D** — explicitly parked for the post-Council ("post-alien") arc,
  where a perspective break would read as genuine ascension rather than a render change.
  The current game's diagrammatic 2D side-on view is load-bearing for the satire.
- **Real-money purchases** in the bazaar — Stripe stays stubbed.
- **New backend / schema work** — the realm runs entirely on existing client data
  (`G.recruits`, restored from `/api/recruits`).
- **Changes to `main.js`** — the realm registers itself via the manifest and portal
  conventions.
