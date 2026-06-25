"""
Server-side shop catalogue.
SHOP_CATALOGUE is the single source of truth for ware prices and behaviour,
mirroring app/payout.py. Frontend reads prices via GET /api/config; it never
hardcodes them. `effect` is internal and never exposed to clients.
"""
from __future__ import annotations

SHOP_CATALOGUE: dict = {
    "invite_scroll":      {"name": "Invite Scroll",                           "price": 2,  "kind": "consumable", "effect": {"type": "invites", "amount": 1}},
    "astral_lens":        {"name": "A Lens Ground from Crushed Scarab",     "price": 1,  "kind": "keepsake"},
    "scarab_amulet":      {"name": "Scarab Amulet",                           "price": 4,  "kind": "keepsake"},
    "bronze_coin":        {"name": "Bronze Coin",                             "price": 3,  "kind": "keepsake"},
    "croc_sandals":       {"name": "Crocodile-leather Sandals",               "price": 6,  "kind": "keepsake"},
    "secret_flood":       {"name": "The Secret of the Flood",                "price": 12, "kind": "keepsake"},
    "secret_compounding": {"name": "The Secret of Compounding",              "price": 14, "kind": "keepsake"},
    "secret_recursion":   {"name": "The Secret of Recursion",                "price": 16, "kind": "keepsake"},
    "secret_fire":        {"name": "The Secret of Fire",                     "price": 10, "kind": "keepsake"},
    "secret_name":        {"name": "The Secret Name of God",                "price": 22, "kind": "keepsake"},
    "secret_orgchart":    {"name": "The Org Chart (Upper Portion Redacted)", "price": 18, "kind": "keepsake"},
    "paperwork_above":    {"name": "The Paperwork From Above",               "price": 15, "kind": "keepsake"},
    "tongue_stone":       {"name": "The Tongue Stone",                       "price": 13, "kind": "keepsake"},
    "attentive_reel":     {"name": "A Reel of Something Attentive",          "price": 16, "kind": "keepsake"},
    "sky_iron":           {"name": "A Sliver of Meteoric Iron",             "price": 20, "kind": "keepsake"},
    "seed_phrase":        {"name": "A Founder's Seed Phrase",               "price": 22, "kind": "keepsake"},
    "future_receipt":     {"name": "A Receipt from the Future",             "price": 6,  "kind": "keepsake"},
    "self_equity":        {"name": "Stock Certificate in Yourself",         "price": 10, "kind": "keepsake"},
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
