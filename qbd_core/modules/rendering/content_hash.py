"""A hash of a docx that ignores only the two wall-clock stamps the Node tool writes."""

from __future__ import annotations

import hashlib
import re
import zipfile
from pathlib import Path

_STAMP = re.compile(rb"(<dcterms:(created|modified)\b[^>]*>)[^<]*(</dcterms:(?:created|modified)>)")
CORE_PROPERTIES = "docProps/core.xml"


def content_sha256(path: str | Path) -> str:
    digest = hashlib.sha256()
    with zipfile.ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            data = archive.read(name)
            if name == CORE_PROPERTIES:
                data = _STAMP.sub(rb"\1\3", data)
            digest.update(name.encode("utf-8") + b"\0" + hashlib.sha256(data).digest())
    return digest.hexdigest()
