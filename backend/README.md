# Pyramid Scheme — Backend

FastAPI + PostgreSQL backend for user auth, game state persistence, and payments.

## Setup

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and generate a SECRET_KEY

# 4. Create the database (PostgreSQL must be running)
createdb pyramid_scheme

# 5. Run migrations
alembic upgrade head

# 6. Start the dev server
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

---

## Endpoints

| Method | Path                  | Auth | Description                        |
|--------|-----------------------|------|------------------------------------|
| POST   | /api/auth/register    | —    | Create account, returns JWT        |
| POST   | /api/auth/login       | —    | Login, returns JWT                 |
| GET    | /api/me               | ✓    | Fetch player state                 |
| PUT    | /api/state            | ✓    | Save player state                  |
| POST   | /api/event            | ✓    | Log a game event (recruit, etc.)   |
| POST   | /api/buy-in           | ✓    | Buy-in (Stripe stubbed)            |
| POST   | /api/stripe/webhook   | —    | Stripe webhook (stubbed)           |

---

## Enabling Stripe

1. Set `STRIPE_ENABLED=true` in `.env`
2. Add your real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
3. Implement `_create_stripe_payment_intent` in `app/routers/payments.py`
4. Implement the webhook handler to credit users after `payment_intent.succeeded`

---

## Migrations

```bash
# After changing models.py:
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```
