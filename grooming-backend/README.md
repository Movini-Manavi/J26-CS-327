# grooming-backend

FastAPI backend for Component 1 (grooming-pattern detection) of the SLIIT IT4010
research prototype. Incoming messages go through the project normalizer
(`normalization/normalize.py`, rule-only mode) and then the fine-tuned roberta-base
model in `best_model/` on CPU. Storage is SQLite.

> Research prototype, not a validated detector or a safety product. Fictional data only.

## Run locally (Windows, PowerShell)

```powershell
cd grooming-backend
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

- API docs (try every endpoint in the browser): http://localhost:8000/docs
- Health check: http://localhost:8000/health
- `best_model/` (config.json, model.safetensors, tokenizer files) must sit next to
  `main.py`. It is git-ignored (~475 MB) and loads in a few seconds at startup.
  To run without it, set `CLASSIFIER=stub` in `.env`.
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

API tests use the keyword stub so they stay fast; `tests/test_model.py` loads the real
model (skipped if `best_model/` or torch is missing). Covers every storage method, the
normalizer, classifiers and tracker, every endpoint,
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
normalization/          the project normalizer (Normalizer class)
best_model/             fine-tuned model (git-ignored)
model_service/          normalize.py (wraps the normalizer), classifier.py (interface + stub),
                        transformers_classifier.py (loads best_model), tracker.py
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
| `CLASSIFIER` | `transformers` | `stub` = keyword list, no model needed |
| `MODEL_DIR` | `./best_model` | swap the folder to try a retrained model |
| `MAX_LENGTH` | `128` | max tokens per message |
| `ALERT_STAGES` | all four stages | the alert rule |
| `VAPID_*` | empty | enables Web Push |
