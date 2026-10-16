# Component 1: implementation plan (grooming detection in the Facebook clone)

Companion to [grooming_platform_project_context.md](grooming_platform_project_context.md).
Status as of 2026-10-15: **Phase 1 (UI) done, running on a mock backend.** Phases 2+ wait for your go-ahead.

## Phase 1: Frontend UI (done)

All three routes run today with no backend: `VITE_API_MODE=mock` stores data in
`localStorage` and shares live events between browser tabs (BroadcastChannel), so
`/chatadmin` in one tab updates `/chat` and `/guardian` in another, the way the
WebSocket will later.

| Route | What it shows |
|---|---|
| `/chat` | Messenger: conversation list, thread, reply box, **popup alert from the top** on a stage message, a stage chip under flagged messages, a right panel with the analysis (normalized text, label, scores) and a timeline of stages seen. Opened from the Messenger icon dropdown ("See all in Messenger" or any chat). |
| `/chatadmin` | Sender simulator behind the demo key (`noindex`): create contacts (name, DOB, one phone, auto UUID), pick one, send messages as them (with made-up preset lines per stage), see the label each message got. "Reset demo data" reseeds. |
| `/guardian` | Alert dashboard: enable-notifications card (with the iPhone Home Screen note), summary counts, alerts by stage, alert history with stage/level, acknowledge, and conversation context. `noindex`. |

**Labels in mock mode come from a small keyword list (`mockClassifier.ts`), not the model.** The UI says so.

### Frontend files
```
facebook-clone/
  .env.example                       VITE_API_MODE, VITE_API_URL, VITE_DEMO_KEY, VITE_VAPID_PUBLIC_KEY
  public/sw.js                       service worker for guardian Web Push
  src/types/grooming.ts              Contact, Message, Analysis, Alert, ServerEvent (mirror the DB tables)
  src/lib/grooming/
    config.ts                        mode, URLs, demo key, alert rule used by the mock
    api/types.ts                     IGroomingApi: the only thing pages talk to
    api/mockApi.ts                   in-browser backend (localStorage + BroadcastChannel)
    api/mockClassifier.ts            keyword stand-in for the model (mock only)
    api/httpApi.ts                   real backend client: REST + WS /ws, polling fallback
    api/index.ts                     picks mock or http from VITE_API_MODE
    useGroomingData.ts               loads data and applies live events
    push.ts                          notification permission + Web Push subscribe
  src/components/organisms/grooming/ ConversationList, ChatThread, AnalysisPanel, AlertToast, common
  src/pages/chat, chatadmin, guardian
```

Switching to the real backend later is a config change: set `VITE_API_MODE=http` and `VITE_API_URL`.

## Phase 2: Backend skeleton, no model (needs your go-ahead)

`grooming-backend/` with FastAPI, matching the context doc:

```
grooming-backend/
  main.py                 routes only; calls the storage interface and model service
  config.py               DB_BACKEND, SQLITE_PATH, DEMO_KEY, CORS origins, ALERT_STAGES, MODEL_DIR, VAPID keys
  storage/base.py         abstract Store: add_contact, list_contacts, get_contact, add_message,
                          list_messages, save_analysis, add_alert, list_alerts, save_subscription,
                          list_subscriptions (+ acknowledge_alert)
  storage/sqlite_store.py first adapter
  storage/__init__.py     get_store() factory reading DB_BACKEND
  model_service/          normalize.py, classifier.py, tracker.py
  push.py                 pywebpush sender
  requirements.txt, Dockerfile, .env.example
```

- Endpoints: `POST/GET /contacts`, `POST /messages/incoming` (checks `X-Demo-Key`),
  `POST /messages/outgoing`, `GET /messages?contact_id=&after=<seq>`, `GET /alerts`,
  `POST /alerts/{id}/ack` (**new**, the guardian page needs it), `POST /push/subscribe`, `WS /ws`.
- The response and WebSocket shapes are already fixed by `src/types/grooming.ts`:
  `POST /messages/incoming` returns `{ message, alert }`, and each WS event is
  `{ "type": "message", "message": {..., "analysis": {...}}, "alert": {...} | null }`.
- UUIDs and `seq` are generated in the app, not by the database.
- Until the model is in place, `classifier.py` uses a stub (or the lexicon) behind the same interface.

## Phase 3: Plug in the model (needs your go-ahead and the model files)

- You place the Colab `best_model` folder at `grooming-backend/models/roberta-base/` (not committed; add to `.gitignore`).
- `classifier.py` loads it once at startup with `transformers` on CPU, `MODEL_DIR` from config, so a better model is a folder swap.
- `normalize.py` is your existing normalizer (needs `wordfreq`, `typo_overrides.json`, the lexicon file).
- `tracker.py` is your rule-based stage tracker; the alert rule stays configurable (`ALERT_STAGES`, later "Isolation and above" or "N repeated stages").
- No training work is planned here.

## Phase 4: Notifications

- Generate VAPID keys once (backend), put the public key in `VITE_VAPID_PUBLIC_KEY`.
- `/guardian` already registers `public/sw.js` and posts the subscription when `VITE_API_MODE=http` and the key is set.
- Backend sends with `pywebpush` to every row in `push_subscriptions` when an alert is created.
- Needs HTTPS (localhost is fine for testing). iPhone: iOS 16.4+, Home Screen web app only.

## Phase 5: Hosting

- Frontend: Vercel (`vercel.json` already rewrites all routes to `index.html`).
- Backend: Docker image on Azure Container Apps, min replicas 1 on demo day; fallback laptop + Cloudflare Tunnel/ngrok. Must be HTTPS/wss.

## Database setup (you do this)

### SQLite (first adapter; nothing to install)
SQLite ships with Python. The backend creates the file and tables on startup.
1. Decide the file location, e.g. `grooming-backend/data/grooming.db` (add `data/` to `.gitignore`).
2. In `grooming-backend/.env`: `DB_BACKEND=sqlite` and `SQLITE_PATH=./data/grooming.db`.
3. Optional viewer: [DB Browser for SQLite](https://sqlitebrowser.org/).
4. On Azure Container Apps the container disk is wiped on restart. For a demo that is fine
   (or mount an Azure Files share at `/app/data`). For data that must survive, use MongoDB below.

Tables the backend will create:
```sql
CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, dob TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE messages (id TEXT PRIMARY KEY, contact_id TEXT NOT NULL REFERENCES contacts(id),
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')), body TEXT NOT NULL,
  seq INTEGER NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE analysis (message_id TEXT PRIMARY KEY REFERENCES messages(id), normalized_text TEXT NOT NULL,
  label TEXT NOT NULL, scores TEXT NOT NULL /* JSON */, created_at TEXT NOT NULL);
CREATE TABLE alerts (id TEXT PRIMARY KEY, contact_id TEXT NOT NULL REFERENCES contacts(id),
  message_id TEXT NOT NULL REFERENCES messages(id), stage TEXT NOT NULL, level TEXT NOT NULL,
  created_at TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
CREATE TABLE push_subscriptions (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, keys TEXT NOT NULL /* JSON */, created_at TEXT NOT NULL);
CREATE INDEX idx_messages_contact_seq ON messages(contact_id, seq);
CREATE INDEX idx_alerts_created ON alerts(created_at);
```

### MongoDB (later, optional second adapter)
1. Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) (or the student pack).
2. Database Access: add a user with read/write on one database, e.g. `grooming_demo`.
3. Network Access: add your IP (and the Azure Container Apps outbound IPs, or `0.0.0.0/0` for a short demo only).
4. Copy the connection string and set in `grooming-backend/.env` (never commit it):
   `DB_BACKEND=mongo`, `MONGO_URI=mongodb+srv://...`, `MONGO_DB=grooming_demo`.
5. Collections match the table names; the adapter creates indexes on `messages.(contact_id, seq)`,
   `messages.seq` (unique) and `push_subscriptions.endpoint` (unique). `_id` is the app's UUID.

## Open items (from the context doc)
- Alert rule beyond "any stage message" (configurable in backend `ALERT_STAGES`; mirrored in `src/lib/grooming/config.ts` for the mock).
- Previous message as model input.
- Shared cross-component result format: type `IComponentResult` is already in `src/types/grooming.ts`.
