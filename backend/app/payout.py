"""
Server-side payout math.
PAYOUT_CONFIG is the single source of truth for all payout parameters.
GET /api/config serves this to the frontend so values never need to be
duplicated in frontend/game/config.js.
"""
from __future__ import annotations

PAYOUT_CONFIG: dict = {
    "d1_payout":    4.0,
    "decay":        0.5,
    "min_payout":   0.01,
    "platform_fee": 2.0,
    "entry_fee":    10.0,
}


def payout_at_depth(depth: int, cfg: dict | None = None) -> float:
    c = cfg or PAYOUT_CONFIG
    p = c["d1_payout"] * (c["decay"] ** (depth - 1))
    return round(p, 2) if p >= c["min_payout"] else 0.0


def max_pay_depth(cfg: dict | None = None) -> int:
    d = 1
    while payout_at_depth(d, cfg) > 0 and d < 50:
        d += 1
    return d - 1
