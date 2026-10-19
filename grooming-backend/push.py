"""Web Push to subscribed guardians (pywebpush). No-op until VAPID keys are set."""

import json
import logging

from config import GUARDIAN_MESSAGES, Settings
from schemas import Alert, Contact
from storage.base import Store

log = logging.getLogger(__name__)


def push_enabled(settings: Settings) -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def alert_payload(alert: Alert, contact: Contact | None) -> dict:
    """Notification shown to guardians (same wording as the guardian page)."""
    who = contact.name if contact else "a contact"
    return {
        "title": f"Guardian alert: {who}",
        "body": GUARDIAN_MESSAGES[alert.stage],
        "url": "/guardian",
        "tag": alert.id,
    }


def send_alert_push(store: Store, settings: Settings, alert: Alert, contact: Contact | None) -> int:
    """Send one notification per subscription. Returns how many were sent."""
    if not push_enabled(settings):
        return 0
    from pywebpush import WebPushException, webpush

    payload = json.dumps(alert_payload(alert, contact))
    sent = 0
    for sub in store.list_subscriptions():
        if not sub.keys:  # e.g. the frontend mock's "local-demo" placeholder
            continue
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": sub.keys},
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            sent += 1
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):
                store.delete_subscription(sub.endpoint)
            else:
                log.warning("web push failed: %s", e)
    return sent
