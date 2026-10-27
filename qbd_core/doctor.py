"""The `doctor` command: a read-only check of everything a real run needs.

Nothing is sent and nothing is written. Output holds counts and file ids only, never file names,
document text or key values."""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from pathlib import Path

from qbd_core import run
from qbd_core.modules.accounts.api import ROLES, AccountError, UserStore
from qbd_core.modules.egress_gate.api import try_load_manifest
from qbd_core.modules.evidence.api import load_documents
from qbd_core.modules.provider_access.api import HTTP_PROVIDERS

EXIT_DOCTOR = 17
MAX_IDS = 10


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--documents", default=None, help="JSON list of knowledge documents")
    parser.add_argument("--manifest", default=None, help="Kho manifest")
    parser.add_argument("--users-file", default=None, help="accounts made with user-add")
    parser.add_argument("--provider", choices=sorted(HTTP_PROVIDERS), default=None)
    parser.add_argument("--model", default=None)
    parser.add_argument("--workdir", default=None, help="folder the web page writes runs to")


def _ids(ids: list[str]) -> str:
    shown = ", ".join(sorted(ids)[:MAX_IDS])
    return shown + (f" (+{len(ids) - MAX_IDS} more)" if len(ids) > MAX_IDS else "")


def _classes(counter: Counter) -> str:
    return ", ".join(f"{k} {counter.get(k, 0)}" for k in ("A", "B", "C", "?"))


def check_documents(path: str):
    try:
        documents = load_documents(path)
    except (OSError, ValueError) as error:
        return None, [("FAIL", "documents", f"unreadable ({type(error).__name__})")]
    ids = Counter(d.file_id for d in documents)
    repeated = [i for i, n in ids.items() if n > 1]
    classes = _classes(Counter(d.classification.value for d in documents))
    rows = [("ok", "documents", f"{len(documents)} documents; classes {classes}")]
    if repeated:
        rows.append(("FAIL", "documents", f"file_id repeated: {_ids(repeated)}"))
    return documents, rows


def check_manifest(path: str):
    manifest = try_load_manifest(path)
    if manifest is None:
        return None, [
            ("FAIL", "manifest", "missing, unreadable or inconsistent; nothing can be sent")
        ]
    classes = Counter(e.classification.value for e in manifest.entries)
    allowed = sum(
        e.classification.value == "A" and bool(e.approved_by) and bool(e.approved_on)
        for e in manifest.entries
    )
    detail = f"{len(manifest.entries)} entries; classes {_classes(classes)}; {allowed} may leave"
    return manifest, [("ok", "manifest", detail)]


def check_crossref(documents, manifest):
    absent = [d.file_id for d in documents if manifest.get(d.file_id) is None]
    differs = [
        d.file_id
        for d in documents
        if (e := manifest.get(d.file_id)) is not None and e.classification != d.classification
    ]
    rows = []
    if absent:
        rows.append(("FAIL", "documents vs manifest", f"not in the manifest: {_ids(absent)}"))
    if differs:
        rows.append(("FAIL", "documents vs manifest", f"class differs: {_ids(differs)}"))
    if not rows:
        rows.append(
            ("ok", "documents vs manifest", "every document is in the manifest with the same class")
        )
    return rows


def check_accounts(path: str):
    try:
        users = UserStore(path).users()
    except AccountError as error:
        return [("FAIL", "accounts", str(error))]
    roles = Counter(u.role for u in users)
    detail = ", ".join(f"{r} {roles.get(r, 0)}" for r in ROLES)
    missing = [r for r in ROLES if not roles.get(r)]
    if missing:
        return [("FAIL", "accounts", f"{detail}; no user with role {', '.join(missing)}")]
    return [("ok", "accounts", detail)]


def check_provider(name: str, model: str | None, manifest_path: str | None):
    problems = run.provider_problems(name, model, manifest_path, os.environ)
    if problems:
        return [("FAIL", f"provider {name}", p) for p in problems]
    return [("ok", f"provider {name}", f"model {model} can be used")]


def check_workdir(path: str):
    probe = Path(path).resolve()
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    if probe.is_dir() and os.access(probe, os.W_OK):
        return [("ok", "workdir", "can be written")]
    return [("FAIL", "workdir", "cannot be written")]


def doctor(args: argparse.Namespace) -> int:
    rows: list[tuple[str, str, str]] = []
    documents = manifest = None
    if args.documents:
        documents, found = check_documents(args.documents)
        rows += found
    else:
        rows.append(("skip", "documents", "not checked"))
    if args.manifest:
        manifest, found = check_manifest(args.manifest)
        rows += found
    else:
        rows.append(("skip", "manifest", "not checked"))
    if documents is not None and manifest is not None:
        rows += check_crossref(documents, manifest)
    rows += (
        check_accounts(args.users_file)
        if args.users_file
        else [("skip", "accounts", "not checked")]
    )
    if args.provider:
        rows += check_provider(args.provider, args.model, args.manifest)
    else:
        rows.append(("skip", "provider", "not checked"))
    rows += check_workdir(args.workdir) if args.workdir else [("skip", "workdir", "not checked")]
    for state, item, detail in rows:
        print(f"[{state}] {item}: {detail}")
    failed = sum(state == "FAIL" for state, _, _ in rows)
    if failed:
        print(f"{failed} problem(s)", file=sys.stderr)
        return EXIT_DOCTOR
    return 0
