from app.shop import SHOP_CATALOGUE, get_item, price_of, public_catalogue


def test_catalogue_has_expected_ids():
    assert "protection_scroll" not in SHOP_CATALOGUE  # dropped
    assert "blank_scroll" not in SHOP_CATALOGUE        # dropped
    for new_id in ("secret_recursion", "secret_fire", "attentive_reel", "self_equity"):
        assert new_id in SHOP_CATALOGUE
    assert len(SHOP_CATALOGUE) == 18


def test_every_item_has_required_fields():
    for item_id, item in SHOP_CATALOGUE.items():
        assert item["name"], f"{item_id} missing name"
        assert isinstance(item["price"], (int, float)) and item["price"] > 0
        assert item["kind"] in ("consumable", "keepsake")
        if item["kind"] == "consumable":
            assert item["effect"]["type"] == "invites"
            assert item["effect"]["amount"] >= 1


def test_get_item_and_price_of():
    assert get_item("invite_scroll")["kind"] == "consumable"
    assert price_of("invite_scroll") == 2
    assert get_item("does_not_exist") is None
    assert price_of("does_not_exist") is None


def test_public_catalogue_exposes_id_name_price_kind_only():
    pub = public_catalogue()
    assert pub["scarab_amulet"] == {"name": "Scarab Amulet", "price": 4, "kind": "keepsake"}
    # effect is internal — never leaked to clients
    assert "effect" not in pub["invite_scroll"]
