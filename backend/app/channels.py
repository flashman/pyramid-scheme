"""
Channel registry — maps (owner_id | None, realm_id) → set[WebSocket].

Personal realm:  (user_id, realm_id)
System realm:    (None,    realm_id)   — reserved for future cantina/ocean

Every connected player occupies exactly one channel. Moving realms means
leave-old + join-new. Projection means joining the target's channel instead
of your own.
"""
from __future__ import annotations
from fastapi import WebSocket


class ChannelRegistry:
    def __init__(self):
        self._channels: dict[tuple, set[WebSocket]] = {}
        self._ws_channel: dict[WebSocket, tuple] = {}

    async def join(self, ws: WebSocket, key: tuple) -> None:
        """Move ws to key; leave any prior channel first."""
        self.leave(ws)
        self._channels.setdefault(key, set()).add(ws)
        self._ws_channel[ws] = key

    def leave(self, ws: WebSocket) -> tuple | None:
        """Remove ws from its current channel. Returns the old key or None."""
        old_key = self._ws_channel.pop(ws, None)
        if old_key is not None:
            bucket = self._channels.get(old_key)
            if bucket:
                bucket.discard(ws)
                if not bucket:
                    del self._channels[old_key]
        return old_key

    async def broadcast(self, key: tuple, event: dict,
                        exclude: WebSocket | None = None) -> None:
        """Send event JSON to all sockets in key, pruning dead ones."""
        dead: list[WebSocket] = []
        for ws in list(self._channels.get(key, set())):
            if ws is exclude:
                continue
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.leave(ws)

    def peers(self, key: tuple,
              exclude: WebSocket | None = None) -> list[WebSocket]:
        return [ws for ws in self._channels.get(key, set()) if ws is not exclude]

    def channel_of(self, ws: WebSocket) -> tuple | None:
        return self._ws_channel.get(ws)


channels = ChannelRegistry()
