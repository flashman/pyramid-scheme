# Backend Changelog

## 0.1.0 — Initial scaffold

### Added
- **FastAPI app** (`app/main.py`) with CORS middleware and lifespan-based table creation
- **Config** (`app/config.py`) — all settings via `.env` using pydantic-settings
- **Async database** (`app/database.py`) — SQLAlchemy 2.0 async engine + session dependency
- **Models** (`app/models.py`)
  - `User` — username, bcrypt password hash, liquid balance
  - `GameState` — one row per user; persists `bought`, `invested`, `earned`, `invites_left`, and a JSON `flags` blob
  - `Recruit` — tree structure for upline chain traversal; supports real user-to-user links and NPC names
  - `Transaction` — append-only financial ledger (buyin, payout, platform_fee)
  - `GameEvent` — audit log for notable in-game events (recruit, milestone, flag_change, etc.)
- **Schemas** (`app/schemas.py`) — Pydantic v2 request/response models for all endpoints
- **Auth** (`app/auth.py`) — bcrypt password hashing, JWT creation, `get_current_user` FastAPI dependency
- **Routers**
  - `POST /api/auth/register` — create account, returns JWT
  - `POST /api/auth/login` — verify credentials, returns JWT
  - `GET  /api/me` — load current user identity + game state
  - `PUT  /api/state` — partial save of game state (flags are merged, not replaced)
  - `POST /api/event` — append a game event to the audit log
  - `POST /api/buy-in` — buy-in flow; runs real Stripe path or stub based on `STRIPE_ENABLED`
  - `POST /api/stripe/webhook` — stubbed; ready for `payment_intent.succeeded` implementation
- **Alembic** migration setup (`alembic/`, `alembic.ini`) configured for async PostgreSQL

### Stubbed / pending
- Stripe payment intent creation (`app/routers/payments.py` — `_create_stripe_payment_intent`)
- Stripe webhook verification and user crediting
- Upline payout chain distribution (tree walk on `recruits` table)
- Soft multiplayer endpoint — serve other players' pyramid positions on world load

## 0.1.1 — Docker support

### Added
- `Dockerfile` — Python 3.12-slim image; runs `alembic upgrade head` then starts uvicorn with `--reload`
- `.dockerignore` — excludes `.env`, `.venv`, `__pycache__`, compiled files
- `docker-compose.yml` (root) — orchestrates `db` (Postgres 16), `backend`, and `frontend` containers
  - `db` healthcheck gates backend startup so migrations never run against an unready database
  - `DATABASE_URL` is injected by compose to point at the `db` service, overriding `.env`
  - Backend source is bind-mounted for hot-reload during development
  - Postgres data persisted in a named `postgres_data` volume
