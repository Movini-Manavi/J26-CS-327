import pytest

from config import STAGES
from model_service.classifier import StubClassifier
from model_service.normalize import normalize
from model_service.tracker import StageTracker


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("HELLO", "hello"),
        ("sooooo cool", "soo cool"),
        ("s e c r e t", "secret"),
        ("d0nt t3ll", "don't tell"),
        ("u r gr8", "you are gr8"),
    ],
)
def test_normalize(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize(
    "text, label",
    [
        ("hey are you coming to practice", "none"),
        ("you're so mature for your age", "Trust-Building"),
        ("don't tell your parents", "Isolation"),
        ("it's totally normal", "Desensitization"),
        ("send me a selfie", "Solicitation"),
    ],
)
def test_stub_classifier_labels(text, label):
    pred = StubClassifier().predict(normalize(text))
    assert pred.label == label
    assert set(pred.scores) == set(STAGES)
    assert max(pred.scores, key=pred.scores.get) == label
    assert sum(pred.scores.values()) == pytest.approx(1.0, abs=1e-3)


def test_tracker_default_rule_alerts_on_any_stage():
    t = StageTracker(STAGES[1:])
    assert t.update("c1", "none").alert is False
    d = t.update("c1", "Isolation")
    assert d.alert is True and d.level == "medium"
    t.update("c1", "Trust-Building")
    assert t.state("c1").highest == "Isolation"
    assert t.state("c1").stage_counts == {"Isolation": 1, "Trust-Building": 1}
    assert t.state("c2").highest == "none"


def test_tracker_rule_is_configurable():
    t = StageTracker(["Isolation", "Desensitization", "Solicitation"])
    assert t.update("c1", "Trust-Building").alert is False
    assert t.update("c1", "Solicitation").alert is True
