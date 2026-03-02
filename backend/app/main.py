import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, game, payments
from app.routers import invites as invites_router
from app.routers import ws as ws_router

logger = logging.getLogger(__name__)


async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Pyramid Scheme API",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── HTTP routers ──────────────────────────────────────────
app.include_router(auth.router,           prefix="/api/auth", tags=["auth"])
app.include_router(game.router,           prefix="/api",      tags=["game"])
app.include_router(payments.router,       prefix="/api",      tags=["payments"])
app.include_router(invites_router.router, prefix="/api",      tags=["invites"])

# ── WebSocket ─────────────────────────────────────────────
app.include_router(ws_router.router, tags=["websocket"])

# ── Dev/sim endpoints (debug only) ────────────────────────
if settings.debug:
    from app.routers import dev as dev_router
    app.include_router(dev_router.router, prefix="/api", tags=["dev"])
    logger.warning(
        "⚠  DEBUG=true — /api/dev/* endpoints are active. "
        "Never enable this in production."
    )


@app.get("/health")
def health():
    return {"status": "ok", "debug": settings.debug}
