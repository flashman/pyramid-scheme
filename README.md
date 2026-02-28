# PYRAMID SCHEME™

A multiplayer browser game about building recruiting empires.

```
pyramid-scheme/
├── docker-compose.yml   ← spin up everything with one command
├── frontend/            Vanilla JS canvas game served via nginx
└── backend/             FastAPI + PostgreSQL API server
```

---

## Quick Start — Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker + Docker Compose.

```bash
# 1. Create your backend env file
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum generate a SECRET_KEY:
#   python -c "import secrets; print(secrets.token_hex(32))"
# DATABASE_URL is automatically overridden by docker-compose — no need to change it.

# 2. Start everything
docker compose up --build

# 3. Open the game
open http://localhost:5173
```

That's it. Docker starts four containers:

| Container  | What it does                           | Local port |
|------------|----------------------------------------|------------|
| `db`       | PostgreSQL 16                          | 5432       |
| `backend`  | FastAPI + auto-runs Alembic migrations | 8000       |
| `frontend` | nginx serving the static game files    | 5173       |
| `pgadmin`  | pgAdmin 4 — browse/query the DB        | 5050       |

The frontend nginx config proxies `/api/*` to the backend, so the browser
only ever talks to one origin. API docs: http://localhost:8000/docs

**pgAdmin** is at http://localhost:5050 — no login required (desktop mode).
The `pyramid_scheme` database is pre-registered; expand
*Servers → Pyramid Scheme DB* in the left panel.

**Useful commands:**

```bash
docker compose up --build      # rebuild images and start
docker compose up              # start without rebuilding
docker compose down            # stop containers
docker compose down -v         # stop and delete the database volume
docker compose logs backend    # tail backend logs
docker compose logs -f         # tail all logs
```

---

## Quick Start — Without Docker

### Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env: set DATABASE_URL to your local Postgres and generate a SECRET_KEY

createdb pyramid_scheme          # Postgres must be running locally
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Option A: VS Code Live Server
#   Right-click index.html → "Open with Live Server" (port 5500)
#   Set VITE_API_URL=http://localhost:8000 or edit BASE in game/api.js

# Option B: Python
python -m http.server 5173

# Option C: Vite (enables HMR)
npx vite --port 5173
```

When running without Docker, set `VITE_API_URL=http://localhost:8000` so the
frontend knows where the backend is (nginx isn't doing the proxying).

---

## Architecture

```
Browser → http://localhost:5173
  └── nginx (frontend container)
        ├── /          → serves static game files
        └── /api/*     → proxied to backend:8000

FastAPI (backend container, port 8000)
  └── backend/app/
        ├── main.py           App entry, CORS, router mounts
        ├── config.py         Settings from .env
        ├── database.py       Async SQLAlchemy + session dep
        ├── models.py         User, GameState, Recruit, Transaction, GameEvent
        ├── schemas.py        Pydantic request/response shapes
        ├── auth.py           JWT + bcrypt helpers
        └── routers/
              ├── auth.py     POST /api/auth/register, /login
              ├── game.py     GET /api/me, PUT /api/state, POST /api/event
              │               GET /api/recruits, POST /api/recruits
              └── payments.py POST /api/buy-in (Stripe stubbed)

PostgreSQL (db container, port 5432)
  └── Tables: users, game_states, recruits, transactions, game_events

pgAdmin (pgadmin container, port 5050)
  └── Pre-connected to the pyramid_scheme database
```

---

## Key Frontend Files Changed

| File                            | What changed                                       |
|---------------------------------|----------------------------------------------------|
| `game/api.js`                   | New — fetch wrapper, JWT token mgmt, same-origin BASE |
| `ui/auth.js`                    | New — login/register overlay                       |
| `main.js`                       | Auth gate + `/api/me` load before game loop starts |
| `ui/dev-panel.js`               | Bugfix: pyramid objects now use `mkPyr`/`addLayer` |
| `worlds/earth/draw/pyramids.js` | Bugfix: missing `]` in FLAG_GROUPS                 |

---

## Enabling Real Payments (Stripe)

1. Set `STRIPE_ENABLED=true` in `backend/.env`
2. Add real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
3. Implement `_create_stripe_payment_intent()` in `backend/app/routers/payments.py`
4. Implement the webhook handler in the same file for `payment_intent.succeeded`

---

## Database Migrations

After changing `backend/app/models.py`:

```bash
# If using Docker:
docker compose exec backend alembic revision --autogenerate -m "describe change"
docker compose exec backend alembic upgrade head

# If running locally:
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```
