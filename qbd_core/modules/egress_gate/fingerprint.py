"""Word-window hashes used to recognise restricted text pasted into an unattributed payload part."""

from __future__ import annotations

import hashlib
import re
import unicodedata

SHINGLE_WORDS = 8
_WORD = re.compile(r"\w+", re.UNICODE)


def shingles(text: str, size: int = SHINGLE_WORDS, salt: str = "") -> frozenset[str]:
    """Hashes of every `size`-word window. Text is NFC-normalised so extractor output and payload
    text agree; a non-empty salt is mixed into each hash and must match on both sides."""
    words = [w.casefold() for w in _WORD.findall(unicodedata.normalize("NFC", text))]
    if len(words) < size:
        return frozenset()
    prefix = f"{salt}\0" if salt else ""
    return frozenset(
        hashlib.sha256((prefix + " ".join(words[i : i + size])).encode("utf-8")).hexdigest()[:16]
        for i in range(len(words) - size + 1)
    )
