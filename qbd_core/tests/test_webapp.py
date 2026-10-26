"""The local web page: loopback only, form token required, and the same bytes as the CLI."""

from __future__ import annotations

import http.client
import json
from pathlib import Path
from urllib.parse import urlencode

import pytest

from qbd_core import main as cli
from qbd_core import webapp

DOCS = (
    Path(__file__).resolve().parents[1] / "modules/dossier_drafting/tests/fixtures/documents.json"
)
FORM = {"form": "Viên nén", "market": "both"}
CQA = ["Assay", "Dissolution"]


def call(server, method, path, fields=None, token=True, host=None, headers=None, user="researcher"):
    httpd, ctx = server
    port = httpd.server_address[1]
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=20)
    head = {"Host": host or f"127.0.0.1:{port}", **(headers or {})}
    if user:
        head["Cookie"] = f"{webapp.COOKIE}={ctx.sids[user]}"
    body = None
    if fields is not None:
        data = dict(fields)
        if token:
            data["token"] = ctx.token
        body = urlencode(data, doseq=True)
        head["Content-Type"] = "application/x-www-form-urlencoded"
    conn.request(method, path, body=body, headers=head)
    response = conn.getresponse()
    return response.status, response.getheaders(), response.read()


def inputs(substances=("Atorvastatin calcium",), **extra):
    return {"substance": list(substances), **FORM, **extra}


def signed(**extra):
    return inputs(cqa=CQA, confirmed_on="2026-01-01", **extra)


def runs(ctx):
    return sorted(p for p in ctx.workdir.glob("*") if p.is_dir())


def test_home_page_carries_the_draft_label_and_a_strict_policy(server):
    status, headers, body = call(server, "GET", "/")
    assert status == 200
    assert "chưa FD duyệt" in body.decode()
    assert "default-src 'none'" in dict(headers)["Content-Security-Policy"]


def test_loopback_only(server):
    assert server[0].server_address[0] == "127.0.0.1"


def test_foreign_host_header_is_refused(server):
    assert call(server, "GET", "/", host="evil.example")[0] == 403
    assert call(server, "POST", "/propose", inputs(), host="evil.example")[0] == 403


@pytest.mark.parametrize("token", [False, True])
def test_post_needs_the_right_token(server, token):
    fields = {**inputs(), "token": "wrong"} if token else inputs()
    assert call(server, "POST", "/run", fields, token=False)[0] == 403
    assert runs(server[1]) == []


def test_oversized_body_is_refused_before_it_is_read(server):
    httpd, _ = server
    conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=20)
    conn.putrequest("POST", "/propose")
    conn.putheader("Content-Type", "application/x-www-form-urlencoded")
    conn.putheader("Content-Length", str(webapp.MAX_BODY + 1))
    conn.endheaders()
    assert conn.getresponse().status == 413


def test_only_form_data_is_accepted(server):
    status, _, _ = call(
        server,
        "POST",
        "/propose",
        None,
        headers={"Content-Type": "text/plain", "Content-Length": "0"},
    )
    assert status in (403, 415)


@pytest.mark.parametrize(
    "path",
    [
        "/runs/..",
        "/runs/%2e%2e/x",
        "/runs/../../etc/passwd",
        "/runs/abc",
        "/runs/20260101T000000/../../x",
        "/nothing",
    ],
)
def test_paths_outside_a_run_are_not_found(server, path):
    assert call(server, "GET", path)[0] == 404


def test_rejected_input_creates_no_run(server):
    many = inputs(("A", "B", "C", "D"))
    status, _, body = call(server, "POST", "/propose", many)
    assert status == 400 and "E_" in body.decode()
    unknown = {**inputs(), "form": "Dạng không có"}
    assert call(server, "POST", "/run", unknown)[0] == 400
    assert runs(server[1]) == []


def test_propose_lists_candidates_as_unconfirmed(server):
    status, _, body = call(server, "POST", "/propose", inputs())
    text = body.decode()
    assert status == 200 and "Assay" in text and "Ứng viên" in text
    assert "A13" in text


def _result(server, fields):
    status, headers, _ = call(server, "POST", "/run", fields)
    assert status == 303
    location = dict(headers)["Location"]
    page = call(server, "GET", location)
    return location, page


def test_unconfirmed_cqa_stops_the_run_and_writes_no_draft(server):
    _, (status, _, body) = _result(server, inputs())
    assert status == 200 and "mã 5" in body.decode()
    (folder,) = runs(server[1])
    assert not (folder / "draft.json").exists()


def test_future_date_or_empty_cqa_is_refused(server):
    for extra in ({"confirmed_on": "2999-01-01"}, {"cqa": []}):
        _, (_, _, body) = _result(server, {**signed(), **extra})
        assert "mã 5" in body.decode()
    assert not any((f / "draft.json").exists() for f in runs(server[1]))


def test_combination_is_refused(server):
    _, (_, _, body) = _result(server, signed(substance=["Atorvastatin calcium", "Amlodipine"]))
    assert "mã 3" in body.decode()


def test_confirmed_run_shows_gaps_and_the_draft_page(server):
    location, (status, _, body) = _result(server, signed())
    text = body.decode()
    assert status == 200 and "khoảng trống" in text and "CẦN DỮ LIỆU" in text
    code, _, draft = call(server, "GET", location + "/draft")
    assert code == 200 and b"ch\xc6\xb0a FD duy\xe1\xbb\x87t" in draft
    listing = call(server, "GET", "/runs")[2].decode()
    assert location.rsplit("/", 1)[1] in listing


def test_web_draft_equals_the_command_line_draft(server, tmp_path):
    location, _ = _result(server, signed())
    web = (server[1].workdir / location.rsplit("/", 1)[1]).resolve()
    cli_dir = tmp_path / "cli"
    code = cli.main(
        [
            "run",
            "--substance",
            "Atorvastatin calcium",
            "--form",
            "Viên nén",
            "--market",
            "both",
            "--documents",
            str(DOCS),
            "--out",
            str(cli_dir / "draft.json"),
            "--cqa-confirmation",
            str(web / "cqa-confirmation.json"),
            "--render-dir",
            str(cli_dir / "html"),
        ]
    )
    assert code == 0
    assert (cli_dir / "draft.json").read_bytes() == (web / "draft.json").read_bytes()
    assert (cli_dir / "draft.quality.json").read_bytes() == (
        web / "draft.quality.json"
    ).read_bytes()
    name = webapp.DEFAULT_NAME
    assert (cli_dir / "html" / name).read_bytes() == (web / "html" / name).read_bytes()


def test_run_record_is_valid_json(server):
    _result(server, signed())
    (folder,) = runs(server[1])
    assert json.loads((folder / "run.json").read_text(encoding="utf-8"))["exit"] == 0


def test_system_page_is_read_only_and_lists_agents(server):
    status, _, body = call(server, "GET", "/system")
    text = body.decode()
    assert status == 200 and "Input Validator" in text and "anthropic" in text
    assert call(server, "POST", "/system", {})[0] == 404
