# ⚡ PYRAMID SCHEME™ — Production Roadmap

> Work through these phases in order. Each phase should be shippable on its own.
> Items marked 🚨 are hard blockers — do not accept real money until these are done.

---

## PHASE 1 — Ship Nothing Without These
*Target: ~1 day. These are pre-launch requirements, not polish.*

### Security
- [ ] 🚨 **Rotate SECRET_KEY** — generate with `openssl rand -hex 32`, move to a secrets manager (Doppler, AWS Secrets Manager, or at minimum an untracked `.env.prod`). Remove the committed `.env` from git history (`git filter-branch` or BFG).
- [ ] 🚨 **Fix WS token exposure** — move JWT off the query string. On connect, send `{"type":"auth","token":"..."}` as the first message; reject the connection if it doesn't arrive within 2s.
- [ ] 🚨 **Add rate limiting** — install `slowapi`, apply `@limiter.limit("10/minute")` to `/api/auth/register`, `/api/auth/login`, and `/api/invites`. Add nginx `limit_req_zone` as a second layer.
- [ ] 🚨 **Enforce email uniqueness on organic registration** — the register endpoint silently accepts `body.email` without checking `User.email` uniqueness. Add the same uniqueness guard that the invite endpoint already has.
- [ ] 🚨 **Add server-side password minimum length** — add `min_length=8` to `ChangePasswordRequest` and `RegisterRequest` schemas (the changelog says "min 6" but it's not enforced anywhere).

### Payments
- [ ] 🚨 **Implement Stripe checkout** — replace `raise NotImplementedError` in `_create_stripe_payment_intent`. Implement the full flow: create PaymentIntent → return `client_secret` → frontend completes checkout → webhook fires → credits balance and invites.
- [ ] 🚨 **Implement Stripe webhook signature verification** — the stub `POST /api/stripe/webhook` accepts any POST. Add `stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)` and return 400 on failure. The existing TODO comment in the code tells you exactly what to do.
- [ ] 🚨 **Implement balance withdrawal / cashout** — users accumulate real balances with no way to claim them. Decide: Stripe Connect payouts, PayPal, manual bank transfer, or explicitly make balance cosmetic in-game currency. This decision gates your legal review too.

---

## PHASE 2 — Before First Real Users
*Target: ~2–3 days. Ops and data integrity before you have anyone to lose trust with.*

### Cleanup
- [ ] Delete `OasisRealm.js~`, `constants.js~`, `.DS_Store` from the repo.
- [ ] Add to `.gitignore`: `*.js~`, `*~`, `.DS_Store`, `**/__pycache__`, `*.pyc`, `.env` (not `.env.example`).
- [ ] Add to both `.dockerignore` files: `*.js~`, `*~`, `.DS_Store`.
- [ ] Remove pgAdmin and Mailhog from production — create `docker-compose.prod.yml` that excludes dev tools, removes exposed DB port, uses `uvicorn --workers 4` without `--reload`, and sets `DEBUG=false`.

### Deployment
- [ ] 🚨 **WebSocket / co-presence is single-instance only** — `app/ws.py` (`manager`) and `app/channels.py` (`channels`) keep all connection + channel state in process memory. **Invariant: run exactly one backend web instance.** Two instances (horizontal autoscaling, or the brief overlap during a Render rolling deploy) split-brain co-presence: users on different instances can't see each other's ghosts/chat, and projection targets resolve as offline. Before enabling any autoscaling, put a pub/sub backplane (Render Key Value / Redis) behind `channels.broadcast`/`join`/`leave` so events fan out across instances. Also note: every deploy or idle spin-down wipes live channels and in-flight projection sessions — acceptable today (clients reconnect and re-`realm_enter`), but a shared persistent realm would need session state in Redis too.
- [ ] **Many-occupant realm fan-out is O(N²)** — current pose broadcast is fine because channels are 1–2 occupants (only populated during a 1-to-1 projection). The reserved `(None, realm)` "cantina/ocean" shared realms would have N users each broadcasting pose at 10 Hz to N−1 peers (~N² msgs/tick through one event loop). Before building one: add interest management (broadcast only to nearby peers) and server-side pose coalescing/rate-limiting. (Per-socket flood guards for `pose_update`/`chat` already exist in `routers/ws.py`.)
- [ ] **SSL termination** — set up Let's Encrypt via Traefik or certbot, or terminate TLS at a cloud load balancer. Update nginx.conf to redirect HTTP → HTTPS.
- [ ] **Production domain** — register domain, point DNS, update `FRONTEND_URL`, `CORS_ORIGINS`, and nginx config.
- [ ] **CDN for static frontend** — put the nginx static files behind CloudFront, Cloudflare, or equivalent. This is especially important since the game is canvas-heavy.
- [ ] **Move `CORS_ORIGINS` to `.env`** — it's currently hardcoded to localhost. Production needs the real domain here.

### Observability
- [ ] **Add Sentry** — install `sentry-sdk[fastapi]`, call `sentry_sdk.init(dsn=...)` in `main.py`. Add `sentry-sdk` to the frontend too. Without this you're flying blind in prod.
- [ ] **Structured logging** — replace `print` / bare `logger.info` with structured JSON logs. Configure `uvicorn` log format. Forward to a log aggregator (Papertrail, Logtail, or CloudWatch).
- [ ] **Set up automated DB backups** — schedule `pg_dump` daily to S3/GCS. The `postgres_data` volume has no backup; one bad deploy wipes every user's recruits.
- [ ] **Health check endpoint hardening** — add DB connectivity check to `GET /api/health` (currently returns `{"status":"ok"}` even if the DB is down).

### Data Integrity
- [ ] **Add pagination to `GET /api/recruits`** — add `limit` (default 50, max 200) and `offset` query params. Update the frontend load to paginate.
- [ ] **Add `is_admin` column to `User`** — one-line model change + Alembic migration. You'll need this before you have any users to manage.
- [ ] **Fix `G.recruits` hydration on refresh** — when restoring session, the local `nextId()` counter resets to 0. Recruits loaded from `GET /api/recruits` use DB ids, not local counter ids. Map loaded recruits to a consistent keying scheme so `G.recruits` lookups don't mismatch after a reload.
- [ ] **Emit `balance` in `state_update` WS event** — the HUD shows a stale balance after a buy-in until the next `/api/me` poll. Add `balance` to the `state_update` push in `payments.py`.

---

## PHASE 3 — Admin & Support Tools
*Target: ~1 week. You need these the moment you have real users.*

### Admin Panel
- [ ] **Build `/admin` route** — gated behind `User.is_admin = True`. Minimum viable admin needs:
  - User list with search by username / email
  - User detail: balance, recruit count, transaction history, flags
  - Ban / unban user (`User.is_active`)
  - Manual balance adjustment with audit trail
  - Refund flow (Stripe refund API call + Transaction row)
- [ ] **Invite abuse dashboard** — show users who have sent the most invites in the last 24h. Any single user sending > ~20 invites/day is likely spamming.
- [ ] **Sim-user cleanup** — expose `DELETE /api/dev/sim-users` only in DEBUG mode (already done), but add an admin endpoint to view and clear sim data in production if needed.

### Account Management
- [ ] **Account deletion endpoint** — `DELETE /api/profile` that anonymizes PII (`email = null`, `username = "deleted_XXXX"`) and sets `is_active = false`. Required for GDPR and App Store guidelines.
- [ ] **Password reset via email** — `POST /api/auth/forgot-password` sends a time-limited reset token by email. Required before launch if you don't want to manually reset passwords.
- [ ] **Email verification** — optional but strongly recommended. Send a verification email on registration; gate invite sending on `email_verified`.

---

## PHASE 4 — Legal & Compliance
*Target: Before accepting any real money. Get a lawyer involved here.*

- [ ] 🚨 **Legal review** — consult a lawyer in your jurisdiction about real-money MLM mechanics. The "it's satire/entertainment" framing does not automatically create legal protection. FTC rules (US), the Gambling Act (UK), and EU consumer protection laws all have opinions about this structure.
- [ ] **Reconcile ToS with code** — the ToS says rewards are discretionary; `run_buyin_chain()` pays out unconditionally on every buy-in. Either the ToS needs to accurately describe the deterministic payout or the payout needs a discretionary gate. Pick one and implement it.
- [ ] **Privacy policy** — write one that accurately covers: data stored (email, username, financial transactions, game flags), retention period, deletion rights, and who you share data with (Stripe, your email provider). Host it at `/privacy`.
- [ ] **GDPR compliance** — for EU users: add cookie consent banner (if using analytics), document your legal basis for processing, implement the account deletion endpoint (Phase 3), respond to data subject access requests.
- [ ] **Age gate** — the ToS requires participants to be of majority age. Add an explicit age confirmation checkbox on registration.
- [ ] **Jurisdiction blocking** — if your lawyer identifies jurisdictions where this is illegal, implement IP-based blocking or at minimum a "not available in your region" screen.

---

## PHASE 5 — Game Completeness
*Target: Ongoing. Ship phases 1–3 first, then work here in parallel with Phase 4.*

### Realm Engagement — Fractal Deduction
*Full design in `docs/superpowers/specs/2026-06-21-realms-fractal-deduction-design.md`*

**Core diagnosis:** The realms are read-once dioramas. Every interaction is `walk → SPACE → read text → set flag`. No satisfying verb, no replay value, and the exploration system never talks to the pyramid. The Nile is the proof: highest content volume in the game, still not fun. Content volume does not convert.

**Design direction:** A single deduction verb (figure out the hidden scheme-shape) whose mastery is complicity — getting good at it means running the scheme, not just seeing it. Each realm recontextualises the same verb against a different myth (Mandelbrot, not Sierpinski). Solving triggers a zoom-out: the thing you just decoded was a tile in an identical scheme at the next scale. The pyramid is the Katamari — it visibly accretes and jumps scale. Tone trajectory: naive satire → cosmic horror as the walls come down.

**Hard constraint:** Realm activities never mint money or touch the upline chain. Their payoff is a separate non-monetary physical-pyramid resource. Money stays tied to real recruits only.

**Plan-for-a-plan (de-risking sequence):**
- [x] Write the spec (done — `2026-06-21-realms-fractal-deduction-design.md`)
- [ ] **Grey-box the deduction verb** — pick the mechanic (current lean: Golden Idol-shaped — solving = writing the lie/pitch/cover story) and prove the complicity bridge. Five-minute test with pyramid payoff OFF. Nothing else gets built until this passes.
- [ ] **Prove one scale-transition** — one decoded scheme → zoom-out → revealed as a node in the next identical-but-novel scheme. If this Katamari beat lands, the whole game is just this beat, fractally.
- [ ] Realm-by-realm rollout (its own spec, deferred until step 2–3 pass)

### Story Gaps
- [ ] **Vault payoff** — the Dream Stele sets `stele_read` but nothing listens to it. Wire `stele_read` into either a new quest step or a narrative unlock. The most natural payoff: reading the stele reveals a prophecy about "a deeper desert" that becomes the hook for the next realm.
- [ ] **Post-Tier-Omega loop** — after all 4 quests, the game ends. Add one of: infinite cosmetic recruits (planets, stars, galaxies), a prestige/wipe cycle with a cosmetic badge, or a teaser for the next chapter. Players who hit this wall currently just... stop.
- [ ] **Sky gods mechanical payoff** — meeting all 7 gods is a quest step with no reward beyond completion. Give each god a unique one-time reward: a payout multiplier buff, an extra invite scroll, a cosmetic palette change, or a lore fragment. Seven gods = seven reasons to talk to them.

### New Realm
- [ ] **"The Deeper Desert" (or equivalent)** — the passage beyond the sphinx currently goes to the vault. The vault + sphinx setup is a great Act 2 teaser. Design and implement a fifth realm: underground ruins, a second oasis, or the cosmic upline's "home office" (a literal intergalactic office building). Follow `WORLD_TEMPLATE.md`.

### Mobile
- [ ] **On-screen controls** — add a virtual D-pad (left/right arrows + jump button) and an action button (Space equivalent). Inject them into `index.html` and drive through the same `G.keys` mechanism so realm logic doesn't change. Show on touch devices, hide on desktop.
- [ ] **Touch event handling** — add `touchstart` / `touchend` handlers in `main.js` alongside `keydown`/`keyup`. The `SolidRealm` architecture (`readInput()` reading `G.keys`) is already clean enough for this without touching any realm code.

### Leaderboard
- [ ] **`GET /api/leaderboard`** — top N players by `GameState.earned`, `recruits_made count`, or composite score. Cache aggressively (60s Redis TTL). Render in a sidebar panel. This is one of the strongest retention mechanics for the core loop.

### Quality of Life
- [ ] **Tier stored server-side** — `getTier()` currently counts from the in-memory `G.recruits` array. On a fresh load with many recruits this can show the wrong tier briefly. Store `current_tier` in `GameState.flags` and sync it server-side on buy-in.
- [ ] **Invite resend** — allow resending an invite email to a pending (unused) token. One-line email call, but users will ask for it.
- [ ] **Recruit count in `GET /api/me`** — the frontend needs to hit `/api/recruits` just to know how many recruits to show in the HUD. Add `recruit_count` directly to the `MeResponse` schema to save a round trip.

---

## PHASE 6 — Scaling (When You Have Traction)
*Don't do this speculatively. Do it when metrics say you need it.*

- [ ] **Async email via Supabase Edge Functions** — current `BackgroundTasks` approach is fine at small scale but ties email I/O to the Render backend process. When volume or reliability matters: add a Supabase DB webhook on `users INSERT` → Supabase Edge Function → Resend API. Fully decoupled, free across all three tiers. The DB already lives in Supabase (accessed from Render), so the webhook wiring is the only work.
- [ ] **Redis pub/sub for WS** — the in-memory `ConnectionManager` breaks with multiple backend replicas. When you need horizontal scaling, swap to a Redis channel per `user_id`. The WS router stays the same; only the manager backend changes.
- [ ] **Connection pooling** — add `asyncpg` pool configuration (`pool_size`, `max_overflow`) in `database.py`. Default SQLAlchemy settings are too conservative for concurrent WS connections.
- [ ] **Queue buy-in chain walks** — `run_buyin_chain()` is a synchronous-ish DB walk inside a request. Under load, long chains will hold connections. Move to a background task queue (Celery + Redis, or just FastAPI `BackgroundTasks` for a start) and push WS events asynchronously.
- [ ] **Read replica for leaderboard / analytics queries** — once you have thousands of users, leaderboard queries will impact game latency. Route `SELECT` queries for analytics to a read replica.

---

## QUICK WINS — Do These Anytime (< 30 min each)

- [ ] Add `openssl rand -hex 32` to the README as the documented way to generate `SECRET_KEY`
- [ ] Add `*.js~`, `*~`, `.DS_Store` to `.gitignore` right now
- [ ] Add `balance` to the `state_update` WS event in `payments.py` (3 lines)
- [ ] Add `is_admin: bool = False` column to `User` model + migration (5 lines)
- [ ] Move `cors_origins` to `.env` with a sensible default (2 lines in `config.py`)
- [ ] Add `recruit_count` to `MeResponse` schema (saves a round trip on every login)
- [ ] Add `min_length=8` to `RegisterRequest.password` in `schemas.py`

---

*Last updated: v1.36 review. Revisit this list after each Phase completion.*

---

## FRONTEND ENGINE — Remaining Abstraction Work
*These items were identified during the v1.36 refactor. None are blockers, but each one compounds the next feature.*

### Already done in v1.36 ✓
- [x] `TriggerZone` + `TriggerRegistry` — replaces hardcoded `_xxxNear()` helpers
- [x] `Enemy` class — patrol AI, stun, hurtCheck, surface-snapping
- [x] `Collectible` class — auto-collected on proximity, onCollect callback
- [x] `getPlayerPose()` on `Realm` base + all subclasses — pharaoh draw decoupled from realm internals
- [x] `drawRealmPharaoh(realm)` — single pharaoh draw fn for any realm
- [x] `FlatRealm._walkStep()` syncs G — fixes stale HUD position in crypt/council/vault
- [x] `OasisRealm._syncToG()` — fixes stale G position in oasis
- [x] Shared movement-key-reading helper — deduplicated `ArrowLeft`/`ArrowRight` ± `Shift`-run handling (later superseded by `SolidRealm.readInput()` in the Mario-physics migration; see `engine/solidrealm.js`)
- [x] `_hydrateState()` + `_wireWsEvents()` — extracted from init() monolith

### Still to do
- [ ] **`drawParts()` world-space assumption** — particles in `G.particles` are stored in world-space but `drawParts()` subtracts `G.camX` directly. Non-world realms (oasis, crypt) that emit particles either skip them or emit in wrong space. Fix: add `camX` parameter to `drawParts(camX)` and pass the current realm's camX.
- [ ] **`drawMinimap()` is Earth-only** — hardcodes `WORLD_W`, `Z_LAYERS`, and `GND` from `worlds/earth/constants.js`. Any future realm with its own minimap would need to refactor this. Extract to a `MinimapRenderer` that accepts a world descriptor, or at minimum make the minimap opt-in per realm.
- [ ] **`drawHUD()` shows Earth altitude bar** — the altitude / sky-god indicator reads `surfAt(G.px)` from earth terrain even when the player is in the oasis. Guard with a realm check or make the HUD extensible.
- [ ] **Input routing via `InputManager`** — `main.js` has a `keydown` listener that does `RealmManager.current.onKeyDown(key)`. This works but is a single fan-out point. For mobile touch controls, you'd need to duplicate this routing. Extract to an `InputManager` that translates keyboard + touch → a unified action stream (`'move_left'`, `'jump'`, `'interact'`, etc.) and dispatch to `onAction(action)` instead of `onKeyDown(key)`.
- [ ] **Charm/effect registry for relics** — relics with a *contained* effect already slot in cleanly: clicking any owned item emits `inventory:use {item_id}` (`ui/inventory-panel.js`), a charm just adds a self-contained `Events.on('inventory:use', …)` listener, and shop data is data-driven across `shop.py` (price, source of truth), `catalogue.js` (display order + blurb), and `ware-art.js` (icon). The gap is *complex* charms — their own input, full-screen render, and update loop (like the Astral Lens). `astral.js` is hand-wired into `main.js` by name in 5 places (`AstralSession.onKeyDown`, the `.isWarping` update gate, `.renderOverlay()`, the `realm:enter` suppression, `.init()`). A second astral-tier charm would repeat that and `main.js` would accrete per-charm hooks — against the codebase's register-don't-special-case grain (realms/portals/quests all self-register). Fix **when the second complex charm arrives** (YAGNI — don't build it for one): a small effect registry with an interface (`{ id, onUse, onKeyDown?, update?, render?, blocksWorld? }`) that `main.js` loops over instead of naming, with `AstralSession` as the first registered charm. The extraction is cheap because `astral.js` already separates those concerns into distinct methods. Cheaper to do now instead: a short "adding a relic/charm" template doc (à la `worlds/WORLD_TEMPLATE.md`) capturing the `inventory:use` seam, the three shop locations, and the two sharp edges — the `#dlg` ownership convention (emit `dialogue:start/end`, respect `DialogueManager.isLocked()`) and the cross-cutting `G`-flag render pattern (e.g. `G.astralProjecting`).
- [ ] **Enemy draw() is a no-op stub** — `Enemy.draw(sx, sy)` does nothing. Every enemy type needs its own visual. Either: (a) extend `Enemy` with a subclass per enemy type and override `draw()`, or (b) add a `drawFn` constructor option (`drawFn: (sx, sy, enemy) => void`) for inline definition without subclassing.
- [ ] **`Collectible.draw()` is a no-op stub** — same as Enemy. Add a `drawFn` constructor option or subclass per collectible type.
- [ ] **`QuestManager.check()` is a manual poke** — callers have to remember to call it after state changes. Wire it to fire automatically on `flag:change` events (it already reads flags, so this is just `Events.on('flag:change', () => QuestManager.check())`). The current 10+ scattered `QuestManager.check()` calls could then be removed.
- [ ] **`stele_read` flag has no listener** — the Dream Stele sets `Flags.set('stele_read', true)` and calls `QuestManager.check()`, but no quest step or event uses `stele_read`. Wire it to a narrative unlock or a new quest step. Simplest fix: emit `Events.emit('stele_read', {})` in the Stele dialogue's `onEnter` and listen in `main.js`.
- [ ] **Post-Tier-Omega loop** — see Phase 5 above. The game has a hard stop after quest 4. This is the highest-priority story gap.

