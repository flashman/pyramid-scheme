"""
Server-side payout math.
Mirrors frontend game/config.js — must stay in sync with CFG defaults there.
"""
from __future__ import annotations

# These defaults must match CFG in frontend/game/config.js
_DEFAULT = {
    "d1_payout":    4.0,
    "decay":        0.5,
    "min_payout":   0.01,
    "platform_fee": 2.0,
    "entry_fee":    10.0,
}


def payout_at_depth(depth: int, cfg: dict | None = None) -> float:
    c = cfg or _DEFAULT
    p = c["d1_payout"] * (c["decay"] ** (depth - 1))
    return round(p, 2) if p >= c["min_payout"] else 0.0


def max_pay_depth(cfg: dict | None = None) -> int:
    d = 1
    while payout_at_depth(d, cfg) > 0 and d < 50:
        d += 1
    return d - 1
