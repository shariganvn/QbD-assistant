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
from qbd_core.modules.quality_gate.api import QualityReport, evaluate_run
from qbd_core.modules.rendering.api import DEFAULT_NAME, RenderFailed, render_draft
from qbd_core.publish import PublishFailed, publish_all


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--substance", action="append", required=True, dest="substances")
    parser.add_argument("--form", required=True)
    parser.add_argument("--market", required=True)
    parser.add_argument("--documents", required=True, help="JSON list of knowledge documents")
    parser.add_argument("--out", required=True)
    parser.add_argument("--date", default=None, help="YYYY-MM-DD; defaults to today")
    parser.add_argument("--cqa-confirmation", default=None, help="JSON signed by the person")
    parser.add_argument("--render-dir", default=None, help="also render the HTML page here")


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


STATUS_LABEL = {
    "pass": "Đạt",
    "fail": "Không đạt",
    "review": "Chờ người rà soát",
    "open": "Còn khoảng trống",
    "na": "N.A.",
}


def checklist_rows(report: QualityReport) -> list[tuple[str, str, str, str]]:
    return [(str(c.no), c.text, STATUS_LABEL[c.status], c.detail) for c in report.checklist]


EXIT_INTAKE, EXIT_REFUSED, EXIT_DOCUMENTS, EXIT_CQA, EXIT_RENDER, EXIT_BLOCKED, EXIT_PUBLISH = (
    2, 3, 4, 5, 6, 7, 8,
)  # fmt: skip


class BadDate(Exception):  # noqa: N818
    pass


class DocumentsUnreadable(Exception):  # noqa: N818
    pass


def _today(text: str | None) -> date:
    try:
        return date.fromisoformat(text) if text else date.today()
    except ValueError as error:
        raise BadDate(text) from error


def _knowledge(path: str) -> InMemoryKnowledge:
    try:
        return InMemoryKnowledge(load_documents(path))
    except (OSError, ValueError) as error:
        raise DocumentsUnreadable(type(error).__name__) from error


def _compute(args: argparse.Namespace):
    """Everything up to the quality report. Nothing is written here."""
    raw = {"substances": args.substances, "dosage_form": args.form, "market": args.market}
    intake = validate_intake(raw)
    today = _today(args.date)
    knowledge = _knowledge(args.documents)
    confirmation = load_confirmation(args.cqa_confirmation)
    result = assemble_draft(intake, knowledge, today, confirmation=confirmation)
    return result, evaluate_run(result, knowledge)


def _render_bytes(result, report) -> bytes:
    with tempfile.TemporaryDirectory(prefix="qbd-render-") as scratch:
        page = render_draft(result.draft, scratch, checklist=checklist_rows(report))
        return Path(page.path).read_bytes()


def run(args: argparse.Namespace) -> int:
    """Compute and render in memory or scratch space, then publish every file or none."""
    try:
        result, report = _compute(args)
    except IntakeRejected as rejected:
        print("rejected: " + ", ".join(rejected.codes), file=sys.stderr)
        return EXIT_INTAKE
    except CqaNotConfirmed as refused:
        print(f"refused: {refused.code}", file=sys.stderr)
        return EXIT_CQA
    except DraftingRefused as refused:
        print(f"refused: {refused.code}", file=sys.stderr)
        return EXIT_REFUSED
    except BadDate:
        print("rejected: --date is not YYYY-MM-DD", file=sys.stderr)
        return EXIT_INTAKE
    except DocumentsUnreadable as error:
        print(f"unreadable documents: {error}", file=sys.stderr)
        return EXIT_DOCUMENTS
    out = Path(args.out)
    if not report.passed:
        blocked = ", ".join(sorted({f.code for f in report.blocking}))
        # A different name, so the report of the last good run keeps matching the last good draft.
        name = out.with_name(out.stem + ".quality.blocked.json")
        publish_all({name: (report.model_dump_json(indent=2) + "\n").encode("utf-8")})
        print(f"blocked by the quality gate: {blocked}", file=sys.stderr)
        return EXIT_BLOCKED
    files = {
        out: (json.dumps(result.draft, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        out.with_name(out.stem + ".quality.json"): (report.model_dump_json(indent=2) + "\n").encode(
            "utf-8"
        ),
    }
    try:
        if args.render_dir:
            files[Path(args.render_dir) / DEFAULT_NAME] = _render_bytes(result, report)
        publish_all(files)
    except RenderFailed as failed:
        print(f"render failed: {failed.code}", file=sys.stderr)
        return EXIT_RENDER
    except PublishFailed as failed:
        print(f"publish failed: {failed}", file=sys.stderr)
        return EXIT_PUBLISH
    covered = sum(s["status"] == "covered" for s in result.draft["sections"])
    summary = (
        f"{covered} covered, {len(result.gaps)} gap, "
        f"restricted={result.contains_restricted}, cqa={result.cqa_status}"
    )
    print(f"draft written: {summary}")
    if args.render_dir:
        print(f"html written: {Path(args.render_dir) / DEFAULT_NAME}")
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
