"""Every Store method against the SQLite adapter. A new adapter (e.g. Mongo)
should pass the same tests."""

from schemas import Alert, Analysis, Contact, Message, PushSubscription, new_id, now_iso


def make_contact(name="Sam"):
    return Contact(id=new_id(), name=name, dob="2011-04-12", phone="+94 77 000 0001", created_at=now_iso())


def make_message(contact_id, seq, direction="incoming", body="hi"):
    return Message(
        id=new_id(), contact_id=contact_id, direction=direction, body=body, seq=seq, created_at=now_iso()
    )


def test_contacts(store):
    a, b = make_contact("A"), make_contact("B")
    store.add_contact(a)
    store.add_contact(b)
    assert [c.name for c in store.list_contacts()] == ["A", "B"]
    assert store.get_contact(a.id) == a
    assert store.get_contact("missing") is None


def test_messages_order_filter_and_max_seq(store):
    c1, c2 = make_contact(), make_contact()
    store.add_contact(c1)
    store.add_contact(c2)
    assert store.max_seq() == 0
    store.add_message(make_message(c1.id, 1))
    store.add_message(make_message(c2.id, 2, "outgoing"))
    store.add_message(make_message(c1.id, 3))

    assert [m.seq for m in store.list_messages()] == [1, 2, 3]
    assert [m.seq for m in store.list_messages(contact_id=c1.id)] == [1, 3]
    assert [m.seq for m in store.list_messages(after=1)] == [2, 3]
    assert [m.seq for m in store.list_messages(contact_id=c1.id, after=1)] == [3]
    assert store.max_seq() == 3


def test_analysis_roundtrip(store):
    c = make_contact()
    store.add_contact(c)
    m = store.add_message(make_message(c.id, 1))
    scores = {"none": 0.1, "Isolation": 0.9}
    store.save_analysis(
        Analysis(message_id=m.id, normalized_text="x", label="Isolation", scores=scores, created_at=now_iso())
    )
    got = store.get_analyses([m.id, "missing"])
    assert list(got) == [m.id]
    assert got[m.id].label == "Isolation"
    assert got[m.id].scores == scores
    assert store.get_analyses([]) == {}


def test_alerts_newest_first_and_ack(store):
    c = make_contact()
    store.add_contact(c)
    m = store.add_message(make_message(c.id, 1))
    old = Alert(
        id=new_id(), contact_id=c.id, message_id=m.id, stage="Isolation", level="medium",
        created_at="2026-01-01T00:00:00+00:00",
    )
    new = Alert(
        id=new_id(), contact_id=c.id, message_id=m.id, stage="Solicitation", level="critical",
        created_at="2026-02-01T00:00:00+00:00",
    )
    store.add_alert(old)
    store.add_alert(new)
    assert [a.id for a in store.list_alerts()] == [new.id, old.id]

    acked = store.acknowledge_alert(old.id)
    assert acked and acked.acknowledged is True
    assert store.acknowledge_alert("missing") is None


def test_subscriptions_upsert_by_endpoint(store):
    store.save_subscription(PushSubscription(id=new_id(), endpoint="https://e/1", keys={"a": "1"}, created_at=now_iso()))
    store.save_subscription(PushSubscription(id=new_id(), endpoint="https://e/1", keys={"a": "2"}, created_at=now_iso()))
    subs = store.list_subscriptions()
    assert len(subs) == 1 and subs[0].keys == {"a": "2"}
    store.delete_subscription("https://e/1")
    assert store.list_subscriptions() == []
