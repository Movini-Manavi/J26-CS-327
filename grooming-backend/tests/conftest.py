import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import Settings  # noqa: E402
from main import create_app  # noqa: E402
from storage.sqlite_store import SQLiteStore  # noqa: E402

DEMO_KEY = "test-key"


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        sqlite_path=str(tmp_path / "test.db"),
        demo_key=DEMO_KEY,
        cors_origins=["http://localhost:3000"],
    )


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def key():
    return {"X-Demo-Key": DEMO_KEY}


@pytest.fixture
def store(tmp_path):
    s = SQLiteStore(str(tmp_path / "store.db"))
    yield s
    s.close()


@pytest.fixture
def contact(client, key):
    res = client.post(
        "/contacts",
        json={"name": "Jay Test", "dob": "1990-01-02", "phone": "+94 71 000 0002"},
        headers=key,
    )
    assert res.status_code == 201
    return res.json()
