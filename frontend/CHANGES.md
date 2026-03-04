# PYRAMID SCHEME™ — CHANGELOG

---

## v1.30 — Vault beneath the sphinx; paw gap fix; pool repositioned

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
