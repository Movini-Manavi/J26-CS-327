import json
import sqlite3
import threading
from pathlib import Path
from typing import Optional

from schemas import Alert, Analysis, Contact, Message, PushSubscription
from storage.base import Store

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  body TEXT NOT NULL,
  seq INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_contact_seq ON messages(contact_id, seq);
CREATE TABLE IF NOT EXISTS analysis (
  message_id TEXT PRIMARY KEY REFERENCES messages(id),
  normalized_text TEXT NOT NULL,
  label TEXT NOT NULL,
  scores TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  message_id TEXT NOT NULL REFERENCES messages(id),
  stage TEXT NOT NULL,
  level TEXT NOT NULL,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"""


class SQLiteStore(Store):
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)

    def _write(self, sql: str, params: tuple) -> None:
        with self._lock, self._conn:
            self._conn.execute(sql, params)

    def _read(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchall()

    # contacts
    def add_contact(self, contact: Contact) -> Contact:
        self._write(
            "INSERT INTO contacts (id, name, dob, phone, created_at) VALUES (?, ?, ?, ?, ?)",
            (contact.id, contact.name, contact.dob, contact.phone, contact.created_at),
        )
        return contact

    def list_contacts(self) -> list[Contact]:
        rows = self._read("SELECT * FROM contacts ORDER BY created_at")
        return [Contact(**dict(r)) for r in rows]

    def get_contact(self, contact_id: str) -> Optional[Contact]:
        rows = self._read("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        return Contact(**dict(rows[0])) if rows else None

    # messages
    def add_message(self, message: Message) -> Message:
        self._write(
            "INSERT INTO messages (id, contact_id, direction, body, seq, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (
                message.id,
                message.contact_id,
                message.direction,
                message.body,
                message.seq,
                message.created_at,
            ),
        )
        return message

    def list_messages(
        self, contact_id: Optional[str] = None, after: Optional[int] = None
    ) -> list[Message]:
        sql = "SELECT * FROM messages WHERE 1 = 1"
        params: list = []
        if contact_id:
            sql += " AND contact_id = ?"
            params.append(contact_id)
        if after is not None:
            sql += " AND seq > ?"
            params.append(after)
        sql += " ORDER BY seq"
        return [Message(**dict(r)) for r in self._read(sql, tuple(params))]

    def max_seq(self) -> int:
        rows = self._read("SELECT COALESCE(MAX(seq), 0) AS m FROM messages")
        return int(rows[0]["m"])

    # analysis
    def save_analysis(self, analysis: Analysis) -> Analysis:
        self._write(
            "INSERT OR REPLACE INTO analysis (message_id, normalized_text, label, scores, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (
                analysis.message_id,
                analysis.normalized_text,
                analysis.label,
                json.dumps(analysis.scores),
                analysis.created_at,
            ),
        )
        return analysis

    def get_analyses(self, message_ids: list[str]) -> dict[str, Analysis]:
        if not message_ids:
            return {}
        result: dict[str, Analysis] = {}
        # Stay under SQLite's bound-parameter limit.
        for i in range(0, len(message_ids), 500):
            chunk = message_ids[i : i + 500]
            marks = ",".join("?" * len(chunk))
            rows = self._read(
                f"SELECT * FROM analysis WHERE message_id IN ({marks})", tuple(chunk)
            )
            for r in rows:
                d = dict(r)
                d["scores"] = json.loads(d["scores"])
                result[d["message_id"]] = Analysis(**d)
        return result

    # alerts
    def add_alert(self, alert: Alert) -> Alert:
        self._write(
            "INSERT INTO alerts (id, contact_id, message_id, stage, level, created_at, acknowledged)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                alert.id,
                alert.contact_id,
                alert.message_id,
                alert.stage,
                alert.level,
                alert.created_at,
                int(alert.acknowledged),
            ),
        )
        return alert

    @staticmethod
    def _alert(row: sqlite3.Row) -> Alert:
        d = dict(row)
        d["acknowledged"] = bool(d["acknowledged"])
        return Alert(**d)

    def list_alerts(self) -> list[Alert]:
        rows = self._read("SELECT * FROM alerts ORDER BY created_at DESC")
        return [self._alert(r) for r in rows]

    def acknowledge_alert(self, alert_id: str) -> Optional[Alert]:
        self._write("UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
        rows = self._read("SELECT * FROM alerts WHERE id = ?", (alert_id,))
        return self._alert(rows[0]) if rows else None

    # push subscriptions
    def save_subscription(self, sub: PushSubscription) -> PushSubscription:
        self._write(
            "INSERT INTO push_subscriptions (id, endpoint, keys, created_at) VALUES (?, ?, ?, ?)"
            " ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys",
            (sub.id, sub.endpoint, json.dumps(sub.keys), sub.created_at),
        )
        return sub

    def list_subscriptions(self) -> list[PushSubscription]:
        rows = self._read("SELECT * FROM push_subscriptions ORDER BY created_at")
        out = []
        for r in rows:
            d = dict(r)
            d["keys"] = json.loads(d["keys"])
            out.append(PushSubscription(**d))
        return out

    def delete_subscription(self, endpoint: str) -> None:
        self._write("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))

    def close(self) -> None:
        with self._lock:
            self._conn.close()
