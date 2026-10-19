"""Rule-based stage tracker (no ML).

Follows each conversation, remembers which stages have been seen, and
decides whether a new message should raise an alert. The current rule is
"alert on any stage in ALERT_STAGES"; smarter rules (e.g. only from
Isolation up, or after N stage messages) go in `should_alert`.
"""

from dataclasses import dataclass, field

from config import STAGE_LEVEL, STAGES


@dataclass
class ConversationState:
    stage_counts: dict[str, int] = field(default_factory=dict)
    highest: str = "none"


@dataclass
class TrackerDecision:
    alert: bool
    level: str | None
    state: ConversationState


class StageTracker:
    def __init__(self, alert_stages: list[str]):
        self.alert_stages = set(alert_stages)
        self._states: dict[str, ConversationState] = {}

    def state(self, contact_id: str) -> ConversationState:
        return self._states.setdefault(contact_id, ConversationState())

    def _record(self, contact_id: str, label: str) -> ConversationState:
        st = self.state(contact_id)
        if label != "none":
            st.stage_counts[label] = st.stage_counts.get(label, 0) + 1
            if STAGES.index(label) > STAGES.index(st.highest):
                st.highest = label
        return st

    def replay(self, contact_id: str, label: str) -> None:
        """Rebuild state from stored history at startup (no alerts)."""
        self._record(contact_id, label)

    def should_alert(self, label: str, state: ConversationState) -> bool:
        return label in self.alert_stages

    def update(self, contact_id: str, label: str) -> TrackerDecision:
        st = self._record(contact_id, label)
        alert = self.should_alert(label, st)
        return TrackerDecision(alert=alert, level=STAGE_LEVEL.get(label) if alert else None, state=st)
