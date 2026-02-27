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
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5500",  # VS Code Live Server
    ]

    # ── Stripe (stubbed) ──────────────────────────────────
    stripe_secret_key: str = "sk_test_stub"
    stripe_webhook_secret: str = "whsec_stub"
    stripe_enabled: bool = False  # flip to True when ready for real payments

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
