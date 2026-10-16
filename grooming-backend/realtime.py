import logging

from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    """Keeps the open /ws sockets and broadcasts events to all of them."""

    def __init__(self) -> None:
        self._sockets: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._sockets.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._sockets.discard(ws)

    async def broadcast(self, event: dict) -> None:
        for ws in list(self._sockets):
            try:
                await ws.send_json(event)
            except Exception:  # client went away mid-send
                log.debug("dropping dead websocket")
                self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._sockets)
