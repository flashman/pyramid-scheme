# Server-Authoritative Realm Unlocks + Lazy Realm Loading

## Context

Today the frontend ships all 8 realms' JS eagerly (~89 files, 1.1 MB): `main.js` → `worlds/manifest.js` statically imports and instantiates every realm. Progression is fully client-authoritative — portal conditions are client closures over `Flags`, `PUT /api/state` blindly merges any flag except `shop_owned_*` (so `Flags.set('cosmic_upline_done', true)` from the console persists and opens the Council), and the 12 sphinx riddle answers sit in plaintext in `worlds/oasis/riddles.js`.

**Decided scope (with user, after reviewing industry practice):**
- **Phase 1 — integrity ("the MMO doctrine"):** server owns gating unlocks; client submits key actions (riddle answers, quest steps) to unlock endpoints that validate; WS `realm_enter` enforced. Cheating becomes impossible.
- **Phase 2 — lazy loading (files stay public):** realm modules load on demand via dynamic `import()`; realm list comes from `GET /api/realms`. Realm count scales without growing initial payload.
- **DEFERRED — content secrecy** (making locked realm code non-downloadable). Two candidate mechanisms were designed and the choice is intentionally postponed until 1+2 ship: (a) encrypted bundles on the existing static host (per-realm esbuild+encrypt step, WebCrypto key endpoint, no hosting change) vs (b) self-managed nginx + `auth_request` + cookie auth (cleaner runtime, but hosting migration off Render static → Docker web service with free-tier cold-starts). Also deferred: cookie-auth/single-origin migration (only *required* by (b), though independently valuable — it retires the WS-token-on-query-string blocker).
- **Astral projection rule (user requirement):** projecting into a downline host must work even in realms the projector hasn't unlocked — projection is sanctioned scouting. In this scope that's automatic (files public, WS projection joins validate against the *target host's* unlocks). When secrecy lands later, the grant check must become "unlocked OR actively projecting into a host currently there."

**Zero deployment changes in this scope.** Frontend stays the Render static site; auth stays JWT-in-localStorage; no nginx edits. Everything ships as ordinary PRs.

**Branch:** `git checkout -b feat/realm-gating` off clean main. One PR per phase.

**Verified ground truth:**
- Only ONE portal is registered in its *destination* realm's constructor: `world → nile` in `frontend/worlds/nile/NileRealm.js` (~line 176). All other edges live in source realms — good for lazy loading.
- No realm constructor subscribes to `Events` — deferred instantiation misses nothing.
- Riddle answers: 12 plaintext entries in `worlds/oasis/riddles.js`; `Flags.inc('sphinx_riddles_solved')` ~line 224; hint (the answer) surfaces at attempt ≥ 13 — preserve server-side.
- `RESERVED_FLAG_PREFIXES = ("shop_owned_",)` at `backend/app/routers/game.py:17` — the pattern to extend.
- `navigator.sendBeacon('/api/state', …)` (`game/session.js:149`) cannot attach the Authorization header — **it silently 401s today**. Fix in Phase 2 with `fetch(..., {keepalive: true})` which *can* carry the header (no cookie migration needed).
- Gate flags & setters: `first_scroll_sent` (recruits.js + session.js backfill), `crypt_open` (`recruits.js unlockCrypt()`), `cosmic_upline_done` (quest after chief dialogue in ChamberRealm), `sphinx_riddles_solved` (riddles.js), `atlantis_vault_opened` (VaultRealm altar ~line 156), `atlantis_crack_visible` (AtlantisRealm deepest tablet ~line 707), `stele_read` (VaultRealm ~line 109).
- Shell code importing from realm dirs: `ui/inventory-panel.js` → `worlds/nile/shop/ware-art.js`; `VaultRealm.js` + `draw/vault.js` live in `worlds/oasis/` though vault gates separately. Fix both in Phase 2 hygiene.
- Backend tests: in-memory sqlite conftest with `create_all` (new tables auto-covered); `auth_headers()` helper exists. Frontend tests: `cd frontend && node --test tests/*.test.js`.
- `manager`/`channels` are in-process singletons — single-instance invariant makes a small in-process TTL cache safe.

---

## Phase 1 — Server-authoritative unlocks (client still eager-loads; nothing visual changes)

### Migration `0004_realm_unlocks` (Alembic; never create_all)
One table — the realm registry itself is code, not DB (matches the `shop.py`/`payout.py` single-source-of-truth catalogue pattern; realm content ships with deploys anyway under the chosen architecture):
- `user_realm_unlocks(user_id FK CASCADE, realm_id VARCHAR(32), granted_at, source, PK(user_id, realm_id))`

**Backfill grants from existing `game_states.flags`** so no player regresses: invites/recruits/`first_scroll_sent` → nile+oasis; `sphinx_riddles_solved>=1` or `stele_read` → vault; `crypt_open` → chamber; `cosmic_upline_done` → council; `atlantis_vault_opened` or `atlantis_statue_risen` → atlantis; `atlantis_crack_visible` → deep. Test the backfill against a read-only copy of prod flags (Supabase console) before deploying.

### New backend modules — rules as data, two generic endpoints (scales without new routes)
- `backend/app/realms.py`:
  - `REALM_CATALOGUE` — single source of truth, one entry per realm:
    ```python
    "atlantis": {
        "dir": "atlantis", "module": "/worlds/atlantis/AtlantisRealm.js",
        "export": "AtlantisRealm", "sort": 5,
        "unlock_rule": {"requires_realms": ["vault"], "requires_flags": ["stele_read"]},
        "legacy_flag": "atlantis_vault_opened",   # mirrored on grant
    },
    ```
    Rule primitives (one generic evaluator covers all 8 realms): `default_unlocked`, `requires_realms`, `requires_flags` / `requires_flags_any`, `requires_bought`, `requires_counters` (e.g. `{"sphinx_riddles_solved": 1}`), `server_event_only` (nile/oasis — claim endpoint refuses; only backend hooks grant).
  - `unlocked_realm_ids(db, user_id)` with ~30s in-process TTL cache; `grant_realm(db, user_id, realm_id, source)` — idempotent upsert, mirrors `legacy_flag` into `GameState.flags` (so existing client draw/quest code hydrates unchanged from `/api/me`), invalidates cache, pushes WS `realm_unlocked` via `manager`.
- `backend/app/challenges.py`: `CHALLENGE_CONFIG` — answer-carrying actions as data. First entry: sphinx (12 riddle answers moved from riddles.js, `increments: "sphinx_riddles_solved"`, `hint_after_attempts: 13`). Future puzzle realms add entries, not endpoints.
- `backend/app/routers/unlocks.py` — exactly **two generic routes**, both authed + idempotent:
  - `POST /api/unlock/{realm_id}` — look up `REALM_CATALOGUE[realm_id].unlock_rule`, evaluate against server-visible state (unlock set, `state.bought`, flags, counters); grant on pass, 403 with no detail on fail. Covers chamber, council, atlantis, deep today — and every future rule-based realm with zero new code.
  - `POST /api/challenge/{challenge_id}` `{item_id?, answer}` — validate against `CHALLENGE_CONFIG` (normalized answer match, per-user attempt counter in flags); on success increment the configured server-owned counter and auto-evaluate/grant any realm whose rule is now satisfied (vault). Response `{correct, solved_count, hint?}` — hint only at attempts ≥ threshold.

  nile+oasis: hook `grant_realm(..., "first_scroll")` into `POST /api/invites` (the key action already goes through the server).
- `routers/dev.py`: DEBUG-only `POST /api/dev/unlock-realm` so dev-panel shortcuts keep working (panel calls it alongside its `Flags.set`).
- `routers/game.py`: extend the lock — `RESERVED_FLAG_PREFIXES += ("unlock_",)`; add `RESERVED_FLAG_NAMES = {crypt_open, cosmic_upline_done, atlantis_vault_opened, atlantis_crack_visible, sphinx_riddles_solved, first_scroll_sent}`. **Strip silently** like `shop_owned_` (client legitimately syncs its whole Flags store; rejecting would break every honest sync and the beacon).
- `routers/ws.py _on_realm_enter`: own-channel joins require realm ∈ `unlocked_realm_ids` (cached); **projection joins validate against the target host's unlocks, not the projector's** (astral scouting rule). Deny → send `{"type":"realm_denied"}`, socket stays put.

### Frontend key-action call sites (eager loading untouched)
- `worlds/oasis/riddles.js _submit()` → async `POST /api/challenge/sphinx {item_id, answer}`; drive correct/wrong/hint phases from the response; **delete the answers arrays**; set local `sphinx_riddles_solved` from `solved_count` for instant portal/draw feedback.
- `game/recruits.js unlockCrypt()` → `POST /api/unlock/chamber` (keep the local `Flags.set` for instant UX; server is authority).
- `worlds/crypt/ChamberRealm.js` chief-accept → `POST /api/unlock/council`.
- `worlds/oasis/VaultRealm.js` altar → `POST /api/unlock/atlantis`.
- `worlds/atlantis/AtlantisRealm.js` deepest tablet → `POST /api/unlock/deep`.
- `game/session.js`: handle `ws:realm_unlocked` (log/refresh) and `ws:realm_denied` ("The way is barred." via game log).

### Verify Phase 1
- Backend: `test_realm_unlocks.py` (grant idempotency, flag mirroring, rule-evaluator unit tests per primitive), `test_unlock_endpoints.py` (generic claim: pass/403 per realm rule, chain order; challenge: sphinx correct/wrong/hint-at-13, `server_event_only` refusal for nile), extend `test_state_namespace_lock.py` for new reserved names, WS `realm_enter` rejection test. `docker compose exec backend pytest`.
- Manual: console-forge `Flags.set('cosmic_upline_done', true)` → does not persist across reload, WS refuses `realm_enter council`. Full dev-compose playthrough (scroll→nile/oasis, riddle→vault, stele+altar→atlantis, tablet→deep, gods→crypt, chief→council) plays identically to today.

---

## Phase 2 — Lazy realm loading (files remain public; no gating)

### 2a. Module-graph hygiene (prep commits, no behavior change)
1. Move `worlds/oasis/VaultRealm.js` + `worlds/oasis/draw/vault.js` → `worlds/vault/` (own dir, matching its own unlock; extract vault constants to `worlds/vault/constants.js`). `riddles.js` stays in oasis.
2. Move the `world → nile` portal registration from `NileRealm.js` into `WorldRealm.js` (it closes over nothing from NileRealm; `cityTransRender` comes from shared `worlds/transitions.js`). Only destination-registered edge in the codebase.
3. Move `worlds/nile/shop/ware-art.js` → `frontend/draw/ware-art.js`; update imports in `ui/inventory-panel.js` and `StallOverlay.js` (shell must not import from realm dirs).

### 2b. Lazy RealmManager (`engine/realm.js`) + `game/realms.js`
- `RealmManager.defineLazy(id, loader)` + `async ensure(id)` — memoize the in-flight promise; `register()` the instance on resolve.
- `transitionTo(id)` → async: `await this.ensure(id)` then the existing exit/enter/emit sequence. Loader rejection: emit `realm:load_denied`, stay in current realm. Call sites (`portal.js`, `astral.js`) are fire-and-forget — no signature changes.
- `scheduleTransition(toId, …)`: kick `ensure(toId)` immediately so the import races the animation; fire the swap only when `elapsed >= duration && loaderSettled` (overlay lingers at full progress = free loading state); rejection clears `_transition` and logs "The way is barred."
- New `game/realms.js initRealms(Api)`: fetch `GET /api/realms`, `defineLazy` each entry (`import(r.module)` → `new mod[r.export]()`), `await ensure('world')` before the first frame. Re-fetch on `ws:realm_unlocked`.
- **New endpoint `GET /api/realms`** (`backend/app/routers/realms.py`): serves `REALM_CATALOGUE` — **all** realms `{realms:[{id, module, export, sort, unlocked}]}` — files are public in this scope, so no secrecy in the manifest; the `unlocked` flag is informational. (When secrecy lands, this endpoint narrows to unlocked + projection-visible; contract already right.) Auth optional: anonymous → same list, `unlocked` only for defaults.
- `main.js`: drop the `ALL_REALMS` import + register loop; call `await initRealms(Api)` in `init()` before starting the game loop (guest path included). **Delete `worlds/manifest.js`** — `REALM_CATALOGUE` replaces it as the registry. Update `worlds/WORLD_TEMPLATE.md` + CLAUDE.md: new realm = realm dir + one catalogue entry (rule as data; no new endpoints, no manifest edit).
- Astral projection: projecting into a realm the projector hasn't unlocked simply works (loader exists for all realms; WS join validated against the host). No fallback UI needed in this scope.
- Verified-safe consequences: realm constructors register their outgoing portals/NPCs at `ensure()` time — exits are only usable from inside the realm, and all inbound edges live in already-loaded source realms after 2a. No constructor uses `Events`.

### 2c. Save-beacon fix (rides along)
Replace `navigator.sendBeacon('/api/state', …)` in `game/session.js` with `fetch('/api/state', {method:'POST', keepalive: true, headers: Api._headers(), body})` — keepalive fetch survives unload AND carries the Authorization header, fixing the current silent 401 without any auth migration.

### Verify Phase 2
- `frontend/tests/realm-manager.test.js` (node --test): `defineLazy`/`ensure` memoization, async `transitionTo` denial path, `scheduleTransition` waits for timer+loader, rejection clears `_transition`.
- Manual in dev compose: fresh page load fetches only shell + `worlds/earth` (network tab); entering nile triggers on-demand fetch of `worlds/nile/*`; transition animation covers load; full playthrough; astral-project into a downline member standing in a realm you haven't reached — renders correctly.
- Save-on-close: close the tab, check backend log shows 200 (not 401) for the keepalive state POST.
- `cd frontend && node --test tests/*.test.js`; `docker compose exec backend pytest`.

---

## Deferred (recorded for the future secrecy decision)
- **Mechanism choice:** (a) encrypted per-realm bundles on static hosting (esbuild+encrypt step, WebCrypto key endpoint gated by unlocks; no hosting/auth migration) vs (b) self-managed nginx `auth_request` + cookie auth (hosting migration; free-tier cold-start regression — a paid instance or pinger mitigates). Both give identical practical secrecy (neither stops an entitled player sharing content — that's DRM, out of scope).
- **Astral exception must survive secrecy:** grant check = "unlocked OR active projection session whose host is currently in that realm."
- **Cookie auth / single-origin** remains independently valuable (WS-token-on-query-string blocker) and is a prerequisite only for (b).
- Residual name leaks to eventually sweep if (a)/(b) lands: realm id strings in `audio/sound.js` theme map, `worlds/transitions.js`, dev-panel labels.

## Riskiest parts
1. **main.js boot rework** — the game loop consumes `RealmManager.current` unconditionally; `ensure('world')` must resolve before the first RAF, including the guest path.
2. **Backfill correctness** — a wrong backfill locks real players out of realms they've reached; test against a copy of prod flags first. Safety net: lazily grant nile/oasis in `GET /api/realms` when the user has invites/recruits.
3. **Async transition edge cases** — double-tap portals, transition during in-flight load, load failure mid-animation; covered by the memoized `ensure` + the realm-manager tests.
