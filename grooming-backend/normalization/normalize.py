"""
normalize.py - obfuscation / noise normalization layer (Component 1)

Turns messy chat text into a canonical form BEFORE lexicon labeling or the model:

    "s3nd me ur pix pls"        -> "send me your pic please"
    "u r s e x y"               -> "you are sexy"
    "what coclor panites u got" -> "what color panties you got"   (needs corpus vocab)
    "i am 13"                   -> "i am 13"                      (ages are protected)

Steps (in order)
  1. Unicode NFKC + lowercase           (fullwidth / styled letters -> plain)
  2. Emoji -> words                     (small curated table, EMOJI below)
  3. Spaced-out letters joined          ("s e x" -> "sex"; skipped for runs of u/r/a/i... words)
  4. Slang / abbreviation expansion     (SLANG below: u, ur, r, pls, pix, b4, ne1 ...)
  5. Leetspeak inside words only        (s3nd -> send; pure numbers, "13yo", "15f" are protected)
  6. Repeated letters collapsed         (soooo -> so / soo; "meet" and "cool" are kept)
  7. Typo correction vs corpus vocab    (OPTIONAL, needs .fit(); edit distance 1, rare -> frequent)
  8. Whitespace / repeated punctuation tidy-up

The original text is never overwritten - keep message_text and add message_text_norm.

Usage in code
    from normalize import Normalizer
    nz = Normalizer()
    nz.fit(all_message_texts)        # builds vocab for steps 6-7 (skip for rule-only mode)
    clean = nz(text)
    nz.typo_log                      # Counter of ("coclor","color") corrections - REVIEW THIS
"""
import re
import unicodedata
from collections import Counter, defaultdict

# Real-word guard: a token that is a valid English word (nudge, groom, harms, vimeo ...) must NEVER be
# "corrected", even if it is rare in the corpus. Needs:  pip install wordfreq
try:
    from wordfreq import zipf_frequency as _zipf
except ImportError:                      # still runs, but without the guard (not recommended)
    _zipf = None


def is_real_word(w, min_zipf=2.5):
    return _zipf is not None and _zipf(w, "en") >= min_zipf

# --- 2. emoji (curated; extend / validate with your supervisor) -------------------------
EMOJI = {
    "\U0001F346": " dick ",   # eggplant
    "\U0001F4A6": " cum ",    # sweat drops
    "\U0001F351": " ass ",    # peach
    "\U0001F34C": " dick ",   # banana
    "\U0001F608": " horny ",  # smiling devil
    "\U0001F618": " kiss ",   # blowing kiss
    "\U0001F48B": " kiss ",   # kiss mark
    "\U0001F445": " tongue ",
    "\U0001F525": " hot ",
    "\U0001F60D": " love ",
}

# --- 4. slang / abbreviations (whole tokens only) --------------------------------------
SLANG = {
    "u": "you", "ur": "your", "r": "are", "ya": "you", "yer": "your",
    "pls": "please", "plz": "please", "pleez": "please", "thx": "thanks", "thnx": "thanks",
    "pix": "pic", "pixs": "pics", "wat": "what", "wut": "what", "wen": "when",
    "cuz": "because", "cus": "because", "coz": "because", "bcuz": "because",
    "b4": "before", "gr8": "great", "2day": "today", "2morrow": "tomorrow",
    "2moro": "tomorrow", "tmrw": "tomorrow", "2nite": "tonight", "2night": "tonight",
    "tonite": "tonight", "nite": "night", "luv": "love", "abt": "about",
    "ne1": "anyone", "some1": "someone", "no1": "no one", "every1": "everyone",
    "tho": "though", "thru": "through", "rite": "right", "gurl": "girl",
    "cud": "could", "wud": "would", "shud": "should", "dis": "this", "dat": "that",
    "wit": "with", "k": "ok", "kk": "ok", "idk": "i don't know",
}

# --- 5. leetspeak ----------------------------------------------------------------------
LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})
LEET_CHARS = set("013457@$")
# "13yo", "14yr", "15f", "16m", "13y/o" ... must never be touched
AGE_TOKEN = re.compile(r"^\d{1,2}(yo|yrs?|y/o|f|m|g|b)?$")

TOKEN = re.compile(r"[A-Za-z0-9@$']+")
SPACED = re.compile(r"(?<![\w])(?:[a-z][ .\-_]){2,}[a-z](?![\w])")
COMMON_SINGLES = set("aiur")


def _within1(a, b):
    """Damerau-Levenshtein distance <= 1."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la == lb:
        diff = [i for i in range(la) if a[i] != b[i]]
        if len(diff) == 1:
            return True
        return (len(diff) == 2 and diff[1] == diff[0] + 1
                and a[diff[0]] == b[diff[1]] and a[diff[1]] == b[diff[0]])
    if la > lb:
        a, b = b, a
    i = 0
    while i < len(a) and a[i] == b[i]:
        i += 1
    return a[i:] == b[i + 1:]


def _deletes(w):
    return {w[:i] + w[i + 1:] for i in range(len(w))}


class Normalizer:
    def __init__(self, min_good=20, max_rare=3, min_len=5, overrides=None, target_words=None,
                 strict_ratio=100, strict_min_len=6, strict_max_freq=1):
        self.min_good = min_good      # a word is "known good" if seen >= this many times
        self.max_rare = max_rare      # a token is "suspect" if seen <= this many times
        self.min_len = min_len        # only try to fix tokens at least this long
        self.vocab = Counter()
        self._index = defaultdict(set)
        self.typo_log = Counter()
        # Typo policy (precision first):
        #  * if the fix is a word the lexicon cares about (target_words) -> normal rules
        #  * any other word -> STRICT: long token, seen <= strict_max_freq times, and the fix must be
        #    >= strict_ratio times more frequent. Names / usernames / slang are otherwise left alone.
        self.target_words = set(target_words or ())
        self.strict_ratio, self.strict_min_len, self.strict_max_freq = strict_ratio, strict_min_len, strict_max_freq
        self.typo_tier = {}
        self.overrides = dict(overrides or {})   # reviewed fixes: {"wndys": "wednesdays"}; map a word to itself to BLOCK a bad fix
        self.fitted = False

    # -------------------------------------------------------------- rule steps (1-6, 8)
    def _basic(self, text):
        t = unicodedata.normalize("NFKC", str(text)).lower()
        for e, w in EMOJI.items():
            t = t.replace(e, w)
        # 3. s e x / s.e.x / s-e-x -> sex   (skip if every piece is a real 1-letter word)
        def join(m):
            letters = re.findall(r"[a-z]", m.group(0))
            lo, hi = 0, len(letters)
            while lo < hi and letters[lo] in COMMON_SINGLES:      # leading real words: u r a ...
                lo += 1
            while hi > lo and letters[hi - 1] in COMMON_SINGLES:  # trailing real words
                hi -= 1
            if hi - lo < 3:
                return m.group(0)
            return " ".join(letters[:lo] + ["".join(letters[lo:hi])] + letters[hi:])
        t = SPACED.sub(join, t)
        # 4-5. token-level slang then leetspeak
        def tok(m):
            w = m.group(0)
            if w in SLANG:
                return SLANG[w]
            if w.isdigit() or AGE_TOKEN.match(w):
                return w
            letters = sum(c.isalpha() for c in w)
            if letters >= 2 and any(c in LEET_CHARS for c in w):
                w2 = w.translate(LEET)
                return SLANG.get(w2, w2)
            return w
        t = TOKEN.sub(tok, t)
        # 6a. 3+ repeated letters -> 2
        t = re.sub(r"([a-z])\1{2,}", r"\1\1", t)
        return t

    def _collapse_repeats(self, tok):
        """'soo' -> 'so' if only the single-letter form is a known word."""
        if self.fitted and tok not in self.vocab and re.search(r"([a-z])\1", tok):
            one = re.sub(r"([a-z])\1+", r"\1", tok)
            if self.vocab.get(one, 0) >= self.min_good:
                return one
        return tok

    # -------------------------------------------------------------- vocab / typos (7)
    def fit(self, texts):
        """Learn which words are common in YOUR corpus (after rule steps)."""
        c = Counter()
        for t in texts:
            c.update(w for w in re.findall(r"[a-z']+", self._basic(t)))
        self.vocab = c
        self._index = defaultdict(set)
        for w, n in c.items():
            if n >= self.min_good and len(w) >= 4 and w.isalpha():
                self._index[w].add(w)
                for d in _deletes(w):
                    self._index[d].add(w)
        self.fitted = True
        return self

    GLUE = {"u": "you", "you": "you", "ur": "your", "your": "your"}

    def _split_glued(self, w):
        """'missedu' -> 'missed you', 'utonight' -> 'you tonight' (rare token = known word + u/ur)."""
        if not self.fitted or self.vocab.get(w, 0) > self.max_rare or len(w) < 5 or is_real_word(w, 3.0):
            return None                   # real words (urgently, imgur-like names) are never split
        for g, rep in self.GLUE.items():
            for rest in ((w[:-len(g)] if w.endswith(g) else None), (w[len(g):] if w.startswith(g) else None)):
                if rest and len(rest) >= 3 and self.vocab.get(rest, 0) >= self.min_good and is_real_word(rest, 3.0):
                    return f"{rest} {rep}" if rest is not None and w.endswith(g) and w[:-len(g)] == rest else f"{rep} {rest}"
        return None

    def _fix_typo(self, w):
        if w in self.overrides:
            return self.overrides[w]
        glued = self._split_glued(w)
        if glued:
            self.typo_log[(w, glued)] += 1
            return glued
        if (not self.fitted or len(w) < self.min_len or not w.isalpha()
                or self.vocab.get(w, 0) > self.max_rare):
            return w
        if is_real_word(w):               # valid English word -> leave alone
            return w
        cands = set(self._index.get(w, ()))
        for d in _deletes(w):
            cands |= self._index.get(d, set())
        cands = [c for c in cands if c != w and _within1(w, c)]
        if not cands:
            return w
        cands.sort(key=lambda c: -self.vocab[c])
        if len(cands) > 1 and self.vocab[cands[1]] * 2 > self.vocab[cands[0]]:
            return w                      # ambiguous -> leave it alone
        best = cands[0]
        if best not in self.target_words and _zipf is not None and not is_real_word(best, 3.0):
            return w                      # never "fix" toward a word that is itself misspelled (belive, tomarrow)
        if best in self.target_words:
            tier = "lexicon"
        else:
            if (len(w) < self.strict_min_len or self.vocab.get(w, 0) > self.strict_max_freq
                    or self.vocab[best] < self.strict_ratio * max(self.vocab.get(w, 0), 1)):
                return w
            tier = "strict"
        self.typo_log[(w, best)] += 1
        self.typo_tier[(w, best)] = tier
        return best

    # -------------------------------------------------------------- public
    def __call__(self, text):
        t = self._basic(text)
        if self.fitted:
            t = re.sub(r"[a-z']+", lambda m: self._fix_typo(self._collapse_repeats(m.group(0))), t)
        t = re.sub(r"([!?.,])\1+", r"\1", t)
        return re.sub(r"\s+", " ", t).strip()


if __name__ == "__main__":
    nz = Normalizer()
    for s in ["s3nd me ur pix pls", "u r s e x y", "sooooo cute", "i am 13yo", "h0rny \U0001F346"]:
        print(f"{s!r:32} -> {nz(s)!r}")
