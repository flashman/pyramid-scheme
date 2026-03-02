# Backend Changelog

## 0.3.1 — Migration fix (fresh DB)

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
