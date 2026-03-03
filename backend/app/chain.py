"""
Shared upline chain-walk logic.

Used by both:
  - routers/payments.py  (real buy-in)
  - routers/dev.py       (simulated buy-in, debug only)

run_buyin_chain(recruiter_id, buyer_name, buyer_user_id, db)
  → walks the recruiter_id chain, credits ancestors, creates Recruit +
    Transaction rows, returns a list of (user_id, ws_event) tuples.
    Caller commits the DB session and then pushes the WS events.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GameState, Recruit, Transaction, User
from app.payout import max_pay_depth, payout_at_depth


async def run_buyin_chain(
    first_recruiter_id: int,
    buyer_name: str,
    buyer_user_id: int | None,
    db: AsyncSession,
) -> list[tuple[int, dict]]:
    """
    Walk the upline chain starting at `first_recruiter_id`.

    For each ancestor:
      - credit balance + GameState.earned
      - append a Recruit row (meta left empty; frontend patches it)
      - append a Transaction row

    Returns a list of (user_id, ws_event_dict) to be pushed after commit.
    Does NOT commit — caller is responsible.
    """
    ws_events: list[tuple[int, dict]] = []
    chain_usernames: list[str] = []
    ancestor_uid = first_recruiter_id
    depth = 1
    max_depth = max_pay_depth()

    while ancestor_uid and depth <= max_depth:
        anc_res = await db.execute(select(User).where(User.id == ancestor_uid))
        ancestor = anc_res.scalar_one_or_none()
        if not ancestor:
            break

        payout = payout_at_depth(depth)
        if payout <= 0:
            break

        # Credit ancestor
        ancestor.balance = round(float(ancestor.balance or 0) + payout, 2)

        anc_gs = await db.execute(
            select(GameState).where(GameState.user_id == ancestor.id)
        )
        ancestor_state = anc_gs.scalar_one_or_none()
        if ancestor_state:
            ancestor_state.earned = round(float(ancestor_state.earned or 0) + payout, 2)

        parent_name = chain_usernames[-1] if chain_usernames else None

        recruit_row = Recruit(
            recruiter_id=ancestor.id,
            recruit_id=buyer_user_id,  # None for sim recruits
            recruit_name=buyer_name,
            parent_name=parent_name,
            depth=depth,
            payout=payout,
            meta={},
        )
        db.add(recruit_row)

        db.add(
            Transaction(
                user_id=ancestor.id,
                type="recruit_payout",
                amount=payout,
                ref_id=str(buyer_user_id) if buyer_user_id else "sim",
                meta={"recruit_name": buyer_name, "depth": depth},
            )
        )

        # Flush to get recruit_row.id before appending ws_event
        await db.flush()

        ws_events.append(
            (
                ancestor.id,
                {
                    "type": "recruit_joined",
                    "name": buyer_name,
                    "depth": depth,
                    "payout": payout,
                    "db_recruit_id": recruit_row.id,
                    "parent_name": parent_name,
                },
            )
        )

        chain_usernames.append(ancestor.username)
        ancestor_uid = ancestor.recruiter_id
        depth += 1

    return ws_events
