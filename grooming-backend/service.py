"""The message flow, independent of HTTP: save -> normalize -> classify ->
track -> save analysis -> maybe alert. Routes call this; this calls the
Store interface, the normalizer, the classifier and the tracker."""

import threading
from typing import Optional

from model_service.classifier import Classifier
from model_service.normalize import normalize
from model_service.tracker import StageTracker
from schemas import (
    Alert,
    Analysis,
    Contact,
    ContactIn,
    IncomingResult,
    Message,
    MessageIn,
    MessageWithAnalysis,
    PushSubscription,
    PushSubscriptionIn,
    new_id,
    now_iso,
)
from storage.base import Store


class UnknownContact(Exception):
    pass


class GroomingService:
    def __init__(self, store: Store, classifier: Classifier, tracker: StageTracker):
        self.store = store
        self.classifier = classifier
        self.tracker = tracker
        self._seq_lock = threading.Lock()
        self._seq = store.max_seq()
        self._replay_tracker()

    def _replay_tracker(self) -> None:
        incoming = [m for m in self.store.list_messages() if m.direction == "incoming"]
        analyses = self.store.get_analyses([m.id for m in incoming])
        for m in incoming:
            if m.id in analyses:
                self.tracker.replay(m.contact_id, analyses[m.id].label)

    def _next_seq(self) -> int:
        with self._seq_lock:
            self._seq += 1
            return self._seq

    # contacts
    def add_contact(self, data: ContactIn) -> Contact:
        contact = Contact(
            id=new_id(),
            name=data.name.strip(),
            dob=data.dob.isoformat(),
            phone=data.phone.strip(),
            created_at=now_iso(),
        )
        return self.store.add_contact(contact)

    def list_contacts(self) -> list[Contact]:
        return self.store.list_contacts()

    # messages
    def _store_message(self, data: MessageIn, direction: str) -> Message:
        if not self.store.get_contact(data.contact_id):
            raise UnknownContact(data.contact_id)
        message = Message(
            id=new_id(),
            contact_id=data.contact_id,
            direction=direction,
            body=data.body,
            seq=self._next_seq(),
            created_at=now_iso(),
        )
        return self.store.add_message(message)

    def receive_incoming(self, data: MessageIn) -> IncomingResult:
        """Contact -> user. Analysed on arrival so /chat only reads results."""
        message = self._store_message(data, "incoming")

        normalized = normalize(message.body)
        prediction = self.classifier.predict(normalized)
        analysis = self.store.save_analysis(
            Analysis(
                message_id=message.id,
                normalized_text=normalized,
                label=prediction.label,
                scores=prediction.scores,
                created_at=now_iso(),
            )
        )

        decision = self.tracker.update(message.contact_id, prediction.label)
        alert: Optional[Alert] = None
        if decision.alert and decision.level:
            alert = self.store.add_alert(
                Alert(
                    id=new_id(),
                    contact_id=message.contact_id,
                    message_id=message.id,
                    stage=prediction.label,
                    level=decision.level,
                    created_at=now_iso(),
                    acknowledged=False,
                )
            )

        return IncomingResult(
            message=MessageWithAnalysis(**message.model_dump(), analysis=analysis),
            alert=alert,
        )

    def send_outgoing(self, data: MessageIn) -> MessageWithAnalysis:
        """User -> contact. Stored but not classified."""
        message = self._store_message(data, "outgoing")
        return MessageWithAnalysis(**message.model_dump(), analysis=None)

    def list_messages(
        self, contact_id: Optional[str] = None, after: Optional[int] = None
    ) -> list[MessageWithAnalysis]:
        messages = self.store.list_messages(contact_id=contact_id, after=after)
        analyses = self.store.get_analyses([m.id for m in messages if m.direction == "incoming"])
        return [MessageWithAnalysis(**m.model_dump(), analysis=analyses.get(m.id)) for m in messages]

    # alerts
    def list_alerts(self) -> list[Alert]:
        return self.store.list_alerts()

    def acknowledge_alert(self, alert_id: str) -> Optional[Alert]:
        return self.store.acknowledge_alert(alert_id)

    # push
    def save_subscription(self, data: PushSubscriptionIn) -> PushSubscription:
        return self.store.save_subscription(
            PushSubscription(id=new_id(), endpoint=data.endpoint, keys=data.keys, created_at=now_iso())
        )
