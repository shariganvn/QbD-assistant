"""The `run` command: three inputs and a document set in, a draft file out."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

from qbd_core.modules.dossier_drafting.api import (
    DraftingRefused,
    IntakeRejected,
    assemble_draft,
    validate_intake,
)
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--substance", action="append", required=True, dest="substances")
    parser.add_argument("--form", required=True)
    parser.add_argument("--market", required=True)
    parser.add_argument("--documents", required=True, help="JSON list of knowledge documents")
    parser.add_argument("--out", required=True)
    parser.add_argument("--date", default=None, help="YYYY-MM-DD; defaults to today")


def _write_atomically(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def run(args: argparse.Namespace) -> int:
    raw = {"substances": args.substances, "dosage_form": args.form, "market": args.market}
    try:
        intake = validate_intake(raw)
        knowledge = InMemoryKnowledge(load_documents(args.documents))
        today = date.fromisoformat(args.date) if args.date else date.today()
        result = assemble_draft(intake, knowledge, today)
    except IntakeRejected as rejected:
        print("rejected: " + ", ".join(rejected.codes), file=sys.stderr)
        return 2
    except DraftingRefused as refused:
        print(f"refused: {refused.code}", file=sys.stderr)
        return 3
    body = json.dumps(result.draft, ensure_ascii=False, indent=2) + "\n"
    _write_atomically(Path(args.out), body)
    covered = sum(s["status"] == "covered" for s in result.draft["sections"])
    summary = f"{covered} covered, {len(result.gaps)} gap, restricted={result.contains_restricted}"
    print(f"draft written: {summary}")
    return 0
