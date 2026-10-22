"""The real provider is off until the project turns it on, and every missing part refuses."""

import json
from pathlib import Path

import pytest

from qbd_core import main, run
from qbd_core.modules.provider_access import api as provider_api

DOCS = Path(__file__).parents[1] / "modules/dossier_drafting/tests/fixtures/documents.json"
MANIFEST = Path(__file__).parents[1] / "modules/egress_gate/tests/fixtures/manifest.json"


@pytest.fixture(autouse=True)
def nothing_is_sent(monkeypatch):
    def fail(*args, **kwargs):
        raise AssertionError("a request was sent")

    monkeypatch.setattr("urllib.request.OpenerDirector.open", fail)


def invoke(tmp_path, *extra):
    out = tmp_path / "draft.json"
    code = main.main(
        ["run", "--substance", "Atorvastatin calcium", "--form", "Viên nén bao phim",
         "--market", "both", "--documents", str(DOCS), "--out", str(out),
         "--date", "2026-10-22", "--provider", "anthropic", *extra]
    )  # fmt: skip
    return code, out


def enable(monkeypatch, **changes):
    base = provider_api.load_config()  # anthropic
    monkeypatch.setattr(run, "load_config", lambda name: type(base)(**{**base.__dict__, **changes}))


def test_shipped_configuration_refuses_and_publishes_nothing(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    code, out = invoke(tmp_path, "--model", "claude-sonnet-5-5", "--manifest", str(MANIFEST))
    assert code == run.EXIT_PROVIDER and not out.exists()
    assert "switched off" in capsys.readouterr().err


@pytest.mark.parametrize(
    ("extra", "changes", "env", "why"),
    [
        ([], {"enabled": True}, True, "takes --model"),
        (["--model", "other", "--manifest", str(MANIFEST)], {"enabled": True}, True, "approved"),
        (["--model", "claude-sonnet-5-5"], {"enabled": True}, True, "manifest"),
        (
            ["--model", "claude-sonnet-5-5", "--manifest", str(MANIFEST)],
            {"enabled": True},
            False,
            "is not set",
        ),
    ],
)
def test_each_missing_prerequisite_refuses(tmp_path, monkeypatch, capsys, extra, changes, env, why):
    enable(monkeypatch, **changes)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    if env:
        monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    code, out = invoke(tmp_path, *extra)
    assert code == run.EXIT_PROVIDER and not out.exists()
    assert why in capsys.readouterr().err


def test_a_recording_cannot_be_mixed_with_the_real_provider(tmp_path, monkeypatch):
    enable(monkeypatch, enabled=True)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    recording = tmp_path / "rec.json"
    recording.write_text(json.dumps({}), encoding="utf-8")
    code, _ = invoke(
        tmp_path, "--model", "claude-sonnet-5-5", "--manifest", str(MANIFEST),
        "--provider-recording", str(recording),
    )  # fmt: skip
    assert code == run.EXIT_PROVIDER


@pytest.mark.parametrize("name", ["openai", "gemini"])
def test_other_vendors_ship_off_and_refuse(tmp_path, monkeypatch, capsys, name):
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    out = tmp_path / "draft.json"
    code = main.main(
        ["run", "--substance", "Atorvastatin calcium", "--form", "Viên nén bao phim",
         "--market", "both", "--documents", str(DOCS), "--out", str(out),
         "--date", "2026-10-22", "--provider", name, "--model", "some-model",
         "--manifest", str(MANIFEST)]
    )  # fmt: skip
    assert code == run.EXIT_PROVIDER and not out.exists()
    assert "switched off" in capsys.readouterr().err
