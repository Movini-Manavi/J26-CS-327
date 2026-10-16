"""Message classifier behind one small interface so the model is swappable.

Phase 2 ships StubClassifier (a keyword lexicon). Phase 3 adds a
TransformersClassifier that loads MODEL_DIR on CPU, selected by CLASSIFIER.
"""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass

from config import STAGES, Settings


@dataclass
class Prediction:
    label: str
    scores: dict[str, float]


class Classifier(ABC):
    name: str

    @abstractmethod
    def predict(self, normalized_text: str) -> Prediction: ...


# Checked from the most severe stage down. Made-up demo phrases only.
LEXICON: list[tuple[str, re.Pattern]] = [
    (
        "Solicitation",
        re.compile(
            r"(send (me )?(a |some |your )?(picture|photo|selfie)|meet (up|me)|video ?call"
            r"|come over|where do you live|what'?s your address)"
        ),
    ),
    (
        "Desensitization",
        re.compile(
            r"(ever kissed|it'?s (totally )?normal|everyone does it|what are you wearing"
            r"|do you have a (boyfriend|girlfriend))"
        ),
    ),
    (
        "Isolation",
        re.compile(
            r"(don'?t tell|our (little )?secret|between us|delete (the|our|these|this) (chat|messages?)"
            r"|are you alone|are your parents (home|around)|nobody (has to|needs to) know)"
        ),
    ),
    (
        "Trust-Building",
        re.compile(
            r"(tell me anything|i understand you|so mature|you'?re special|i'?m here for you"
            r"|trust me|they don'?t get you)"
        ),
    ),
]


class StubClassifier(Classifier):
    """Keyword stand-in. NOT the model; says nothing about detection quality."""

    name = "stub-lexicon"

    def predict(self, normalized_text: str) -> Prediction:
        label = next((stage for stage, rx in LEXICON if rx.search(normalized_text)), "none")
        top = 0.78 if label != "none" else 0.86
        rest = round((1 - top) / (len(STAGES) - 1), 4)
        scores = {s: rest for s in STAGES}
        scores[label] = top
        return Prediction(label=label, scores=scores)


def get_classifier(settings: Settings) -> Classifier:
    if settings.classifier == "stub":
        return StubClassifier()
    # Phase 3:
    # if settings.classifier == "transformers":
    #     from model_service.transformers_classifier import TransformersClassifier
    #     return TransformersClassifier(settings.model_dir)
    raise ValueError(f"Unknown CLASSIFIER: {settings.classifier}")
