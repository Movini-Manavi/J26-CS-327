"""FastAPI app. Routes only call GroomingService; no SQL or Mongo here.

Run locally:  uvicorn main:app --reload --port 8000
API docs:     http://localhost:8000/docs
"""

import asyncio
import secrets
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import Settings, get_settings
from model_service.classifier import get_classifier
from model_service.tracker import StageTracker
from push import push_enabled, send_alert_push
from realtime import ConnectionManager
from schemas import (
    Alert,
    Contact,
    ContactIn,
    IncomingResult,
    MessageIn,
    MessageWithAnalysis,
    PushSubscriptionIn,
)
from service import GroomingService, UnknownContact
from storage import get_store


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store = get_store(settings)
        classifier = get_classifier(settings)
        app.state.service = GroomingService(store, classifier, StageTracker(settings.alert_stages))
        app.state.manager = ConnectionManager()
        app.state.settings = settings
        yield
        store.close()

    app = FastAPI(title="grooming-backend", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def service(request: Request) -> GroomingService:
        return request.app.state.service

    def manager(request: Request) -> ConnectionManager:
        return request.app.state.manager

    def require_demo_key(x_demo_key: str = Header(default="")) -> None:
        if not secrets.compare_digest(x_demo_key, settings.demo_key):
            raise HTTPException(status_code=401, detail="Invalid demo key")

    @app.get("/health")
    def health(request: Request):
        svc: GroomingService = request.app.state.service
        return {
            "status": "ok",
            "db_backend": settings.db_backend,
            "classifier": svc.classifier.name,
            "alert_stages": settings.alert_stages,
            "push_enabled": push_enabled(settings),
            "websocket_clients": request.app.state.manager.count,
        }

    # contacts
    @app.post("/contacts", response_model=Contact, status_code=201, dependencies=[Depends(require_demo_key)])
    async def add_contact(
        data: ContactIn,
        svc: GroomingService = Depends(service),
        mgr: ConnectionManager = Depends(manager),
    ):
        contact = svc.add_contact(data)
        await mgr.broadcast({"type": "contact", "contact": contact.model_dump()})
        return contact

    @app.get("/contacts", response_model=list[Contact])
    def list_contacts(svc: GroomingService = Depends(service)):
        return svc.list_contacts()

    # messages
    @app.post(
        "/messages/incoming",
        response_model=IncomingResult,
        status_code=201,
        dependencies=[Depends(require_demo_key)],
    )
    async def incoming(
        data: MessageIn,
        background: BackgroundTasks,
        svc: GroomingService = Depends(service),
        mgr: ConnectionManager = Depends(manager),
    ):
        try:
            # Classification is CPU work; keep the event loop free for sockets.
            result = await asyncio.to_thread(svc.receive_incoming, data)
        except UnknownContact:
            raise HTTPException(status_code=404, detail="Unknown contact")
        await mgr.broadcast({"type": "message", **result.model_dump()})
        if result.alert:
            contact = svc.store.get_contact(result.alert.contact_id)
            background.add_task(send_alert_push, svc.store, settings, result.alert, contact)
        return result

    @app.post("/messages/outgoing", response_model=MessageWithAnalysis, status_code=201)
    async def outgoing(
        data: MessageIn,
        svc: GroomingService = Depends(service),
        mgr: ConnectionManager = Depends(manager),
    ):
        try:
            message = svc.send_outgoing(data)
        except UnknownContact:
            raise HTTPException(status_code=404, detail="Unknown contact")
        await mgr.broadcast({"type": "message", "message": message.model_dump(), "alert": None})
        return message

    @app.get("/messages", response_model=list[MessageWithAnalysis])
    def list_messages(
        contact_id: Optional[str] = None,
        after: Optional[int] = None,
        svc: GroomingService = Depends(service),
    ):
        return svc.list_messages(contact_id=contact_id, after=after)

    # alerts
    @app.get("/alerts", response_model=list[Alert])
    def list_alerts(svc: GroomingService = Depends(service)):
        return svc.list_alerts()

    @app.post("/alerts/{alert_id}/ack", response_model=Alert)
    async def ack_alert(
        alert_id: str,
        svc: GroomingService = Depends(service),
        mgr: ConnectionManager = Depends(manager),
    ):
        alert = svc.acknowledge_alert(alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Unknown alert")
        await mgr.broadcast({"type": "alert", "alert": alert.model_dump()})
        return alert

    # push
    @app.post("/push/subscribe", status_code=204)
    def subscribe(data: PushSubscriptionIn, svc: GroomingService = Depends(service)):
        svc.save_subscription(data)

    @app.get("/push/public-key")
    def public_key():
        return {"public_key": settings.vapid_public_key}

    # live updates
    @app.websocket("/ws")
    async def ws(websocket: WebSocket):
        mgr: ConnectionManager = websocket.app.state.manager
        await mgr.connect(websocket)
        try:
            while True:
                await websocket.receive_text()  # clients may send pings; ignored
        except WebSocketDisconnect:
            mgr.disconnect(websocket)

    return app


app = create_app()
