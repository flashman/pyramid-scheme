from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, game, payments

# ── Create tables on startup (use Alembic for prod migrations) ──
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Pyramid Scheme API",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/auth",     tags=["auth"])
app.include_router(game.router,     prefix="/api",          tags=["game"])
app.include_router(payments.router, prefix="/api",          tags=["payments"])


@app.get("/health")
def health():
    return {"status": "ok"}
