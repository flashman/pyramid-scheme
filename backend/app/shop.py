"""
Server-side shop catalogue.
SHOP_CATALOGUE is the single source of truth for ware prices and behaviour,
mirroring app/payout.py. Frontend reads prices via GET /api/config; it never
hardcodes them. `effect` is internal and never exposed to clients.
"""
from __future__ import annotations

SHOP_CATALOGUE: dict = {
    "invite_scroll":      {"name": "Invite Scroll",                        "price": 5,  "kind": "consumable", "effect": {"type": "invites", "amount": 1}},
    "protection_scroll":  {"name": "Protection Scroll",                    "price": 8,  "kind": "keepsake"},
    "scarab_amulet":      {"name": "Scarab Amulet",                        "price": 9,  "kind": "keepsake"},
    "blank_scroll":       {"name": "Blank Scroll",                         "price": 3,  "kind": "keepsake"},
    "future_receipt":     {"name": "A Receipt from the Future",           "price": 13, "kind": "keepsake"},
    "bronze_coin":        {"name": "Bronze Coin",                          "price": 6,  "kind": "keepsake"},
    "croc_sandals":       {"name": "Crocodile-leather Sandals",            "price": 12, "kind": "keepsake"},
    "secret_flood":       {"name": "The Secret of the Flood",             "price": 25, "kind": "keepsake"},
    "secret_compounding": {"name": "The Secret of Compounding",           "price": 30, "kind": "keepsake"},
    "secret_orgchart":    {"name": "The Org Chart (Upper Portion Redacted)", "price": 40, "kind": "keepsake"},
    "secret_name":        {"name": "The Secret Name of God",              "price": 50, "kind": "keepsake"},
    "sky_iron":           {"name": "A Sliver of Meteoric Iron",           "price": 44, "kind": "keepsake"},
    "paperwork_above":    {"name": "The Paperwork From Above",            "price": 33, "kind": "keepsake"},
    "tongue_stone":       {"name": "The Tongue Stone",                    "price": 28, "kind": "keepsake"},
    "seed_phrase":        {"name": "A Founder's Seed Phrase",             "price": 50, "kind": "keepsake"},
}


def get_item(item_id: str) -> dict | None:
    return SHOP_CATALOGUE.get(item_id)


def price_of(item_id: str) -> float | None:
    item = SHOP_CATALOGUE.get(item_id)
    return item["price"] if item else None


def public_catalogue() -> dict:
    """Client-safe view: id → {name, price, kind}. Never leaks `effect`."""
    return {
        iid: {"name": i["name"], "price": i["price"], "kind": i["kind"]}
        for iid, i in SHOP_CATALOGUE.items()
    }
