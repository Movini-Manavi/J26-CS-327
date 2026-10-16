"""Records stored by every storage adapter and returned by the API.

Field names match the tables in the project context and the frontend types
in facebook-clone/src/types/grooming.ts.
"""

from datetime import date, datetime, timezone
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

Stage = Literal["none", "Trust-Building", "Isolation", "Desensitization", "Solicitation"]
Direction = Literal["incoming", "outgoing"]
Level = Literal["low", "medium", "high", "critical"]


def new_id() -> str:
    return str(uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Contact(BaseModel):
    id: str
    name: str
    dob: str
    phone: str
    created_at: str


class Message(BaseModel):
    id: str
    contact_id: str
    direction: Direction
    body: str
    seq: int
    created_at: str


class Analysis(BaseModel):
    message_id: str
    normalized_text: str
    label: Stage
    scores: dict[str, float]
    created_at: str


class MessageWithAnalysis(Message):
    analysis: Optional[Analysis] = None


class Alert(BaseModel):
    id: str
    contact_id: str
    message_id: str
    stage: Stage
    level: Level
    created_at: str
    acknowledged: bool = False


class PushSubscription(BaseModel):
    id: str
    endpoint: str
    keys: dict[str, str]
    created_at: str


# ---- request bodies ----

class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    dob: date
    phone: str = Field(pattern=r"^\+?[0-9][0-9\s-]{6,16}$")

    @field_validator("dob")
    @classmethod
    def dob_in_past(cls, v: date) -> date:
        if v >= date.today():
            raise ValueError("dob must be a past date")
        return v


class MessageIn(BaseModel):
    contact_id: str
    body: str = Field(min_length=1, max_length=2000)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=1)
    keys: dict[str, str] = {}


class IncomingResult(BaseModel):
    message: MessageWithAnalysis
    alert: Optional[Alert] = None
