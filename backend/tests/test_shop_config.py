async def test_config_includes_shop_prices(client):
    async with client as c:
        res = await c.get("/api/config")
    assert res.status_code == 200
    body = res.json()
    assert "payout" in body
    assert body["shop"]["invite_scroll"] == {"name": "Invite Scroll", "price": 2, "kind": "consumable"}
    assert "effect" not in body["shop"]["invite_scroll"]
