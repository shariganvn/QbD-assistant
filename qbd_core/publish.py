"""Publish a set of files all-or-nothing: either every target is replaced or none is changed."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Mapping
from pathlib import Path


class PublishFailed(Exception):  # noqa: N818 - reads as a verdict, not an error class
    """A target could not be written. Earlier targets were put back as they were."""


def _stage(target: Path, data: bytes) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=target.parent, prefix=f".{target.name}.", suffix=".new")
    with os.fdopen(fd, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    return Path(name)


def _restore(target: Path, old: bytes | None) -> None:
    if old is None:
        target.unlink(missing_ok=True)
        return
    back = _stage(target, old)
    os.replace(back, target)


def publish_all(files: Mapping[Path, bytes]) -> None:
    """Stage every file next to its target first, so a full disk or a missing folder stops the
    whole publication before anything is touched; then replace one by one, undoing on failure."""
    staged: dict[Path, Path] = {}
    try:
        for target, data in files.items():
            staged[target] = _stage(target, data)
    except OSError as error:
        for tmp in staged.values():
            tmp.unlink(missing_ok=True)
        raise PublishFailed(f"could not stage {len(files)} files") from error
    backups = {t: (t.read_bytes() if t.exists() else None) for t in files}
    done: list[Path] = []
    try:
        for target, tmp in staged.items():
            os.replace(tmp, target)
            done.append(target)
    except OSError as error:
        for target in reversed(done):
            _restore(target, backups[target])
        raise PublishFailed("replace failed; earlier targets restored") from error
    finally:
        for tmp in staged.values():
            tmp.unlink(missing_ok=True)
