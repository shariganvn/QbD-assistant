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
    CqaNotConfirmed,
    DraftingRefused,
    IntakeRejected,
    assemble_draft,
    load_confirmation,
    propose_cqa,
    validate_intake,
)
from qbd_core.modules.evidence.api import InMemoryKnowledge, load_documents
from qbd_core.modules.rendering.api import DEFAULT_NAME, RenderFailed, render_draft


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--substance", action="append", required=True, dest="substances")
    parser.add_argument("--form", required=True)
    parser.add_argument("--market", required=True)
    parser.add_argument("--documents", required=True, help="JSON list of knowledge documents")
    parser.add_argument("--out", required=True)
    parser.add_argument("--date", default=None, help="YYYY-MM-DD; defaults to today")
    parser.add_argument("--cqa-confirmation", default=None, help="JSON signed by the person")


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
        confirmation = load_confirmation(args.cqa_confirmation)
        result = assemble_draft(intake, knowledge, today, confirmation=confirmation)
    except IntakeRejected as rejected:
        print("rejected: " + ", ".join(rejected.codes), file=sys.stderr)
        return 2
    except CqaNotConfirmed as refused:
        print(f"refused: {refused.code}", file=sys.stderr)
        return 5
    except DraftingRefused as refused:
        print(f"refused: {refused.code}", file=sys.stderr)
        return 3
    body = json.dumps(result.draft, ensure_ascii=False, indent=2) + "\n"
    _write_atomically(Path(args.out), body)
    covered = sum(s["status"] == "covered" for s in result.draft["sections"])
    summary = (
        f"{covered} covered, {len(result.gaps)} gap, "
        f"restricted={result.contains_restricted}, cqa={result.cqa_status}"
    )
    print(f"draft written: {summary}")
    return 0


def add_propose_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--substance", action="append", required=True, dest="substances")
    parser.add_argument("--form", required=True)
    parser.add_argument("--market", required=True)
    parser.add_argument("--out", required=True)


def propose(args: argparse.Namespace) -> int:
    raw = {"substances": args.substances, "dosage_form": args.form, "market": args.market}
    try:
        proposal = propose_cqa(validate_intake(raw))
    except IntakeRejected as rejected:
        print("rejected: " + ", ".join(rejected.codes), file=sys.stderr)
        return 2
    _write_atomically(Path(args.out), proposal.model_dump_json(indent=2) + "\n")
    print(f"proposal written: {len(proposal.candidates)} candidates, group {proposal.group}")
    return 0


def add_render_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--draft", required=True, help="draft.json produced by `run`")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--name", default=DEFAULT_NAME)


def render(args: argparse.Namespace) -> int:
    try:
        draft = json.loads(Path(args.draft).read_text(encoding="utf-8"))
        result = render_draft(draft, args.out_dir, args.name)
    except (OSError, ValueError) as error:
        print(f"unreadable draft: {error}", file=sys.stderr)
        return 6
    except RenderFailed as failed:
        print(f"render failed: {failed.code}", file=sys.stderr)
        return 6
    print(f"html written: {result.path} ({result.size} bytes)")
    return 0
