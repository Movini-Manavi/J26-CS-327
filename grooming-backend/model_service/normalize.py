"""STUB normalizer. Phase 3 replaces this with the real one (slang, leetspeak,
emoji decoding, typo fixing with wordfreq + typo_overrides.json). Keep the
`normalize(text) -> str` signature so nothing else changes."""

import re

LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})

SLANG = {
    "u": "you",
    "ur": "your",
    "r": "are",
    "pls": "please",
    "plz": "please",
    "pic": "picture",
    "pics": "pictures",
    "rn": "right now",
    "bc": "because",
    "dont": "don't",
}

_REPEATED = re.compile(r"(.)\1{2,}")
_SPACED = re.compile(r"\b(?:[a-z] ){2,}[a-z]\b")
_WORD_CORE = re.compile(r"[a-z']+")


def _expand_slang(word: str) -> str:
    m = _WORD_CORE.search(word)
    if m and m.group(0) in SLANG:
        return word[: m.start()] + SLANG[m.group(0)] + word[m.end():]
    return word


def normalize(text: str) -> str:
    t = text.lower().translate(LEET)
    t = _REPEATED.sub(r"\1\1", t)  # "sooooo" -> "soo"
    t = _SPACED.sub(lambda m: m.group(0).replace(" ", ""), t)  # "s e c r e t" -> "secret"
    t = " ".join(_expand_slang(w) for w in t.split())
    return t.strip()
