"""Sign-in, roles, project list, CSV export and the A13 record of the local web page."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import time
import unicodedata

import pytest

from qbd_core import webapp
from qbd_core.modules.accounts.api import AccountError
from qbd_core.tests.conftest import DOCS
from qbd_core.tests.test_webapp import call, inputs, runs, signed

RESEARCHER, HEAD = "Nguyễn Văn A", "Lê Thọ Tiển"


def make_run(server, fields=None, user="researcher"):
    status, headers, _ = call(server, "POST", "/run", fields or signed(), user=user)
    assert status == 303
    return dict(headers)["Location"].rsplit("/", 1)[1]


def folder(server, run_id):
    return server[1].workdir / run_id


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_everything_needs_a_session(server):
    for path in ("/", "/runs", "/system", "/runs/20260101T000000", "/runs/20260101T000000/draft"):
        status, headers, _ = call(server, "GET", path, user=None)
        assert status == 303 and dict(headers)["Location"] == "/login"
    assert call(server, "POST", "/run", signed(), user=None)[0] == 401
    assert call(server, "POST", "/propose", inputs(), user=None)[0] == 401
    assert call(server, "GET", "/login", user=None)[0] == 200
    assert runs(server[1]) == []


def test_login_sets_a_strict_cookie_and_wrong_password_sets_none(server):
    bad = call(server, "POST", "/login", {"name": RESEARCHER, "password": "nope"}, user=None)
    assert bad[0] == 401 and "Set-Cookie" not in dict(bad[1])
    ok = call(
        server, "POST", "/login", {"name": RESEARCHER, "password": "correct horse"}, user=None
    )
    assert ok[0] == 303
    cookie = dict(ok[1])["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie
    sid = cookie.split(";")[0].split("=", 1)[1]
    status, _, body = call(
        server, "GET", "/", user=None, headers={"Cookie": f"{webapp.COOKIE}={sid}"}
    )
    assert status == 200 and RESEARCHER in body.decode()


def test_forged_or_expired_cookie_is_refused(server):
    forged = {"Cookie": f"{webapp.COOKIE}=forged"}
    assert call(server, "GET", "/", user=None, headers=forged)[0] == 303
    ctx = server[1]
    sid = ctx.sids["researcher"]
    old = ctx.sessions[sid]
    ctx.sessions[sid] = webapp.Session(old.name, old.role, time.time() - 1)
    assert call(server, "GET", "/")[0] == 303


def test_logout_ends_the_session(server):
    assert call(server, "POST", "/logout", {})[0] == 303
    assert call(server, "GET", "/")[0] == 303


def test_five_wrong_passwords_lock_the_name(server):
    for _ in range(webapp.LOCK_AFTER):
        call(server, "POST", "/login", {"name": HEAD, "password": "wrong"}, user=None)
    right = call(server, "POST", "/login", {"name": HEAD, "password": "battery staple"}, user=None)
    assert right[0] == 401
    ctx = server[1]
    count, since = ctx.failures[HEAD.casefold()]
    ctx.failures[HEAD.casefold()] = (count, since - webapp.LOCK_SECONDS - 1)
    assert (
        call(server, "POST", "/login", {"name": HEAD, "password": "battery staple"}, user=None)[0]
        == 303
    )


def test_cqa_signer_is_the_account_not_a_form_field(server):
    run_id = make_run(server, signed(confirmed_by="Someone Else"))
    saved = json.loads((folder(server, run_id) / "cqa-confirmation.json").read_text("utf-8"))
    assert saved["confirmed_by"] == RESEARCHER


def test_project_list_shows_name_and_filters_by_exit(server):
    good = make_run(server, signed(name="Đề tài Atorva"))
    bad = make_run(server, inputs())  # CQA not confirmed: exit 5
    project = json.loads((folder(server, good) / "project.json").read_text("utf-8"))
    assert project["name"] == "Đề tài Atorva" and project["created_by"] == RESEARCHER
    assert project["exit"] == 0
    page = call(server, "GET", "/runs")[2].decode()
    assert "Đề tài Atorva" in page and bad in page
    only_ok = call(server, "GET", "/runs?exit=0")[2].decode()
    assert good in only_ok and bad not in only_ok
    unnamed = json.loads((folder(server, bad) / "project.json").read_text("utf-8"))
    assert unnamed["name"] == "Atorvastatin calcium"


def test_run_without_project_file_is_still_listed(server):
    run_id = make_run(server)
    (folder(server, run_id) / "project.json").unlink()
    assert run_id in call(server, "GET", "/runs")[2].decode()


@pytest.mark.parametrize("text", ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])
def test_csv_cell_blocks_formulas(text):
    assert webapp._csv_cell(text) == "'" + text
    assert webapp._csv_cell("plain") == "plain"


def test_gap_and_checklist_csv(server):
    run_id = make_run(server)
    status, headers, data = call(server, "GET", f"/runs/{run_id}/gaps.csv")
    assert status == 200
    assert "attachment" in dict(headers)["Content-Disposition"]
    assert data.startswith("﻿".encode())
    rows = list(csv.reader(io.StringIO(data.decode("utf-8-sig"))))
    draft = json.loads((folder(server, run_id) / "draft.json").read_text("utf-8"))
    gaps = [s for s in draft["sections"] if s["status"] == "gap"]
    assert rows[0] == ["Mục", "Lý do"] and len(rows) == len(gaps) + 1
    assert any("CẦN BỔ SUNG" in r[1] for r in rows[1:])
    sheet = call(server, "GET", f"/runs/{run_id}/checklist.csv")[2].decode("utf-8-sig")
    assert len(list(csv.reader(io.StringIO(sheet)))) == 18


def test_csv_of_a_run_without_a_draft_is_not_found(server):
    run_id = make_run(server, inputs())
    assert call(server, "GET", f"/runs/{run_id}/gaps.csv")[0] == 404


def test_researcher_cannot_sign_a13(server):
    run_id = make_run(server)
    before = sorted(p.name for p in folder(server, run_id).iterdir())
    assert call(server, "POST", f"/runs/{run_id}/a13", {"note": "x"})[0] == 403
    assert sorted(p.name for p in folder(server, run_id).iterdir()) == before
    page = call(server, "GET", f"/runs/{run_id}")[2].decode()
    assert "Ghi nhận chữ ký A13" not in page.replace("Chữ ký A13", "")


def test_head_signs_and_the_record_binds_the_bytes(server):
    run_id = make_run(server)
    base = folder(server, run_id)
    draft_before = base.joinpath("draft.json").read_bytes()
    status, headers, _ = call(server, "POST", f"/runs/{run_id}/a13", {"note": ""}, user="head")
    assert status == 303
    record = json.loads((base / "a13-record-1.json").read_text("utf-8"))
    assert record["signed_by"] == HEAD
    assert record["draft_sha256"] == sha(base / "draft.json")
    assert record["html_sha256"] == sha(base / "html" / webapp.DEFAULT_NAME)
    assert base.joinpath("draft.json").read_bytes() == draft_before
    page = call(server, "GET", f"/runs/{run_id}", user="head")[2].decode()
    assert "Đã ghi nhận chữ ký A13 do " + HEAD in page and "chưa FD duyệt" in page


def test_a_changed_draft_no_longer_matches_the_signature(server):
    run_id = make_run(server)
    call(server, "POST", f"/runs/{run_id}/a13", {"note": ""}, user="head")
    path = folder(server, run_id) / "draft.json"
    path.write_bytes(path.read_bytes() + b" ")
    page = call(server, "GET", f"/runs/{run_id}", user="head")[2].decode()
    assert "Bản nháp đã đổi sau chữ ký A13" in page


def test_a_second_signature_needs_a_note_and_keeps_the_first(server):
    run_id = make_run(server)
    base = folder(server, run_id)
    call(server, "POST", f"/runs/{run_id}/a13", {"note": ""}, user="head")
    first = (base / "a13-record-1.json").read_bytes()
    assert call(server, "POST", f"/runs/{run_id}/a13", {"note": ""}, user="head")[0] == 422
    assert not (base / "a13-record-2.json").exists()
    assert call(server, "POST", f"/runs/{run_id}/a13", {"note": "đã sửa"}, user="head")[0] == 303
    assert (base / "a13-record-1.json").read_bytes() == first
    assert json.loads((base / "a13-record-2.json").read_text("utf-8"))["note"] == "đã sửa"


def test_no_signature_on_a_run_that_made_no_draft(server):
    run_id = make_run(server, inputs())
    assert call(server, "POST", f"/runs/{run_id}/a13", {"note": ""}, user="head")[0] == 409
    assert not list(folder(server, run_id).glob("a13-record-*"))


def test_unknown_run_cannot_be_signed(server):
    assert call(server, "POST", "/runs/20260101T000000/a13", {"note": ""}, user="head")[0] == 409
    assert call(server, "POST", "/runs/../a13", {"note": ""}, user="head")[0] == 404


def test_server_refuses_to_start_without_users(tmp_path):
    args = argparse.Namespace(
        users_file=str(tmp_path / "none.json"),
        documents=str(DOCS),
        workdir=str(tmp_path / "r"),
        port=0,
        provider=None,
        model=None,
        manifest=None,
    )
    with pytest.raises(AccountError):
        webapp.make_server(args)
    assert webapp.serve(args) == 15


def test_name_variants_share_one_lockout_counter(server):
    variants = [HEAD, HEAD + " ", HEAD.upper(), unicodedata.normalize("NFD", HEAD)]
    for name in variants:
        call(server, "POST", "/login", {"name": name, "password": "wrong"}, user=None)
    call(server, "POST", "/login", {"name": HEAD, "password": "wrong"}, user=None)
    right = call(server, "POST", "/login", {"name": HEAD, "password": "battery staple"}, user=None)
    assert right[0] == 401


def test_removing_an_account_ends_its_open_session(server):
    assert call(server, "GET", "/", user="head")[0] == 200
    server[1].store.remove(HEAD)
    assert call(server, "GET", "/", user="head")[0] == 303
    assert call(server, "POST", "/run", signed(), user="head")[0] == 401


def test_damaged_accounts_file_ends_every_session(server):
    server[1].store.path.write_text("damaged", encoding="utf-8")
    assert call(server, "GET", "/")[0] == 303


def test_draft_page_is_sandboxed_and_other_pages_have_no_script_policy(server):
    run_id = make_run(server)
    _, headers, _ = call(server, "GET", f"/runs/{run_id}/draft")
    assert "sandbox allow-scripts" in dict(headers)["Content-Security-Policy"]
    _, headers, _ = call(server, "GET", "/")
    assert "script-src" not in dict(headers)["Content-Security-Policy"]


def test_blocked_run_serves_no_draft_or_csv(server):
    run_id = make_run(server, inputs())
    for leaf in ("draft", "gaps.csv", "checklist.csv"):
        assert call(server, "GET", f"/runs/{run_id}/{leaf}")[0] == 404


def test_corrupt_run_record_does_not_break_the_list(server):
    good = make_run(server)
    bad = make_run(server)
    (folder(server, bad) / "run.json").write_text("{}", encoding="utf-8")
    page = call(server, "GET", "/runs")
    assert page[0] == 200 and good in page[2].decode() and bad in page[2].decode()
    assert call(server, "GET", f"/runs/{bad}")[0] == 200


def test_rejected_run_keeps_what_was_typed(server):
    fields = {**signed(), "form": "Dạng không có", "name": "Đề tài giữ lại"}
    status, _, body = call(server, "POST", "/run", fields)
    assert status == 400 and "Đề tài giữ lại" in body.decode()


def test_non_ascii_content_length_is_refused(server):
    import http.client

    httpd, _ = server
    conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=20)
    conn.putrequest("POST", "/login")
    conn.putheader("Content-Type", "application/x-www-form-urlencoded")
    conn.putheader("Content-Length", "²")
    conn.endheaders()
    assert conn.getresponse().status == 411
