# grooming-backend

FastAPI backend for Component 1 (grooming-pattern detection) of the SLIIT IT4010
research prototype. **Phase 2:** SQLite storage + a keyword **stub** classifier.
The real roberta-base model is plugged in during Phase 3 without changing routes.

> Research prototype, not a validated detector or a safety product. Fictional data only.

## Run locally (Windows, PowerShell)

```powershell
cd grooming-backend
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

- API docs (try every endpoint in the browser): http://localhost:8000/docs
- Health check: http://localhost:8000/health
- The SQLite file is created automatically at `data/grooming.db`. Delete it to start fresh.

Then start the frontend against it (second terminal):

```powershell
cd facebook-clone
npm run dev:backend
```

Open http://localhost:3000/chatadmin (key `demo-key`), http://localhost:3000/chat and
http://localhost:3000/guardian in separate tabs. The connection badge should say **Live**
without "· mock".

## Tests

```powershell
.venv\Scripts\python -m pytest -v
```

Covers every storage method, the normalizer/stub classifier/tracker, every endpoint,
the demo-key check, the WebSocket events, and data + seq surviving a restart.

## Layout

```
main.py                 routes only (calls GroomingService)
service.py              message flow: save -> normalize -> classify -> track -> alert
config.py               settings from .env
schemas.py              records + request bodies (match the frontend types)
storage/base.py         Store interface
storage/sqlite_store.py SQLite adapter
storage/__init__.py     get_store(): picks adapter from DB_BACKEND
model_service/          normalize.py (stub), classifier.py (stub), tracker.py
realtime.py             WebSocket broadcast
push.py                 Web Push via pywebpush (off until VAPID keys are set)
tests/
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/contacts` | needs `X-Demo-Key` |
| GET | `/contacts` | |
| POST | `/messages/incoming` | needs `X-Demo-Key`; returns `{message, alert}` |
| POST | `/messages/outgoing` | stored, not classified |
| GET | `/messages?contact_id=&after=<seq>` | polling fallback |
| GET | `/alerts` | newest first |
| POST | `/alerts/{id}/ack` | |
| POST | `/push/subscribe` | |
| GET | `/push/public-key` | |
| WS | `/ws` | events: `message`, `contact`, `alert` |
| GET | `/health` | |

## Configuration (`.env`)

| Key | Default | |
|---|---|---|
| `DB_BACKEND` | `sqlite` | add `mongo` later with one adapter file |
| `SQLITE_PATH` | `./data/grooming.db` | |
| `DEMO_KEY` | `demo-key` | must match `VITE_DEMO_KEY` |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated |
| `CLASSIFIER` | `stub` | `transformers` in Phase 3 |
| `ALERT_STAGES` | all four stages | the alert rule |
| `VAPID_*` | empty | enables Web Push |
