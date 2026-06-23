"""
WebSocket endpoint.  Clients connect with JWT as a query param:
    ws://host/ws?token=<JWT>

Client → Server typed messages (JSON objects with a `type` field):
  realm_enter   {realm, owner_id}           — player entered a realm
  pose_update   {px, py, pZ, facing, frame} — position broadcast (~10 Hz)
  chat          {text}                       — channel-scoped chat (≤200 chars)
  project_start {target_user_id}            — initiate projection (Task 3)
  project_end   {}                          — end projection session (Task 3)

The string "ping" is still handled for keep-alive.
"""
import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from app.auth import decode_token
from app.database import AsyncSessionLocal
from app.models import Recruit, Inventory, User
from app.ws import manager
from app.channels import channels

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4001)
        return
    try:
        user_id  = int(payload["sub"])
        username = payload.get("username", str(user_id))
    except (KeyError, ValueError, TypeError):
        await ws.close(code=4001)
        return

    await manager.connect(user_id, ws)
    manager.set_meta(ws, user_id=user_id, username=username,
                     channel_key=None, px=0, py=0, pZ=0,
                     facing=1, frame=0, projection_session=None)
    try:
        while True:
            text = await ws.receive_text()
            await _dispatch(ws, user_id, username, text)
    except WebSocketDisconnect:
        await _handle_disconnect(ws, user_id, username)


async def _dispatch(ws: WebSocket, user_id: int, username: str, text: str):
    if text == "ping":
        await ws.send_text("pong")
        return
    try:
        msg = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return
    t = msg.get("type")
    if   t == "realm_enter":   await _on_realm_enter(ws, user_id, username, msg)
    elif t == "pose_update":   await _on_pose_update(ws, user_id, msg)
    elif t == "chat":          await _on_chat(ws, user_id, username, msg)
    elif t == "project_start": await _on_project_start(ws, user_id, username, msg)
    elif t == "project_end":   await _on_project_end(ws, user_id, username)
    # unknown types silently dropped


async def _on_realm_enter(ws: WebSocket, user_id: int, username: str, msg: dict):
    realm    = msg.get("realm", "world")
    owner_id = msg.get("owner_id")
    meta     = manager.get_meta(ws)
    session  = meta.get("projection_session")

    # Only allow joining own channel or an active projection target's channel
    if owner_id == user_id:
        new_key = (user_id, realm)
    elif session and session.get("target_id") == owner_id:
        new_key = (owner_id, realm)
    else:
        return  # unauthorized — stay in current channel

    old_key = channels.channel_of(ws)

    # Notify old channel this player left
    if old_key:
        await channels.broadcast(old_key,
                                 {"type": "peer_left", "username": username},
                                 exclude=ws)

    # If host is transitioning realms, carry visitors along.
    # Snapshot peers BEFORE join() moves ws out of old_key.
    if owner_id == user_id and old_key and old_key[0] == user_id:
        visitors = channels.peers(old_key)
        for visitor_ws in visitors:
            v_meta = manager.get_meta(visitor_ws)
            v_session = v_meta.get("projection_session") or {}
            if v_session.get("target_id") == user_id:
                await channels.join(visitor_ws, new_key)
                manager.set_meta(visitor_ws, channel_key=new_key)
                await visitor_ws.send_json({
                    "type": "host_realm_changed",
                    "realm": realm,
                    "world_state": {"realm": realm, "recruits": [], "owner_username": username},
                })

    await channels.join(ws, new_key)
    manager.set_meta(ws, channel_key=new_key)

    # Announce arrival to new channel
    await channels.broadcast(new_key, {
        "type": "peer_entered", "username": username,
        "px": meta.get("px", 0), "py": meta.get("py", 0),
        "pZ": meta.get("pZ", 0), "facing": meta.get("facing", 1),
        "frame": meta.get("frame", 0),
        "is_projector": bool(session),
    }, exclude=ws)


async def _on_pose_update(ws: WebSocket, user_id: int, msg: dict):
    meta = manager.get_meta(ws)
    key  = meta.get("channel_key")
    if not key:
        return
    manager.set_meta(ws,
                     px=msg.get("px", 0), py=msg.get("py", 0),
                     pZ=msg.get("pZ", 0), facing=msg.get("facing", 1),
                     frame=msg.get("frame", 0))
    await channels.broadcast(key, {
        "type": "peer_pose", "username": meta["username"],
        "px": msg.get("px", 0), "py": msg.get("py", 0),
        "pZ": msg.get("pZ", 0), "facing": msg.get("facing", 1),
        "frame": msg.get("frame", 0),
    }, exclude=ws)


async def _on_chat(ws: WebSocket, user_id: int, username: str, msg: dict):
    text = str(msg.get("text", ""))[:200]
    if not text.strip():
        return
    key = manager.get_meta(ws).get("channel_key")
    if not key:
        return
    await channels.broadcast(key, {
        "type": "chat_message", "from_username": username, "text": text,
    })


async def _on_project_start(ws: WebSocket, user_id: int, username: str, msg: dict):
    target_id = msg.get("target_user_id")
    if not isinstance(target_id, int):
        return

    async with AsyncSessionLocal() as db:
        # 1. Validate: target is a direct (depth=1) real recruit of this user
        recruit_row = (await db.execute(
            select(Recruit).where(
                Recruit.recruiter_id == user_id,
                Recruit.recruit_id   == target_id,
                Recruit.recruit_id   != None,      # noqa: E711
                Recruit.depth        == 1,
            )
        )).scalar_one_or_none()
        if not recruit_row:
            return

        # 2. Validate: projector owns astral_lens
        inv = (await db.execute(
            select(Inventory).where(
                Inventory.user_id == user_id,
                Inventory.item_id == "astral_lens",
                Inventory.quantity >= 1,
            )
        )).scalar_one_or_none()
        if not inv:
            return

        # 3. Validate: target is online
        if not manager.is_connected(target_id):
            return

        # 4. Fetch target's recruits for world_state
        target_recruits = (await db.execute(
            select(Recruit).where(Recruit.recruiter_id == target_id)
        )).scalars().all()

        # 5. Fetch target username
        target_user = (await db.execute(
            select(User).where(User.id == target_id)
        )).scalar_one_or_none()
        target_username = target_user.username if target_user else str(target_id)

    recruits_payload = [
        {"id": r.id, "name": r.recruit_name, "depth": r.depth,
         "payout": float(r.payout), "parent_name": r.parent_name, "meta": r.meta}
        for r in target_recruits
    ]

    # 6. Notify target — "A presence stirs"
    await manager.send_to_user(target_id, {
        "type": "projection_started", "from_username": username,
    })

    # 7. Find target's current realm from their socket metadata
    target_realm = "world"
    for t_ws in list(getattr(manager, "_conns", {}).get(target_id, [])):
        t_meta = manager.get_meta(t_ws)
        if t_meta.get("channel_key"):
            target_realm = t_meta["channel_key"][1]
            break

    # 8. Send world_state point-to-point to projector only
    meta = manager.get_meta(ws)
    await ws.send_json({
        "type": "world_state",
        "realm": target_realm,
        "owner_username": target_username,
        "recruits": recruits_payload,
    })

    # 9. Move projector into target's channel
    own_channel = meta.get("channel_key") or (user_id, "world")
    new_key = (target_id, target_realm)
    await channels.join(ws, new_key)

    # 10. Broadcast peer_entered to target's channel (excluding projector)
    await channels.broadcast(new_key, {
        "type": "peer_entered", "username": username,
        "px": meta.get("px", 0), "py": meta.get("py", 0),
        "pZ": meta.get("pZ", 0), "facing": meta.get("facing", 1),
        "frame": meta.get("frame", 0), "is_projector": True,
    }, exclude=ws)

    # 11. Schedule server-authoritative 180s expiry
    expiry_task = asyncio.create_task(_projection_expiry(ws, user_id, username))
    manager.set_meta(ws,
                     channel_key=new_key,
                     projection_session={
                         "target_id": target_id,
                         "own_channel": own_channel,
                         "expiry_task": expiry_task,
                     })


async def _projection_expiry(ws: WebSocket, user_id: int, username: str):
    await asyncio.sleep(180)
    await _on_project_end(ws, user_id, username, reason="timeout")


async def _on_project_end(ws: WebSocket, user_id: int, username: str,
                          reason: str = "departed"):
    meta    = manager.get_meta(ws)
    session = meta.get("projection_session")
    if not session:
        return

    # Cancel expiry timer if still running
    task = session.get("expiry_task")
    if task:
        task.cancel()

    target_id   = session["target_id"]
    old_key     = channels.channel_of(ws)
    own_channel = session.get("own_channel") or (user_id, "world")

    # Notify old channel: ghost leaves
    if old_key:
        await channels.broadcast(old_key,
                                 {"type": "peer_left", "username": username},
                                 exclude=ws)

    # Restore projector to own channel
    await channels.join(ws, own_channel)
    manager.set_meta(ws, channel_key=own_channel, projection_session=None)

    # Notify both parties session ended
    ended_event = {"type": "projection_ended", "from_username": username, "reason": reason}
    await ws.send_json(ended_event)
    await manager.send_to_user(target_id, ended_event)


async def _handle_disconnect(ws: WebSocket, user_id: int, username: str):
    key = channels.channel_of(ws)
    if key:
        await channels.broadcast(key, {"type": "peer_left", "username": username})
        channels.leave(ws)
    manager.disconnect(user_id, ws)
