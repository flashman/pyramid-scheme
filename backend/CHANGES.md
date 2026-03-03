# Backend Changelog

## 0.5.0 — Session persistence & user profile

### Added
- **`GET /api/profile`** — returns the authenticated user's full profile: `id`, `username`, `email`, `balance`, `earned`, `invested`, `recruits` count, and `created_at`. Useful for populating the new profile modal.
- **`PATCH /api/profile/password`** — change password. Requires `current_password` (verified against stored hash) and `new_password` (min 6 chars). Returns `{ ok: true }`.
- **`PATCH /api/profile/username`** — change username (uniqueness enforced). Returns `{ ok, new_token, username }` — the new JWT contains the updated username claim so the client can swap tokens without re-logging in.
- **`PATCH /api/profile/email`** — change or clear email address (uniqueness enforced). Returns `{ ok, email }`.
- **`app/routers/profile.py`** — new router registered at `/api` prefix.
- **`app/schemas.py`** — added `ProfileResponse`, `ChangePasswordRequest`, `ChangeUsernameRequest`, `ChangeEmailRequest`.

---

## 0.4.0 — Backend owns payout config; security & schema hardening


### Added
- **`GET /api/config`** — exposes payout parameters (`entry_fee`, `platform_fee`, `d1_payout`, `decay`, `min_payout`) from `app/payout.py`. Frontend fetches this on login instead of using its own local copy, making the backend the single source of truth.

### Changed
- **`PUT /api/state`** — now only accepts `flags`. The fields `bought`, `earned`, `invested`, and `invites_left` were removed from `SaveStateRequest`; they are server-owned and mutated only by the buy-in flow and chain walk. This closes a vulnerability where any authenticated user could self-assign arbitrary balances or unlimited invite scrolls.
- **Money columns** — `User.balance`, `GameState.invested`, `GameState.earned`, `Recruit.payout`, and `Transaction.amount` changed from `Float` to `Numeric(10, 2)` to avoid floating-point rounding errors.
- **Schema management** — `Base.metadata.create_all()` removed from the app lifespan. Alembic is now the sole authority for schema changes; running both caused silent drift on existing databases.
- **Migrations squashed** — `alembic/versions/0001–0003` consolidated into a single `0001_initial_schema.py` covering the full current schema (including `Numeric` money columns). Safe to apply: `docker compose down -v && docker compose up`.
- **`DELETE /api/dev/sim-users`** — delete query now also filters by `recruit_name LIKE '🤖 %'` in addition to `recruit_id IS NULL`, preventing accidental deletion of real recruit rows if the null assumption ever breaks.
- **`POST /api/dev/sim-recruit`** — background task wrapped in `try/except`; failures are now logged instead of silently swallowed.
- **`POST /api/stripe/webhook`** — stub now includes a `TODO` comment with the exact implementation required (signature verification) before Stripe is enabled.

---



### Fixed
- **Alembic migration `0003`** — failed on a fresh database with `relation "users" does not exist` when attempting to create the `invites` table with a FK before `users` existed. Added the same early-return guard used by migrations 0001/0002: if `users` is not yet in the DB, exit immediately and let SQLAlchemy's `create_all()` build all tables from the current models (which already include `users.email`, `users.recruiter_id`, and `invites`). The migration only applies DDL changes when upgrading an *existing* database that predates these columns.

---

## 0.3.0 — Real invite flow + WebSocket push

### Added
- **`POST /api/invites`** — creates an invite record, decrements `invites_left`, sends email. Dev mode logs the invite URL to the console (no SMTP needed). Set `EMAIL_DEV_MODE=false` and configure `SMTP_*` env vars for real email.
- **`GET /api/invites`** — list invites the current user has sent, with `accepted` status.
- **`PATCH /api/recruits/{id}/meta`** — the frontend patches visual layout data (`pid`, `rootPid`, `zLayer`, `wx`) back after slot assignment. Used for server-created Recruit rows.
- **WebSocket endpoint** `GET /ws?token=JWT` — authenticated real-time event stream. Events pushed:
  - `recruit_joined` — when a user in the current user's downline buys in. Includes `name`, `depth`, `payout`, `db_recruit_id`, `parent_name`.
  - `state_update` — pushed to the buyer on successful buy-in (`bought`, `invites_left`, `invested`).
  - `invite_accepted` — pushed to the inviter when their invitee registers.
- **`app/ws.py`** — `ConnectionManager` singleton; supports multiple connections per user (multiple tabs).
- **`app/email.py`** — async invite email. Dev mode only logs; prod mode uses `smtplib` in a thread pool.
- **`app/payout.py`** — server-side payout math mirroring `frontend/game/config.js`.
- **`app/routers/invites.py`** — invite CRUD.
- **`app/routers/ws.py`** — WebSocket handler.
- **Alembic migration `0003`** — adds `users.email` (unique, nullable), `users.recruiter_id` (self-FK), creates `invites` table.
- **Config additions** (`app/config.py`): `email_dev_mode`, `smtp_*`, `frontend_url`.

### Changed
- **`POST /api/buy-in`** now walks the `recruiter_id` chain up to `max_pay_depth()`. For each ancestor: credits `User.balance`, updates `GameState.earned`, creates `Recruit` + `Transaction` rows, and pushes a `recruit_joined` WebSocket event. All DB writes commit atomically; WS pushes happen after commit.
- **`POST /api/auth/register`** accepts optional `invite_token`. If valid: sets `user.recruiter_id = inviter.id`, `user.email = invitee_email`, marks invite as used, pushes `invite_accepted` WS event to inviter.
- **`GET /api/me`** response now includes `email`.
- `Recruit` rows are now created server-side during buy-in (not by the client). `meta` is an empty `{}` until the frontend patches it.

---

## 0.2.0 — Recruit persistence & pgAdmin
## 0.1.0 — Initial scaffold
