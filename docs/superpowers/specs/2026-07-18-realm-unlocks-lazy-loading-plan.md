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

### New backend modules — rules as data, generic endpoints (scales without new routes)

> **AS BUILT (2026-07-19).** Two deviations from the original sketch, both
> decided mid-implementation and both reflected below:
> 1. **No realm id ever appears in a URL path** (user requirement). The claim
>    route became argument-free, and the challenge route names its challenge
>    in the body.
> 2. **A third route, `POST /api/progress`, was added.** Reserving only the
>    gate flags left the gates decorative: the rules read `gods_met`,
>    `stele_read` and `upline_accepted`, which the client could still forge,
>    so 4 of 8 realms stayed console-openable. Quest steps are now
>    server-owned data too.

- `backend/app/realms.py`:
  - `REALM_CATALOGUE` — single source of truth, one entry per realm:
    ```python
    "atlantis": {
        "dir": "atlantis", "module": "/worlds/atlantis/AtlantisRealm.js",
        "export": "AtlantisRealm", "sort": 4,
        "unlock_rule": {"requires_realms": ["vault"], "requires_flags": ["stele_read"]},
        "legacy_flag": "atlantis_vault_opened",   # mirrored on grant
    },
    ```
    Rule primitives (one generic evaluator covers all 8 realms): `default_unlocked`, `requires_realms`, `requires_flags` / `requires_flags_any`, `requires_bought`, `requires_counters` (e.g. `{"sphinx_riddles_solved": 1}`), `requires_d1_recruits` (how the client's PHARAOH-tier gate — 15 direct recruits — is expressed server-side, since recruit rows can't be forged), `server_event_only` (nile/oasis — evaluation never grants; only backend hooks do).
  - `unlocked_realm_ids(db, user_id)` with ~30s in-process TTL cache; `grant_realm(db, user_id, realm_id, source)` — idempotent upsert, mirrors `legacy_flag` into `GameState.flags` (so existing client draw/quest code hydrates unchanged from `/api/me`), invalidates cache, pushes WS `realm_unlocked` (carrying `legacy_flag` so the client mirrors it immediately).
- `backend/app/challenges.py`: `CHALLENGE_CONFIG` — answer-carrying actions as data. First entry: sphinx (12 riddles moved from riddles.js, `counter: "sphinx_riddles_solved"`, `hint_after_attempts: 13`). **The responses moved server-side too, not just the answers** — every sphinx response opens by naming the solution ("A MAP.", "A HOLE."), so leaving them in the client would have leaked all 12 answers anyway. The client holds the questions; the server returns the response text once answered.
- `backend/app/steps.py`: `STEP_CONFIG` — quest steps as data (`god_met` per-item ×7 → `gods_met`; `stele_read`; `upline_accepted`), each with preconditions evaluated by the same `rule_satisfied`. `owned_flag_names()` derives the reserved set so flags and steps can't drift apart.
- `backend/app/flags.py`: the namespace-lock policy in one place, shared by `PUT /api/state`. Prefixes `shop_owned_`, `unlock_`, `challenge_solved_`, `challenge_attempts_`; names = gate flags ∪ `steps.owned_flag_names()`. **Strip silently** like `shop_owned_` (the client legitimately syncs its whole Flags store; rejecting would break every honest sync).
- `backend/app/routers/unlocks.py` — three generic routes, all idempotent:
  - `POST /api/unlocks/evaluate` — **no arguments.** Re-evaluates every rule against server-visible state and grants what passes, looping to a fixpoint so a dependency chain (vault → atlantis → deep) opens in one call. Every rule input is server-owned, so there is nothing a caller could usefully supply. Grants also happen inline on the earning action; this is the reconcile net for a drifted client.
  - `POST /api/progress` `{step_id, item_id?}` — records a step after checking its preconditions (403 otherwise), then evaluates. The server can't watch a player walk to the stele, but refusing an out-of-order step forces the chain to be walked: `stele_read` needs the vault, and the vault only opens on a real riddle answer.
  - `POST /api/challenge` `{challenge_id, item_id, answer}` — validates against `CHALLENGE_CONFIG`, counts each item once (so re-answering a solved riddle can't farm the counter), then evaluates. Response `{correct, solved_count, response?, hint?, newly_unlocked}` — hint only at attempts ≥ threshold. Auth optional: guests get validation, nothing persists.

  nile+oasis: `grant_realm(..., "first_scroll")` hooked into `POST /api/invites` (the key action already goes through the server).
- `routers/dev.py`: DEBUG-only `POST /api/dev/unlock-realm` `{realm_id}` so dev-panel shortcuts keep working (the panel calls it alongside its `Flags.set`, or the toggle looks like it worked until the WS refuses the transition).
- `routers/ws.py _on_realm_enter`: joins are gated on the **channel owner's** unlocks — the player for an own-channel join, the **host** for a projection join (astral scouting rule). `world` short-circuits without a DB read. Deny → send `{"type":"realm_denied"}`, socket stays put.

### Frontend key-action call sites (eager loading untouched)
- `worlds/oasis/riddles.js _submit()` → async `POST /api/challenge {challenge_id:'sphinx', item_id, answer}`; new `waiting` phase covers the round trip and blocks double-submits; **answers and responses deleted**; local `sphinx_riddles_solved` set from `solved_count` for instant portal/draw feedback.
- `worlds/earth/draw/gods.js onNear()` → `POST /api/progress {step_id:'god_met', item_id:idx}`.
- `worlds/oasis/VaultRealm.js` stele → `POST /api/progress {step_id:'stele_read'}`; altar → `evaluateUnlocks()`.
- `worlds/crypt/ChamberRealm.js` chief-accept → `POST /api/progress {step_id:'upline_accepted'}`.
- `game/recruits.js unlockCrypt()` and `worlds/atlantis/AtlantisRealm.js` crack → `evaluateUnlocks()` (reconcile net; the steps are what actually earn these).
- All keep their local `Flags.set` for instant UX — the server is the authority, and `/api/state` strips the name on the next sync.
- `game/session.js`: `evaluateUnlocks()` on start; handles `ws:realm_unlocked` (mirrors `legacy_flag`, logs) and `ws:realm_denied` ("The way is barred.").

### Verify Phase 1
- Backend (**done — 126 passing**): `test_realm_unlocks.py` (grant idempotency, flag mirroring, rule-evaluator unit tests per primitive), `test_unlock_endpoints.py` (evaluate: fixpoint chain, forged-body inertness, `server_event_only` refusal; progress: out-of-order 403, per-item counting, tier gate; challenge: correct/wrong/hint-at-13/guest), `test_ws_realm_gate.py` (own-channel deny, host-not-projector projection rule), `test_state_namespace_lock.py` extended to gate flags **and** step inputs. `docker compose exec backend pytest`.
- End-to-end against the live dev stack (**done**): forging all six gate + step flags through `PUT /api/state` left only the unreserved flag; evaluate granted nothing; both out-of-order steps 403'd; the real riddle → vault, stele → atlantis + deep, 7 gods → chamber, chief → council.
- Manual: console-forge `Flags.set('cosmic_upline_done', true)` → does not persist across reload, WS refuses `realm_enter council`. Full dev-compose playthrough (scroll→nile/oasis, riddle→vault, stele+altar→atlantis, tablet→deep, gods→crypt, chief→council) plays identically to today.

### Pre-deploy gate: verify the backfill against prod (NOT YET DONE)

`alembic upgrade head` ran only against an empty dev DB, so the backfill
SELECTs matched nothing — they are **untested against real data**. A wrong
WHERE clause here silently locks existing players out of realms they have
already reached, and is only fixable with another migration.

Run these read-only queries against prod *before* deploying and sanity-check
each count against how many players actually hold the matching flag. Note the
JSONB checks: the migration compares `flags->>'x' = 'true'` (text extraction),
which is correct for a stored JSON boolean but **not** for a stored string
`"True"` or a number — query 2 confirms what is actually stored.

```sql
-- 1. How many players each realm would be granted to.
SELECT 'nile/oasis' AS realm, count(*) FROM users u
WHERE EXISTS (SELECT 1 FROM invites i  WHERE i.inviter_id   = u.id)
   OR EXISTS (SELECT 1 FROM recruits r WHERE r.recruiter_id = u.id)
   OR EXISTS (SELECT 1 FROM game_states gs WHERE gs.user_id = u.id
              AND gs.flags->>'first_scroll_sent' = 'true')
UNION ALL
SELECT 'vault', count(*) FROM game_states gs
WHERE COALESCE(gs.flags->>'sphinx_riddles_solved','0') NOT IN ('0','false','null','')
   OR gs.flags->>'stele_read' = 'true'
UNION ALL SELECT 'chamber',  count(*) FROM game_states WHERE flags->>'crypt_open'             = 'true'
UNION ALL SELECT 'council',  count(*) FROM game_states WHERE flags->>'cosmic_upline_done'     = 'true'
UNION ALL SELECT 'atlantis', count(*) FROM game_states WHERE flags->>'atlantis_vault_opened'  = 'true'
                                                          OR flags->>'atlantis_statue_risen' = 'true'
UNION ALL SELECT 'deep',     count(*) FROM game_states WHERE flags->>'atlantis_crack_visible' = 'true';

-- 2. What these flags are ACTUALLY stored as (the comparison above assumes
--    JSON booleans / numbers, not strings). Any 'string' row is a red flag.
SELECT k, jsonb_typeof(flags->k) AS stored_type, count(*)
FROM game_states, unnest(ARRAY[
  'first_scroll_sent','sphinx_riddles_solved','stele_read','crypt_open',
  'cosmic_upline_done','atlantis_vault_opened','atlantis_statue_risen',
  'atlantis_crack_visible','gods_met','upline_accepted'
]) AS k
WHERE flags ? k
GROUP BY k, stored_type ORDER BY k;

-- 3. Anyone who reached a realm but whose gate flag is missing (would regress).
--    Expect 0 rows; each row is a player who'd lose access.
SELECT user_id, flags->>'gods_met' AS gods, flags->>'crypt_open' AS crypt
FROM game_states
WHERE (flags->>'gods_met')::int >= 7 AND COALESCE(flags->>'crypt_open','') <> 'true';
```

If `flags` is stored as `json` rather than `jsonb`, swap `?` for
`flags::jsonb ? k` in query 2.

### Portal-condition audit (done — no divergence found)

Checked for the dangerous direction: a client portal *more permissive* than
its server rule, which would offer a transition the WS then refuses.

| Edge | Client gate | Server rule | Aligned? |
|---|---|---|---|
| world→nile / world→oasis | `first_scroll_sent` | granted on `POST /api/invites` | ✓ same action |
| world→chamber | trigger `crypt-door` requires `crypt_open` (the portal's own `G.bought` is not the real gate — `handleKey` also requires the trigger zone) | 7 gods + bought + 15 D1 | ✓ `crypt_open` is only mirrored on grant |
| world→council | trigger `capstone-tip` requires `cosmic_upline_done` | chamber + `upline_accepted` | ✓ mirrored on grant |
| oasis→vault | `sphinx_riddles_solved >= 1` | same counter, server-owned | ✓ |
| oasis→atlantis | `atlantis_statue_risen`, and the statue only rises once `atlantis_vault_opened` | vault + `stele_read` | ✓ altar needs `stele_read` to fire |
| atlantis→deep | `atlantis_crack_visible` | requires atlantis | ✓ mirrored on grant |

Every client gate keys on a flag the server *only* writes when it grants the
realm, so the client cannot be ahead of the server. The one residual drift
path: a `POST /api/progress` that fails on the network leaves the client
locally ahead until `evaluateUnlocks()` on next session start reconciles.

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
