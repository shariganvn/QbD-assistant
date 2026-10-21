"""Word-window hashes used to recognise restricted text pasted into an unattributed payload part."""

from __future__ import annotations

import hashlib
import re

SHINGLE_WORDS = 8
_WORD = re.compile(r"\w+", re.UNICODE)


def shingles(text: str, size: int = SHINGLE_WORDS) -> frozenset[str]:
    words = [w.casefold() for w in _WORD.findall(text)]
    if len(words) < size:
        return frozenset()
    return frozenset(
        hashlib.sha256(" ".join(words[i : i + size]).encode("utf-8")).hexdigest()[:16]
        for i in range(len(words) - size + 1)
    )
