"""
Recruit presence — who's online, surfaced to their direct recruiter.

This is the single seam between the (currently in-memory) presence source and
the recruiter notification. A future multi-instance backplane (Redis TTL key +
pub/sub) replaces the body of `notify_presence` without touching callers or the
`recruit_presence` wire event. See the single-instance invariant in CLAUDE.md.
"""
from __future__ import annotations
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Recruit
from app.ws import manager

logger = logging.getLogger(__name__)


async def direct_recruiter_id(db: AsyncSession, user_id: int) -> int | None:
    """The user_id of this user's direct (depth=1) recruiter, or None.

    A buy-in inserts a fresh depth=1 Recruit row each time (chain.py), so a
    rebought recruit has several depth=1 rows — all carrying the same
    recruiter_id. limit(1) keeps this a safe single indexed lookup
    (ix_recruits_recruit_id) instead of raising MultipleResultsFound."""
    return (await db.execute(
        select(Recruit.recruiter_id).where(
            Recruit.recruit_id == user_id,
            Recruit.depth      == 1,
        ).limit(1)
    )).scalar_one_or_none()


async def notify_presence(user_id: int, online: bool) -> None:
    """Push a recruit_presence event to user_id's direct recruiter, if any.

    Opens its own short-lived session — called from the WS connect/disconnect
    path, which holds no DB session. No-op when the user has no recruiter.
    Best-effort: presence is non-critical, so any failure is logged and
    swallowed rather than allowed to drop the user's socket."""
    try:
        async with AsyncSessionLocal() as db:
            recruiter_id = await direct_recruiter_id(db, user_id)
        if recruiter_id is None:
            return
        await manager.send_to_user(recruiter_id, {
            "type": "recruit_presence", "user_id": user_id, "online": online,
        })
    except Exception:
        logger.exception("notify_presence failed for user_id=%s", user_id)


async def on_socket_connect(user_id: int, ws) -> None:
    """Accept the socket and push 'online' only on the offline→online edge.

    Capturing is_connected BEFORE manager.connect is what makes multi-tab
    correct: the 2nd+ tab finds the user already online and pushes nothing."""
    was_online = manager.is_connected(user_id)
    await manager.connect(user_id, ws)
    if not was_online:
        await notify_presence(user_id, online=True)


async def on_socket_disconnect(user_id: int, ws) -> None:
    """Drop the socket and push 'offline' only on the online→offline edge
    (i.e. the user's last remaining tab just closed)."""
    manager.disconnect(user_id, ws)
    if not manager.is_connected(user_id):
        await notify_presence(user_id, online=False)
