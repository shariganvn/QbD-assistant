"""Writes casefold-table.json: code points whose Python casefold differs from the per-character
lower-case that the browser applies. The page embeds it so both sides fold words alike."""

import json
import sys
from pathlib import Path

table = {
    cp: chr(cp).casefold()
    for cp in range(sys.maxunicode + 1)
    if not 0xD800 <= cp <= 0xDFFF and chr(cp).casefold() != chr(cp).lower()
}
out = Path(__file__).with_name("casefold-table.json")
out.write_text(json.dumps(table, ensure_ascii=True, separators=(",", ":"), sort_keys=True) + "\n")
print(f"{len(table)} entries, Python {sys.version.split()[0]}")
