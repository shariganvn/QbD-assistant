"""Any failure of a run leaves the files published earlier byte-identical and nothing partial."""

import argparse
import hashlib
import json
import os
from pathlib import Path

import pytest

from qbd_core import publish as publish_module
from qbd_core import run as run_module
from qbd_core.modules.quality_gate.api import Finding, QualityReport
from qbd_core.modules.rendering.api import RenderFailed

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "qbd_core/modules/dossier_drafting/tests/fixtures/documents.json"
FAKE_PAGE = b"<!DOCTYPE html><html><body>fake page</body></html>"


def args(tmp_path, **changes):
    base = {
        "substances": ["Atorvastatin calcium"],
        "form": "Viên nén bao phim",
        "market": "both",
        "documents": str(DOCS),
        "out": str(tmp_path / "out" / "draft.json"),
        "date": "2026-10-21",
        "cqa_confirmation": None,
        "render_dir": str(tmp_path / "html"),
    }
    return argparse.Namespace(**{**base, **changes})


def snapshot(tmp_path):
    return {
        str(p.relative_to(tmp_path)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(tmp_path.rglob("*"))
        if p.is_file()
    }


def leftovers(tmp_path):
    return [p.name for p in tmp_path.rglob("*") if ".new" in p.name or ".stage-" in p.name]


@pytest.fixture(autouse=True)
def fake_render(monkeypatch):
    monkeypatch.setattr(run_module, "_render_bytes", lambda *a, **k: FAKE_PAGE)


@pytest.fixture
def published(tmp_path):
    assert run_module.run(args(tmp_path)) == 0
    return snapshot(tmp_path)


def test_a_good_run_publishes_the_draft_the_report_and_the_page(published):
    assert sorted(published) == [
        "html/p2-orientation-draft.html",
        "out/draft.json",
        "out/draft.quality.json",
    ]


FAILURES = {
    "unknown form": ({"form": "no such form"}, 2),
    "bad date": ({"date": "not-a-date"}, 2),
    "combination": ({"substances": ["A", "B"]}, 3),
    "documents missing": ({"documents": "absent.json"}, 4),
    "wrong confirmation": ({"cqa_confirmation": "WRITE"}, 5),
}


@pytest.mark.parametrize("name", list(FAILURES))
def test_a_rejected_run_changes_nothing(tmp_path, published, name):
    changes, code = FAILURES[name]
    if changes.get("cqa_confirmation") == "WRITE":
        wrong = tmp_path / "wrong.json"
        wrong.write_text(
            json.dumps(
                {
                    "intake_digest": "0" * 64,
                    "confirmed_cqa": ["Assay"],
                    "confirmed_by": "T",
                    "confirmed_on": "2026-10-20",
                }
            ),
            encoding="utf-8",
        )
        published = snapshot(tmp_path)
        changes = {"cqa_confirmation": str(wrong)}
    assert run_module.run(args(tmp_path, **{"date": "2026-10-25", **changes})) == code
    assert snapshot(tmp_path) == published and leftovers(tmp_path) == []


@pytest.mark.parametrize("content", ["not json", "{}", '[{"file_id": 1}]', '[{"x": 1}]'])
def test_unreadable_or_invalid_documents_change_nothing(tmp_path, published, content):
    bad = tmp_path / "bad.json"
    bad.write_text(content, encoding="utf-8")
    before = snapshot(tmp_path)
    assert run_module.run(args(tmp_path, documents=str(bad), date="2026-10-25")) == 4
    assert snapshot(tmp_path) == before and leftovers(tmp_path) == []


def test_a_blocked_run_adds_only_a_separate_report(tmp_path, published, monkeypatch):
    blocking = QualityReport(findings=(Finding(code="E_UNSOURCED_TEXT", severity="block"),))
    monkeypatch.setattr(run_module, "evaluate_run", lambda *a, **k: blocking)
    assert run_module.run(args(tmp_path, date="2026-10-25")) == 7
    after = snapshot(tmp_path)
    assert {k: v for k, v in after.items() if "blocked" not in k} == published
    assert "out/draft.quality.blocked.json" in after and leftovers(tmp_path) == []


def test_a_render_failure_changes_nothing(tmp_path, published, monkeypatch):
    def fail(*a, **k):
        raise RenderFailed("E_VERIFY_FAILED")

    monkeypatch.setattr(run_module, "_render_bytes", fail)
    assert run_module.run(args(tmp_path, date="2026-10-25")) == 6
    assert snapshot(tmp_path) == published and leftovers(tmp_path) == []


def test_a_failure_while_replacing_restores_the_files_already_replaced(
    tmp_path, published, monkeypatch
):
    real, calls = os.replace, []

    def flaky(src, dst):
        calls.append(dst)
        if len(calls) == 3:
            raise OSError("disk error")
        return real(src, dst)

    monkeypatch.setattr(publish_module.os, "replace", flaky)
    assert run_module.run(args(tmp_path, date="2026-10-25")) == 8
    assert len(calls) >= 3
    assert snapshot(tmp_path) == published and leftovers(tmp_path) == []


def test_a_failure_while_staging_touches_no_target(tmp_path, published, monkeypatch):
    real, calls = publish_module.tempfile.mkstemp, []

    def flaky(*a, **k):
        calls.append(1)
        if len(calls) == 2:
            raise OSError("no space")
        return real(*a, **k)

    monkeypatch.setattr(publish_module.tempfile, "mkstemp", flaky)
    assert run_module.run(args(tmp_path, date="2026-10-25")) == 8
    assert snapshot(tmp_path) == published and leftovers(tmp_path) == []


def test_an_unexpected_crash_publishes_nothing(tmp_path, published, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("bug")

    monkeypatch.setattr(run_module, "assemble_draft", boom)
    with pytest.raises(RuntimeError):
        run_module.run(args(tmp_path, date="2026-10-25"))
    assert snapshot(tmp_path) == published


def test_a_failing_knowledge_lookup_publishes_nothing(tmp_path, published, monkeypatch):
    def boom(self, query, limit=5):
        raise TimeoutError("index down")

    monkeypatch.setattr(run_module.InMemoryKnowledge, "search", boom)
    with pytest.raises(TimeoutError):
        run_module.run(args(tmp_path, date="2026-10-25"))
    assert snapshot(tmp_path) == published


@pytest.mark.parametrize("stage", ["rejected", "documents", "render", "publish"])
def test_a_failed_first_run_leaves_the_folder_empty(tmp_path, monkeypatch, stage):
    changes = {}
    if stage == "rejected":
        changes = {"form": "no such form"}
    if stage == "documents":
        changes = {"documents": "absent.json"}
    if stage == "render":
        monkeypatch.setattr(
            run_module, "_render_bytes", lambda *a, **k: (_ for _ in ()).throw(RenderFailed("E_X"))
        )
    if stage == "publish":
        monkeypatch.setattr(
            publish_module.os, "replace", lambda *a: (_ for _ in ()).throw(OSError("x"))
        )
    assert run_module.run(args(tmp_path, **changes)) in {2, 4, 6, 8}
    assert [p for p in tmp_path.rglob("*") if p.is_file()] == []


def test_after_failures_a_good_run_still_succeeds_and_updates_the_files(tmp_path, published):
    assert run_module.run(args(tmp_path, form="no such form")) == 2
    assert run_module.run(args(tmp_path, date="2026-10-25")) == 0
    after = snapshot(tmp_path)
    assert after["out/draft.json"] != published["out/draft.json"]


def test_publish_all_restores_a_new_file_and_an_overwritten_one(tmp_path, monkeypatch):
    old = tmp_path / "a.txt"
    old.write_bytes(b"old")
    new, third = tmp_path / "sub" / "b.txt", tmp_path / "c.txt"
    real, count = os.replace, []

    def flaky(src, dst):
        count.append(dst)
        if len(count) == 3:
            raise OSError("boom")
        return real(src, dst)

    monkeypatch.setattr(publish_module.os, "replace", flaky)
    with pytest.raises(publish_module.PublishFailed):
        publish_module.publish_all({old: b"new", new: b"b", third: b"c"})
    assert old.read_bytes() == b"old" and not new.exists() and not third.exists()
    assert leftovers(tmp_path) == []
