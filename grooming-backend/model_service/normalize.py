"""Thin wrapper around the project normalizer in normalization/normalize.py.

Runs in rule-only mode (no .fit()), so steps 1-6 and 8 apply: NFKC +
lowercase, emoji, spaced letters, slang, leetspeak, repeated letters, tidy-up.
Typo correction (step 7) needs a fitted vocabulary and is not enabled yet.
"""

from normalization.normalize import Normalizer

_normalizer = Normalizer()


def normalize(text: str) -> str:
    return _normalizer(text)
