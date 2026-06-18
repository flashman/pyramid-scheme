import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base, User, GameState
from app.auth import hash_password, create_access_token

DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    app.dependency_overrides[get_db] = override_get_db
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()


async def make_user(username="buyer", earned=100.0, invites=0, flags=None):
    """Insert a bought-in user + GameState; return the user id."""
    async with TestingSessionLocal() as db:
        u = User(username=username, password_hash=hash_password("password123"))
        db.add(u)
        await db.flush()
        db.add(GameState(user_id=u.id, bought=True, earned=earned,
                         invites_left=invites, flags=flags or {}))
        await db.commit()
        return u.id


def auth_headers(uid, username="buyer"):
    return {"Authorization": f"Bearer {create_access_token(uid, username)}"}
