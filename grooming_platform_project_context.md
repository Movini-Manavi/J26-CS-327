# Project context: Grooming-detection demo inside a Facebook clone

## 1. What this is
A university research project (SLIIT IT4010, Project ID J26-CS-327, "Online Safety & Predator Detection Platform"). It is a 4-person group project, and each member builds one component. This document covers **Component 1: Online Grooming Pattern Detection**, and how it is demonstrated inside a Facebook-clone web app.

The goal of the demo is to show a chat conversation being analysed in real time. When a message from a contact looks like online grooming, the user sees a warning in Messenger and guardians are notified.

Other components (for context only):
- Component 2: cyberbullying classifier
- Component 3: harmful content / viral challenge detection
- Component 4: PII detection, and consent risk in web apps' terms and conditions

## 2. What Component 1 does
- Reads one chat message at a time and labels it with a grooming stage: `none`, `Trust-Building`, `Isolation`, `Desensitization`, `Solicitation` (label ids 0 to 4, in that order).
- A **normalizer** first cleans the text (lowercasing, slang, leetspeak, emoji decoding, repeated letters, spaced-out letters, typo fixing with a real-word guard).
- A fine-tuned transformer classifies the normalized message.
- A **rule-based stage tracker** (no ML) follows each conversation and raises an alert based on the stages seen.

## 3. Model status (be honest about this)
- Data: PAN-12 and Perverted Justice chat logs. There were no human stage labels, so messages were labelled by a keyword/regex lexicon ("weak labels"). About 88% of messages matched no stage and were excluded from training.
- Four models were fine-tuned in Google Colab: roberta-base, distilroberta-base, bert-base-uncased, vinai/bertweet-base.
- Test macro-F1 on the lexicon-labelled split was about 0.98 to 0.99, but this was inflated, because the models mostly learned the lexicon keywords (recall fell to about 4 to 7% when keywords were hidden).
- On a 300-message hand-checked gold set of messages the lexicon missed, macro-F1 was about 0.30 (roberta-base), 0.25 (distilroberta), 0.26 (bert) and 0.15 (BERTweet, which also has a model-reload problem). The models predict `none` for most messages.
- The first prototype uses **roberta-base** (the best of the four on the gold set). The model is planned to be improved later (harder `none` examples, more labelled data, maybe using the previous message as context), so it must be **swappable** without touching the rest of the app.
- Do not present the prototype as a validated detector.

## 4. Repository layout
```
main-folder/
  facebook-clone/      React + TypeScript (Vite, Tailwind, react-router, formik/yup); UI only so far
  grooming-backend/    Python (FastAPI); holds the model and the storage layer
```

## 5. Frontend (facebook-clone)
Routes in the same project:
- `/chat`: Messenger chat page, opened from the Messenger icon in the clone. Shows incoming messages live, lets the user reply, and shows a **popup alert from the top** when a stage message is detected.
- `/chatadmin`: sender simulator. Create contacts (name, DOB, **one** phone number, auto-generated ID) and send messages as a chosen contact to the user. Protected only by a simple shared demo key.
- `/guardian`: guardians see the alert list and can subscribe to push notifications.
No login is needed. There is one fixed demo user.

## 6. Backend (grooming-backend)
**Flow:** `/chatadmin` posts an incoming message. The backend saves it, normalizes and classifies it on arrival (so `/chat` only reads the finished result), updates the tracker, saves the analysis, creates an alert if needed, pushes the message and analysis to `/chat` over a WebSocket, and sends a web push to subscribed guardians. Polling `GET /messages?after=<id>` is the fallback if the WebSocket fails.

**Model scope:** only incoming messages (contact to user) are analysed. The user's replies are stored but not classified.

**Alert rule (current):** show an alert whenever a message is classified as a stage. A smarter rule (for example only Isolation and above, or repeated stage messages) will be decided later, so keep it configurable.

**Storage layer (database adapter):** the app talks only to an interface. SQLite is the first adapter, and MongoDB or others can be added by writing one adapter file and changing one config setting.
```
grooming-backend/
  storage/ base.py, sqlite_store.py, (mongo_store.py later), __init__.py  # factory reads DB_BACKEND
  model_service/ normalize.py, classifier.py, tracker.py
  models/roberta-base/   # saved Hugging Face model folder
  main.py                # routes, only calls the interface
```
Rules: generate IDs in the app (UUID), not with the database, and never write SQL or Mongo queries in routes.

**Interface methods:** `add_contact`, `list_contacts`, `get_contact`, `add_message`, `list_messages`, `save_analysis`, `add_alert`, `list_alerts`, `save_subscription`, `list_subscriptions`.

**Tables:**
| Table | Fields |
|---|---|
| contacts | id, name, dob, phone, created_at |
| messages | id, contact_id, direction (incoming/outgoing), body, seq, created_at |
| analysis | message_id, normalized_text, label, scores, created_at |
| alerts | id, contact_id, message_id, stage, level, created_at, acknowledged |
| push_subscriptions | id, endpoint, keys, created_at |

Both directions of a conversation live in one `messages` table, separated by `direction`.

**Draft endpoints:** `POST /contacts`, `GET /contacts`, `POST /messages/incoming` (from `/chatadmin`), `POST /messages/outgoing` (from `/chat`), `GET /messages?contact_id=&after=`, `GET /alerts`, `POST /push/subscribe`, `WS /ws`.

## 7. Model delivery
The model is trained in Colab. The saved `best_model` folder (config, weights, tokenizer files) is zipped, downloaded and placed in `grooming-backend/models/`. The backend loads it with Hugging Face `transformers` on CPU. Do not commit the weights to git (about 500 MB). Either bake them into the Docker image, or store them in Azure Blob Storage or a private Hugging Face repo and download them at startup. The normalizer also needs `wordfreq`, `typo_overrides.json` and the lexicon file.

## 8. Notifications
- In-app: a top popup in Messenger when a stage message arrives.
- Guardians: Web Push (service worker, VAPID keys, `pywebpush`), or Firebase Cloud Messaging for web. Needs HTTPS.
- iPhone: web push only works on iOS 16.4 or later, and only when the guardian page is added to the Home Screen as a web app. The permission request must come from a tap. A native iOS app would need an Apple developer account.

## 9. Hosting
- Frontend: any static host (Vercel, Netlify, Firebase Hosting, GitHub Pages).
- Backend: Azure Container Apps with the Azure for Students account (Docker; free monthly grant). Set min replicas to 1 on demo day to avoid slow cold starts while the model loads. Test WebSocket behaviour; keep the polling fallback.
- Fallback: run the backend on a laptop behind a free tunnel (Cloudflare Tunnel or ngrok).
- The backend must serve HTTPS and wss, or the browser will block it from an HTTPS frontend.

## 10. Constraints and safety
- Use only fake users and made-up conversations. No real children's data in the demo.
- The sender page can post arbitrary messages, so protect it with the demo key and mark it noindex.
- Describe the system as a research prototype, not a safety product.

## 11. Open items
- Alert trigger rule beyond "any stage message".
- Whether to add the previous message as model input.
- Improving the training data and re-scoring on the gold set.
- Integration with the other three components through a shared result format (`component`, `risk`, `label`, `score`, `reason`, `message_id`).
