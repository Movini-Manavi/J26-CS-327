from fastapi.testclient import TestClient

from main import create_app


def send_in(client, key, contact_id, body):
    return client.post("/messages/incoming", json={"contact_id": contact_id, "body": body}, headers=key)


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["classifier"] == "stub-lexicon"
    assert body["push_enabled"] is False


def test_demo_key_required(client):
    contact = {"name": "X", "dob": "1990-01-01", "phone": "+94 71 000 0000"}
    assert client.post("/contacts", json=contact).status_code == 401
    assert client.post("/contacts", json=contact, headers={"X-Demo-Key": "wrong"}).status_code == 401
    assert send_in(client, {"X-Demo-Key": "wrong"}, "any", "hi").status_code == 401


def test_contact_validation(client, key):
    bad = [
        {"name": "", "dob": "1990-01-01", "phone": "+94 71 000 0000"},
        {"name": "X", "dob": "2999-01-01", "phone": "+94 71 000 0000"},
        {"name": "X", "dob": "1990-01-01", "phone": "abc"},
    ]
    for body in bad:
        assert client.post("/contacts", json=body, headers=key).status_code == 422


def test_create_and_list_contacts(client, contact):
    assert len(contact["id"]) == 36  # app-generated UUID
    assert contact["dob"] == "1990-01-02"
    assert client.get("/contacts").json() == [contact]


def test_incoming_is_analysed_and_alerts(client, key, contact):
    res = send_in(client, key, contact["id"], "D0NT tell your parents we talk")
    assert res.status_code == 201
    body = res.json()
    msg, alert = body["message"], body["alert"]
    assert msg["direction"] == "incoming" and msg["seq"] == 1
    assert msg["analysis"]["label"] == "Isolation"
    assert msg["analysis"]["normalized_text"] == "don't tell your parents we talk"
    assert alert["stage"] == "Isolation" and alert["level"] == "medium"
    assert alert["message_id"] == msg["id"] and alert["acknowledged"] is False


def test_incoming_none_stage_has_no_alert(client, key, contact):
    body = send_in(client, key, contact["id"], "see you at practice").json()
    assert body["message"]["analysis"]["label"] == "none"
    assert body["alert"] is None
    assert client.get("/alerts").json() == []


def test_outgoing_is_stored_not_classified(client, key, contact):
    res = client.post("/messages/outgoing", json={"contact_id": contact["id"], "body": "send me a selfie"})
    assert res.status_code == 201
    assert res.json()["analysis"] is None
    assert client.get("/alerts").json() == []


def test_unknown_contact_404(client, key):
    assert send_in(client, key, "nope", "hi").status_code == 404
    assert client.post("/messages/outgoing", json={"contact_id": "nope", "body": "hi"}).status_code == 404


def test_list_messages_filters(client, key, contact):
    other = client.post(
        "/contacts", json={"name": "Sam", "dob": "2011-04-12", "phone": "+94 77 000 0001"}, headers=key
    ).json()
    send_in(client, key, contact["id"], "hello")
    client.post("/messages/outgoing", json={"contact_id": contact["id"], "body": "hi"})
    send_in(client, key, other["id"], "yo")

    all_msgs = client.get("/messages").json()
    assert [m["seq"] for m in all_msgs] == [1, 2, 3]
    assert all_msgs[0]["analysis"]["label"] == "none"
    assert all_msgs[1]["analysis"] is None

    assert [m["seq"] for m in client.get("/messages", params={"contact_id": contact["id"]}).json()] == [1, 2]
    assert [m["seq"] for m in client.get("/messages", params={"after": 2}).json()] == [3]


def test_acknowledge_alert(client, key, contact):
    alert = send_in(client, key, contact["id"], "send me a selfie").json()["alert"]
    res = client.post(f"/alerts/{alert['id']}/ack")
    assert res.status_code == 200 and res.json()["acknowledged"] is True
    assert client.get("/alerts").json()[0]["acknowledged"] is True
    assert client.post("/alerts/missing/ack").status_code == 404


def test_push_subscribe_upserts(client):
    sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "x", "auth": "y"}}
    assert client.post("/push/subscribe", json=sub).status_code == 204
    assert client.post("/push/subscribe", json=sub).status_code == 204
    store = client.app.state.service.store
    assert len(store.list_subscriptions()) == 1


def test_websocket_receives_events(client, key, contact):
    with client.websocket_connect("/ws") as ws:
        alert = send_in(client, key, contact["id"], "are you alone right now?").json()["alert"]
        event = ws.receive_json()
        assert event["type"] == "message"
        assert event["message"]["analysis"]["label"] == "Isolation"
        assert event["alert"]["id"] == alert["id"]

        client.post("/messages/outgoing", json={"contact_id": contact["id"], "body": "yes"})
        event = ws.receive_json()
        assert event["message"]["direction"] == "outgoing" and event["alert"] is None

        client.post(f"/alerts/{alert['id']}/ack")
        event = ws.receive_json()
        assert event == {"type": "alert", "alert": {**alert, "acknowledged": True}}


def test_data_and_seq_survive_restart(settings, key):
    with TestClient(create_app(settings)) as c:
        cid = c.post(
            "/contacts", json={"name": "A", "dob": "1990-01-01", "phone": "+94 71 000 0000"}, headers=key
        ).json()["id"]
        send_in(c, key, cid, "hello")
        send_in(c, key, cid, "don't tell anyone")

    with TestClient(create_app(settings)) as c:
        assert len(c.get("/messages").json()) == 2
        msg = send_in(c, key, cid, "hi again").json()["message"]
        assert msg["seq"] == 3
        state = c.app.state.service.tracker.state(cid)
        assert state.stage_counts == {"Isolation": 1}


def test_cors_allows_frontend(client):
    res = client.options(
        "/contacts",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"

    res = client.options(
        "/contacts",
        headers={"Origin": "http://localhost:3001", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3001"

    res = client.options(
        "/contacts",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in res.headers
