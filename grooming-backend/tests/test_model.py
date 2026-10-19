"""Loads the real model from best_model/. Skipped when the folder or
transformers/torch are missing (e.g. in CI). Checks the plumbing only,
not detection quality."""

from pathlib import Path

import pytest

from config import STAGES

MODEL_DIR = Path(__file__).resolve().parents[1] / "best_model"

pytest.importorskip("torch")
pytest.importorskip("transformers")
if not (MODEL_DIR / "config.json").exists():
    pytest.skip("best_model/ not present", allow_module_level=True)


@pytest.fixture(scope="module")
def model():
    from model_service.transformers_classifier import TransformersClassifier

    return TransformersClassifier(str(MODEL_DIR))


def test_model_returns_a_stage_and_scores(model):
    from model_service.normalize import normalize

    pred = model.predict(normalize("s3nd me a pic of u"))
    assert pred.label in STAGES
    assert set(pred.scores) == set(STAGES)
    assert sum(pred.scores.values()) == pytest.approx(1.0, abs=1e-2)
    assert max(pred.scores, key=pred.scores.get) == pred.label


def test_model_is_deterministic(model):
    assert model.predict("hello how are you").scores == model.predict("hello how are you").scores
