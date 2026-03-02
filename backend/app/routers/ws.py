"""
WebSocket endpoint.  Clients connect with their JWT as a query param:
    ws://host/ws?token=<JWT>

The connection is kept alive by client-side pings every ~25s.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.auth import decode_token
from app.ws import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    ws:    WebSocket,
    token: str = Query(...),
):
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4001)
        return

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        await ws.close(code=4001)
        return

    await manager.connect(user_id, ws)
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)
