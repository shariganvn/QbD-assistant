"""Acceptance run: every case through the real `run` command, twice, against its expectation.

A case passes when the exit code is the expected one and the two runs write identical bytes.
Appendix C counts and the data requests are reported as they are; an incomplete checklist does not
fail a case, because with synthetic knowledge it is expected to be incomplete.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

from qbd_core import run
from qbd_core.publish import PublishFailed, publish_all

EXIT_ACCEPT, EXIT_CASES = 11, 12
SUMMARY, REQUESTS = "g-10.txt", "g-10-data-requests.md"


class CasesUnreadable(Exception):  # noqa: N818
    pass


def add_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--cases", required=True, help="JSON list of acceptance cases")
    parser.add_argument("--out-dir", required=True, help="one report per case is written here")


def load_cases(path: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        spec = json.loads(Path(path).read_text("utf-8"))
        cases = spec["cases"]
        ids = [c["id"] for c in cases]
        if not cases or len(set(ids)) != len(ids):
            raise ValueError("ids")
        for case in cases:
            case["substances"], case["form"], case["market"], case["expect_exit"]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise CasesUnreadable(type(error).__name__) from error
    return spec, cases


def _documents(spec: dict[str, Any], case: dict[str, Any], base: Path) -> str:
    name = case.get("documents") or spec.get("documents")
    if not name:
        raise CasesUnreadable("documents")
    return str((base / name).resolve())


def _execute(case: dict[str, Any], documents: str, date: str, folder: Path):
    args = argparse.Namespace(
        substances=list(case["substances"]),
        form=case["form"],
        market=case["market"],
        documents=documents,
        out=str(folder / "draft.json"),
        date=date,
        cqa_confirmation=None,
        render_dir=None,
        trial_files=case.get("trial_files"),
        provider_recording=None,
        model=None,
        manifest=None,
        provider_destination="remote",
    )
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        code = run.run(args)
    hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.glob("*"))}
    return code, hashes


def run_case(spec: dict[str, Any], case: dict[str, Any], base: Path) -> dict[str, Any]:
    documents = _documents(spec, case, base)
    date = spec.get("date")
    with tempfile.TemporaryDirectory(prefix="qbd-accept-") as scratch:
        first, h1 = _execute(case, documents, date, _folder(scratch, "a"))
        second, h2 = _execute(case, documents, date, _folder(scratch, "b"))
        draft = _load(Path(scratch) / "a" / "draft.json")
        quality = _load(Path(scratch) / "a" / "draft.quality.json")
    sections = draft["sections"] if draft else []
    gaps = [s for s in sections if s["status"] == "gap"]
    return {
        "id": case["id"],
        "group": case.get("group", ""),
        "input": {k: case[k] for k in ("substances", "form", "market")},
        "expected_exit": case["expect_exit"],
        "exit": first,
        "exit_matches": first == case["expect_exit"],
        "deterministic": first == second and h1 == h2,
        "files": sorted(h1),
        "covered": sum(s["status"] == "covered" for s in sections),
        "gap": len(gaps),
        "appendix_c": dict(sorted(Counter(c["status"] for c in quality["checklist"]).items()))
        if quality
        else {},
        "data_requests": [{"section": s["id"], "reason": s["gapReason"]} for s in gaps],
    }


def _folder(scratch: str, name: str) -> Path:
    folder = Path(scratch) / name
    folder.mkdir()
    return folder


def _load(path: Path):
    return json.loads(path.read_text("utf-8")) if path.exists() else None


def _ok(report: dict[str, Any]) -> bool:
    return report["exit_matches"] and report["deterministic"]


def summary_text(reports: list[dict[str, Any]]) -> str:
    lines = ["case | group | exit (expected) | same bytes twice | covered | gap | appendix C"]
    for r in reports:
        lines.append(
            f"{r['id']} | {r['group']} | {r['exit']} ({r['expected_exit']}) | "
            f"{'yes' if r['deterministic'] else 'NO'} | {r['covered']} | {r['gap']} | "
            + (", ".join(f"{k}={v}" for k, v in r["appendix_c"].items()) or "-")
        )
    failed = [r["id"] for r in reports if not _ok(r)]
    lines.append(f"cases: {len(reports)}; failed: {', '.join(failed) or 'none'}")
    lines.append("knowledge: synthetic documents; this shows the pipeline, not real content")
    lines.append("head of R&D sign-off (A13): not recorded here")
    return "\n".join(lines) + "\n"


def requests_text(reports: list[dict[str, Any]]) -> str:
    out = ["# Data still needed, grouped by reason", ""]
    by_reason: dict[str, list[str]] = {}
    for r in reports:
        for item in r["data_requests"]:
            by_reason.setdefault(item["reason"], []).append(f"{r['id']}:{item['section']}")
    for reason, where in sorted(by_reason.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        out.append(f"- {reason} ({len(where)} sections; first: {', '.join(where[:3])})")
    return "\n".join(out) + "\n"


def accept(args: argparse.Namespace) -> int:
    try:
        spec, cases = load_cases(args.cases)
        base = Path(args.cases).resolve().parent
        reports = [run_case(spec, case, base) for case in cases]
    except CasesUnreadable as error:
        print(f"cases unreadable: {error}", file=sys.stderr)
        return EXIT_CASES
    text = summary_text(reports)
    failed = [r["id"] for r in reports if not _ok(r)]
    if failed:
        print(text, file=sys.stderr)
        print("nothing written: " + ", ".join(failed), file=sys.stderr)
        return EXIT_ACCEPT
    out = Path(args.out_dir)
    files = {
        out / f"{r['id']}.json": (json.dumps(r, ensure_ascii=False, indent=2) + "\n").encode()
        for r in reports
    }
    files[out / SUMMARY] = text.encode()
    files[out / REQUESTS] = requests_text(reports).encode()
    try:
        publish_all(files)
    except PublishFailed as failed_publish:
        print(f"publish failed: {failed_publish}", file=sys.stderr)
        return run.EXIT_PUBLISH
    print(text, end="")
    return 0
