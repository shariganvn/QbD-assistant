"""The `run` command: three inputs and a document set in, a draft file out."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from collections import Counter
from datetime import date
from pathlib import Path

from qbd_core.modules.dossier_drafting.api import (
    AgentInfrastructureError,
    CqaNotConfirmed,
    DraftingRefused,
    IntakeRejected,
    LlmSetup,
    assemble_draft,
    load_confirmation,
    propose_cqa,
    validate_intake,
)
from qbd_core.modules.egress_gate.api import Destination, try_load_manifest
from qbd_core.modules.evidence.api import (
    InMemoryKnowledge,
    KhoLoadError,
    TrialIntakeError,
    build_documents,
    inside_a_git_tree,
    load_documents,
    load_trial_data,
    read_table,
)
from qbd_core.modules.provider_access.api import (
    HTTP_PROVIDERS,
    ProviderGateway,
    RecordedProvider,
    build_provider,
    load_config,
)
from qbd_core.modules.provider_access.api import ProviderSetupError as VendorSetupError
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
    parser.add_argument(
        "--trial-file",
        action="append",
        default=None,
        dest="trial_files",
        help="trial report .docx of the team; repeat for several. Read by code only",
    )
    parser.add_argument(
        "--provider-recording",
        default=None,
        help="JSON of stored model answers keyed by request digest; turns the model agents on",
    )
    parser.add_argument(
        "--provider",
        choices=sorted(HTTP_PROVIDERS),
        default=None,
        help="real provider; off in providers.json until the project turns it on",
    )
    parser.add_argument("--model", default=None, help="model name the recording was made for")
    parser.add_argument("--manifest", default=None, help="Kho manifest; without it nothing is sent")
    parser.add_argument(
        "--provider-destination",
        choices=[d.value for d in Destination],
        default=Destination.REMOTE.value,
        help="where the provider runs; anything but local is treated as leaving the machine",
    )


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


(
    EXIT_INTAKE,
    EXIT_REFUSED,
    EXIT_DOCUMENTS,
    EXIT_CQA,
    EXIT_RENDER,
    EXIT_BLOCKED,
    EXIT_PUBLISH,
    EXIT_PROVIDER,
    EXIT_TRIAL,
) = (2, 3, 4, 5, 6, 7, 8, 9, 10)


EXIT_KHO = 13


class BadDate(Exception):  # noqa: N818
    pass


class DocumentsUnreadable(Exception):  # noqa: N818
    pass


class ProviderSetupError(Exception):
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


def _llm(args: argparse.Namespace) -> LlmSetup | None:
    """Model agents run only when a recording and a model name are both given."""
    recording = getattr(args, "provider_recording", None)
    model = getattr(args, "model", None)
    if getattr(args, "provider", None):
        return _real_llm(args, recording, model)
    if recording is None and model is None:
        return None
    if recording is None or not model:
        raise ProviderSetupError("--provider-recording and --model go together")
    try:
        destination = Destination(getattr(args, "provider_destination", Destination.REMOTE.value))
        provider = RecordedProvider.from_file(recording, destination)
    except (OSError, ValueError, AttributeError) as error:
        raise ProviderSetupError(type(error).__name__) from error
    path = getattr(args, "manifest", None)
    manifest = try_load_manifest(path) if path else None
    return LlmSetup(ProviderGateway(provider, {model}, manifest), model)


def _real_llm(args: argparse.Namespace, recording: str | None, model: str | None) -> LlmSetup:
    """Every missing prerequisite refuses; nothing falls back to another provider."""
    try:
        config = load_config(args.provider)
    except (OSError, ValueError, KeyError, TypeError, VendorSetupError) as error:
        raise ProviderSetupError(f"providers.json unusable: {type(error).__name__}") from error
    path = getattr(args, "manifest", None)
    manifest = try_load_manifest(path) if path else None
    if recording is not None or not model:
        raise ProviderSetupError("--provider takes --model and no --provider-recording")
    if not config.enabled:
        raise ProviderSetupError("provider is switched off in providers.json")
    if model not in config.approved_models:
        raise ProviderSetupError("model is not on the approved list")
    if manifest is None:
        raise ProviderSetupError("--manifest is missing or unreadable; nothing can be sent")
    try:
        provider = build_provider(args.provider, config, os.environ)
    except VendorSetupError as error:
        raise ProviderSetupError(str(error)) from error
    return LlmSetup(ProviderGateway(provider, {model}, manifest), model)


def _compute(args: argparse.Namespace):
    """Everything up to the quality report. Nothing is written here."""
    raw = {"substances": args.substances, "dosage_form": args.form, "market": args.market}
    intake = validate_intake(raw)
    today = _today(args.date)
    knowledge = _knowledge(args.documents)
    confirmation = load_confirmation(args.cqa_confirmation)
    llm = _llm(args)
    files = getattr(args, "trial_files", None)
    trial = load_trial_data(files) if files else None
    result = assemble_draft(
        intake, knowledge, today, confirmation=confirmation, llm=llm, trial=trial
    )
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
    except (AgentInfrastructureError, ProviderSetupError) as failed:
        print(f"provider failed: {failed}", file=sys.stderr)
        return EXIT_PROVIDER
    except TrialIntakeError as failed:
        print(f"trial file failed: {failed}", file=sys.stderr)
        return EXIT_TRIAL
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
    for line in result.agent_log:
        print(line)
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


def add_kho_load_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--table", required=True, help="classification-manifest.xlsx of the owner")
    parser.add_argument("--folder", required=True, help="folder with the downloaded Kho files")
    parser.add_argument("--manifest", required=True, help="docs/kho/manifest.json")
    parser.add_argument("--out", required=True, help="documents JSON; must be outside any git tree")
    parser.add_argument("--classes", default="A,B,C", help="comma list of classes to load")


def kho_load(args: argparse.Namespace) -> int:
    """Write the knowledge documents for run --documents from files on this machine."""
    out = Path(args.out)
    if inside_a_git_tree(out):
        print("refused: the output folder is inside a git work tree", file=sys.stderr)
        return EXIT_KHO
    manifest = try_load_manifest(args.manifest)
    if manifest is None:
        print("refused: the manifest is missing or unreadable", file=sys.stderr)
        return EXIT_KHO
    known = {e.file_id: e.classification.value for e in manifest.entries}
    classes = tuple(c.strip() for c in args.classes.split(",") if c.strip())
    try:
        loaded = build_documents(args.folder, read_table(args.table), known, classes)
        payload = json.dumps(
            [d.model_dump(mode="json") for d in loaded.documents], ensure_ascii=False, indent=1
        )
        publish_all({out: (payload + "\n").encode("utf-8")})
    except KhoLoadError as failed:
        print(f"kho load failed: {failed}", file=sys.stderr)
        return EXIT_KHO
    except PublishFailed as failed:
        print(f"publish failed: {failed}", file=sys.stderr)
        return EXIT_PUBLISH
    by_class = Counter(known[d.file_id] for d in loaded.documents)
    reasons = Counter(loaded.skipped.values())
    print(f"loaded {len(loaded.documents)} documents {dict(sorted(by_class.items()))}")
    print(f"skipped {len(loaded.skipped)} {dict(sorted(reasons.items()))}")
    return 0
