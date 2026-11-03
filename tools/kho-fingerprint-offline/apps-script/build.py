"""Builds Code.gs from Code.template.gs: embeds casefold-table.json and the expected hashes.

Run from the repository root: PYTHONPATH=. python tools/kho-fingerprint-offline/apps-script/build.py
"""

import json
from pathlib import Path

from qbd_core.modules.egress_gate.api import shingles

here = Path(__file__).parent
table = (here.parent / "casefold-table.json").read_text("utf-8").strip()
sample = "Quy trình nội bộ mô tả bước nghiền trộn bột siêu mịn trước khi dập viên Straße ﬁne"
plain = ",".join(sorted(shingles(sample))[:3])
salted = ",".join(sorted(shingles(sample, salt="k"))[:3])
code = (here / "Code.template.gs").read_text("utf-8")
for marker, tail, value in [
    ("/*CASEFOLD_TABLE*/", " {}", table),
    ("/*EXPECT_PLAIN*/", " ''", json.dumps(plain)),
    ("/*EXPECT_SALT*/", " ''", json.dumps(salted)),
]:
    assert marker + tail in code, marker
    code = code.replace(marker + tail, value, 1)
(here / "Code.gs").write_text(
    "// Built by build.py from Code.template.gs; edit the template, not this file.\n" + code, "utf-8"
)
print("Code.gs", len(code), "bytes")
