"""
WebSocket connection manager.
Singleton imported by routers that need to push real-time events.
"""
from __future__ import annotations
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks live WebSocket connections, keyed by user_id.
    Multiple connections per user are supported (multiple tabs / devices)."""

    def __init__(self):
        # user_id → set[WebSocket]
        self._conns: dict[int, set[WebSocket]] = {}
        self._meta: dict[WebSocket, dict] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self._conns.setdefault(user_id, set()).add(ws)
        total = sum(len(v) for v in self._conns.values())
        logger.info(f"WS connect: user={user_id}  total_conns={total}")

    def disconnect(self, user_id: int, ws: WebSocket):
        bucket = self._conns.get(user_id)
        if bucket:
            bucket.discard(ws)
            if not bucket:
                del self._conns[user_id]
        self.remove_meta(ws)

    async def send_to_user(self, user_id: int, data: dict) -> bool:
        """Push a JSON event to all active connections for user_id.
        Returns True if at least one message was delivered."""
        dead: list[WebSocket] = []
        delivered = False
        for ws in list(self._conns.get(user_id, [])):
            try:
                await ws.send_json(data)
                delivered = True
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)
        return delivered

    def is_connected(self, user_id: int) -> bool:
        return bool(self._conns.get(user_id))

    def set_meta(self, ws: WebSocket, **kwargs) -> None:
        self._meta.setdefault(ws, {}).update(kwargs)

    def get_meta(self, ws: WebSocket) -> dict:
        return self._meta.get(ws, {})

    def remove_meta(self, ws: WebSocket) -> None:
        self._meta.pop(ws, None)


# Module-level singleton — import `manager` wherever you need to push events.
manager = ConnectionManager()
