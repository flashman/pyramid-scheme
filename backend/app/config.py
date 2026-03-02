from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/pyramid_scheme"

    # ── Auth ──────────────────────────────────────────────
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week

    # ── CORS ─────────────────────────────────────────────
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5500",
    ]

    # ── Debug / dev sim ───────────────────────────────────
    # Enables /api/dev/* endpoints and routes email through Mailhog.
    # Never set true in production.
    debug: bool = True

    # ── Email ─────────────────────────────────────────────
    # In debug mode these default to Mailhog (docker service).
    # In production set DEBUG=false and provide real SMTP credentials.
    smtp_host:     str  = "mailhog"   # Docker service name; use "localhost" outside Docker
    smtp_port:     int  = 1025        # Mailhog SMTP port (no auth, no TLS)
    smtp_tls:      bool = False
    smtp_user:     str  = ""
    smtp_password: str  = ""
    smtp_from:     str  = "noreply@pyramidscheme.gg"

    # URL embedded in invite email links
    frontend_url: str = "http://localhost:5173"

    # ── Stripe (stubbed) ──────────────────────────────────
    stripe_secret_key:     str  = "sk_test_stub"
    stripe_webhook_secret: str  = "whsec_stub"
    stripe_enabled:        bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
