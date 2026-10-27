"""`doctor` is read-only, prints counts and ids only, and agrees with what `run` would do."""

import json
import socket
from pathlib import Path

import pytest

from qbd_core import doctor, main, run
from qbd_core.modules.accounts.api import UserStore
from qbd_core.modules.provider_access import api as provider_api

DOCS = Path(__file__).parents[1] / "modules/dossier_drafting/tests/fixtures/documents.json"
MODEL = "claude-sonnet-5-5"
SECRET = "sk-test-SECRET-VALUE"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("doctor must not touch the network")

    monkeypatch.setattr(socket.socket, "connect", refuse)


def manifest(tmp_path, entries=None):
    entries = entries or [
        {
            "file_id": "SYN-A",
            "classification": "A",
            "approved_by": "X",
            "approved_on": "2026-10-23",
        },
        {"file_id": "SYN-B", "classification": "B"},
    ]
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps({"entries": entries}), encoding="utf-8")
    return str(path)


def enable(monkeypatch, **changes):
    base = provider_api.load_config()
    monkeypatch.setattr(run, "load_config", lambda name: type(base)(**{**base.__dict__, **changes}))


def check(capsys, *argv):
    code = main.main(["doctor", *argv])
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def test_nothing_given_checks_nothing(capsys):
    code, out, _ = check(capsys)
    assert code == 0 and out.count("[skip]") == 5


def test_documents_and_manifest_agree(tmp_path, capsys):
    code, out, _ = check(capsys, "--documents", str(DOCS), "--manifest", manifest(tmp_path))
    assert code == 0
    assert "2 documents; classes A 1, B 1, C 0, ? 0" in out
    assert "1 may leave" in out and "same class" in out


def test_problems_with_documents(tmp_path, capsys):
    bad = tmp_path / "docs.json"
    bad.write_text("not json", encoding="utf-8")
    code, out, err = check(capsys, "--documents", str(bad))
    assert (
        code == doctor.EXIT_DOCTOR and "[FAIL] documents: unreadable" in out and "1 problem" in err
    )
    dup = tmp_path / "dup.json"
    doc = {"file_id": "D1", "name": "n", "classification": "A", "pages": ["p"]}
    dup.write_text(json.dumps([doc, doc]), encoding="utf-8")
    assert "file_id repeated: D1" in check(capsys, "--documents", str(dup))[1]


def test_problems_with_manifest(tmp_path, capsys):
    code, out, _ = check(capsys, "--manifest", str(tmp_path / "none.json"))
    assert code == doctor.EXIT_DOCTOR and "[FAIL] manifest" in out


def test_documents_missing_from_manifest_or_with_another_class(tmp_path, capsys):
    only_a = manifest(tmp_path, [{"file_id": "SYN-A", "classification": "A"}])
    out = check(capsys, "--documents", str(DOCS), "--manifest", only_a)[1]
    assert "not in the manifest: SYN-B" in out
    swapped = manifest(tmp_path, [{"file_id": "SYN-A", "classification": "B"},
                                  {"file_id": "SYN-B", "classification": "B"}])  # fmt: skip
    assert (
        "class differs: SYN-A" in check(capsys, "--documents", str(DOCS), "--manifest", swapped)[1]
    )


def test_accounts(tmp_path, capsys):
    path = tmp_path / "u.json"
    assert check(capsys, "--users-file", str(path))[0] == doctor.EXIT_DOCTOR
    store = UserStore(path)
    store.add("A", "researcher", "long enough")
    code, out, _ = check(capsys, "--users-file", str(path))
    assert code == doctor.EXIT_DOCTOR and "no user with role head" in out
    store.add("B", "head", "long enough")
    assert check(capsys, "--users-file", str(path))[0] == 0


def test_workdir(tmp_path, capsys):
    assert check(capsys, "--workdir", str(tmp_path / "new" / "runs"))[0] == 0
    a_file = tmp_path / "file"
    a_file.write_text("x", encoding="utf-8")
    assert check(capsys, "--workdir", str(a_file / "runs"))[0] == doctor.EXIT_DOCTOR


CASES = [
    ("shipped", {}, "k", MODEL, True),
    ("no model", {"enabled": True}, "k", None, True),
    ("model not approved", {"enabled": True}, "k", "other", True),
    ("no manifest", {"enabled": True}, "k", MODEL, False),
    ("no key", {"enabled": True}, None, MODEL, True),
    ("ready", {"enabled": True}, "k", MODEL, True),
]


@pytest.mark.parametrize(("label", "changes", "key", "model", "with_manifest"), CASES)
def test_doctor_and_run_give_the_same_answer(
    tmp_path, monkeypatch, capsys, label, changes, key, model, with_manifest
):
    enable(monkeypatch, **changes)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    if key:
        monkeypatch.setenv("ANTHROPIC_API_KEY", key)
    path = manifest(tmp_path) if with_manifest else None
    argv = ["--provider", "anthropic"] + (["--model", model] if model else [])
    argv += ["--manifest", path] if path else []
    code, out, _ = check(capsys, *argv)
    run_args = ["run", "--substance", "Atorvastatin calcium", "--form", "Viên nén bao phim",
                "--market", "both", "--documents", str(DOCS), "--out", str(tmp_path / "d.json"),
                "--date", "2026-10-22", *argv]  # fmt: skip
    ready = label == "ready"
    sent = []
    monkeypatch.setattr("urllib.request.OpenerDirector.open", lambda *a, **k: sent.append(a))
    if not ready:
        assert code == doctor.EXIT_DOCTOR
        assert main.main(run_args) == run.EXIT_PROVIDER
    else:
        assert code == 0 and "can be used" in out


def test_key_value_and_file_names_never_appear(tmp_path, monkeypatch, capsys):
    enable(monkeypatch, enabled=True)
    monkeypatch.setenv("ANTHROPIC_API_KEY", SECRET)
    code, out, err = check(
        capsys, "--documents", str(DOCS), "--manifest", manifest(tmp_path),
        "--provider", "anthropic", "--model", MODEL, "--workdir", str(tmp_path),
    )  # fmt: skip
    assert code == 0
    for text in (out, err):
        assert SECRET not in text and "Synthetic" not in text and "monograph" not in text


def test_many_ids_are_shortened():
    shown = doctor._ids([f"ID{i:02d}" for i in range(25)])
    assert shown.endswith("(+15 more)") and shown.count("ID") == doctor.MAX_IDS
