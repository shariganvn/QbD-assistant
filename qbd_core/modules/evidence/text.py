"""Text helpers: accent-insensitive tokens for matching, sentences for quoting."""

from __future__ import annotations

import re
import unicodedata

_WORD = re.compile(r"\w+", re.UNICODE)
_SENTENCE = re.compile(r"[^.!?\n]+[.!?]?", re.UNICODE)


def fold(text: str) -> str:
    """Lower-case, strip accents, map d-stroke; used only to compare, never to quote."""
    decomposed = unicodedata.normalize("NFD", text.casefold().replace("đ", "d"))
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def tokens(text: str) -> frozenset[str]:
    return frozenset(w for w in _WORD.findall(fold(text)) if len(w) > 1)


def sentences(page: str) -> list[str]:
    return [m.group().strip() for m in _SENTENCE.finditer(page) if m.group().strip()]


def squash(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())
