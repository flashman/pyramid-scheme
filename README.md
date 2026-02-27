# PYRAMID SCHEME™

A multiplayer browser game about building recruiting empires.

```
pyramid-scheme/
├── frontend/     Vanilla JS canvas game (no build step required)
└── backend/      FastAPI + PostgreSQL API server
```

---

## Quick Start

### 1 — Backend

```bash
cd backend

# Create and activate a Python virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL and generate a SECRET_KEY:
#   python -c "import secrets; print(secrets.token_hex(32))"

# Create the database (PostgreSQL must be running)
createdb pyramid_scheme

# Run migrations
alembic upgrade head

# Start the dev server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

### 2 — Frontend

The frontend is plain ES modules — no build step needed.

```bash
cd frontend

# Option A: VS Code Live Server
#   Right-click index.html → "Open with Live Server"
#   (default port 5500 is already in backend CORS_ORIGINS)

# Option B: Python simple server
python -m http.server 5173

# Option C: Vite (recommended for dev, enables HMR)
npm create vite@latest . -- --template vanilla
# then copy your files in, or just:
npx vite --port 5173
```

The frontend talks to the backend at `http://localhost:8000` by default.
To change this, set `VITE_API_URL` as an environment variable (if using Vite)
or edit the `BASE` constant at the top of `frontend/game/api.js`.

---

## Architecture

```
Browser
  └── frontend/
        ├── main.js           Boot, auth gate, game loop
        ├── game/api.js       Fetch wrapper (all server calls)
        ├── ui/auth.js        Login/register overlay
        └── ...               Game engine, worlds, UI panels

FastAPI server (port 8000)
  └── backend/app/
        ├── main.py           App entry point, CORS, router mounts
        ├── config.py         Settings from .env
        ├── database.py       Async SQLAlchemy engine + session dep
        ├── models.py         User, GameState, Recruit, Transaction, GameEvent
        ├── schemas.py        Pydantic request/response shapes
        ├── auth.py           JWT + bcrypt helpers
        └── routers/
              ├── auth.py     POST /api/auth/register, /login
              ├── game.py     GET /api/me, PUT /api/state, POST /api/event
              └── payments.py POST /api/buy-in (Stripe stubbed)

PostgreSQL
  └── Tables: users, game_states, recruits, transactions, game_events
```

---

## Key Frontend Files Changed This Session

| File                   | What changed                                      |
|------------------------|---------------------------------------------------|
| `game/api.js`          | New — thin fetch wrapper with JWT token mgmt      |
| `ui/auth.js`           | New — login/register overlay                      |
| `main.js`              | Auth gate + `/api/me` load before game loop start |
| `ui/dev-panel.js`      | Bugfix: pyramid objects now use `mkPyr`/`addLayer`|
| `worlds/earth/draw/pyramids.js` | Bugfix: missing `]` in FLAG_GROUPS      |

---

## Enabling Real Payments (Stripe)

1. Set `STRIPE_ENABLED=true` in `backend/.env`
2. Add real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
3. Implement `_create_stripe_payment_intent()` in `backend/app/routers/payments.py`
4. Implement the webhook handler to credit users after `payment_intent.succeeded`

---

## Database Migrations

After any change to `backend/app/models.py`:

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```
