"""The fine-tuned roberta-base model from best_model/, loaded once on CPU.

Labels come from the model's own config (id2label), so a retrained model is
a folder swap as long as it keeps the same five stage names.
"""

import threading
from pathlib import Path

from config import STAGES
from model_service.classifier import Classifier, Prediction


class TransformersClassifier(Classifier):
    def __init__(self, model_dir: str, max_length: int = 128):
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        path = Path(model_dir)
        if not (path / "config.json").exists():
            raise FileNotFoundError(
                f"No model found in {path}. Put the Colab best_model folder there "
                "or set CLASSIFIER=stub."
            )

        self._torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(path)
        self.model = AutoModelForSequenceClassification.from_pretrained(path)
        self.model.eval()
        self.max_length = max_length
        self._lock = threading.Lock()

        self.id2label = {int(i): l for i, l in self.model.config.id2label.items()}
        unknown = set(self.id2label.values()) - set(STAGES)
        if unknown:
            raise ValueError(f"Model labels {unknown} are not known stages {STAGES}")
        self.name = f"transformers:{path.name}"

    def predict(self, normalized_text: str) -> Prediction:
        torch = self._torch
        inputs = self.tokenizer(
            normalized_text,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        with self._lock, torch.inference_mode():
            logits = self.model(**inputs).logits[0]
        probs = torch.softmax(logits, dim=-1).tolist()
        scores = {self.id2label[i]: round(p, 4) for i, p in enumerate(probs)}
        for s in STAGES:
            scores.setdefault(s, 0.0)
        label = max(scores, key=scores.get)
        return Prediction(label=label, scores=scores)
