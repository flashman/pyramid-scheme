# ⚡ PYRAMID SCHEME™

> WALK THE DESERT ★ BUILD YOUR EMPIRE ★ TOTALLY LEGAL™

A satirical pyramid scheme simulator with a real backend. Users invite friends via email, friends buy in, money flows up the chain in real time via WebSocket.

---

## Services

| Service   | URL                         | Purpose                              |
|-----------|-----------------------------|--------------------------------------|
| Frontend  | http://localhost:5173       | Game (nginx static + API proxy)      |
| Backend   | http://localhost:8000       | FastAPI (internal — proxied by nginx)|
| Database  | localhost:5432              | PostgreSQL                           |
| pgAdmin   | http://localhost:5050       | DB browser (no login required)       |
| **Mailhog**   | **http://localhost:8025**   | **Caught invite emails (dev)**       |

---

## Quick start

```bash
docker compose up --build
# → Game:    http://localhost:5173
# → Emails:  http://localhost:8025  (all outgoing email is caught here)
# → DB:      http://localhost:5050
```

Run migrations (first time, or after schema changes):
```bash
docker compose exec backend alembic upgrade head
```

---

## Dev workflow

### Invite flow (real path)
1. Register, buy in → you get 4 invite scrolls
2. Click **SEND SCROLL** → enter an email address
3. Check **Mailhog** at `:8025` — the invite email lands there instantly
4. Copy the invite link from the email, open it in an incognito tab
5. Register as a new user → the inviter's browser gets a WS `invite_accepted` notification
6. Buy in as the new user → the chain walk fires, the inviter sees a new pyramid appear in real time

### Simulate without a second browser (dev panel)
1. Log in, buy in
2. Press **`** (backtick) to open the dev panel
3. The **🤖 SIMULATE RECRUITS** section appears at the top
4. Choose depth (D1/D2/D3) and delay (0–10s), click **► SIM RECRUIT**
5. The backend runs the real chain-walk — DB writes, payout credits, WS event
6. After the delay, your pyramid gains a layer and the activity log updates

The sim uses the same `run_buyin_chain()` function as a real buy-in. The only difference: the simulated "user" has no real account row; their `Recruit` records have `recruit_id = NULL` and a name like `🤖 PHARAOH_X7K2A`.

Use **🗑 CLEAR SIMS** to remove all sim recruit rows from the DB.

### Email in production
Set in `.env`:
```
DEBUG=false
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=you@yourdomain.com
SMTP_PASSWORD=your_app_password
```
Setting `DEBUG=false` also disables `/api/dev/*` endpoints entirely.

---

## Architecture

```
Browser
  │
  ├─ HTTP /api/*  ──► nginx ──► FastAPI (port 8000)
  │                                │
  └─ WS   /ws     ──► nginx ──►   │
                                   ├─ PostgreSQL
                                   └─ Mailhog SMTP (dev)
```

**Key backend files**
- `app/chain.py` — upline chain-walk logic (shared by buy-in and dev sim)
- `app/ws.py` — WebSocket connection manager (multi-tab per user)
- `app/email.py` — SMTP sender (Mailhog in dev, real SMTP in prod)
- `app/routers/dev.py` — simulation endpoints (gated behind `DEBUG=true`)

**Key frontend files**
- `game/ws.js` — WS client with auto-reconnect + keep-alive
- `game/recruits.js` — `addRecruit()` handles both real WS arrivals and local guest sim
- `ui/dev-panel.js` — dev panel including the sim section

---

## Migrations

```bash
# Apply all
docker compose exec backend alembic upgrade head

# History
docker compose exec backend alembic history
```

Migration files:
- `0001_initial_schema` — full schema from scratch (squashed from earlier incremental migrations)

---

## Troubleshooting

**Starting fresh (wipe all data)**
```bash
docker compose down -v   # removes the db volume
docker compose up --build
```

**WebSocket 502 from nginx**
Usually means the backend is crash-looping (check `docker compose logs backend`). Fix the underlying backend error and the WS connection will recover automatically — the frontend reconnects with exponential back-off.
