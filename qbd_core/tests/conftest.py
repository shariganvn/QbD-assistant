"""Shared fixtures."""

from __future__ import annotations

import argparse
import threading
from pathlib import Path

import pytest

from qbd_core import webapp
from qbd_core.modules.accounts.api import UserStore

DOCS = (
    Path(__file__).resolve().parents[1] / "modules/dossier_drafting/tests/fixtures/documents.json"
)


@pytest.fixture
def server(tmp_path):
    store = UserStore(tmp_path / "users.json")
    store.add("Nguyễn Văn A", "researcher", "correct horse")
    store.add("Lê Thọ Tiển", "head", "battery staple")
    args = argparse.Namespace(
        users_file=str(tmp_path / "users.json"),
        documents=str(DOCS),
        workdir=str(tmp_path / "runs"),
        port=0,
        provider=None,
        model=None,
        manifest=None,
    )
    httpd = webapp.make_server(args)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    ctx = httpd.RequestHandlerClass.ctx
    ctx.sids = {
        "researcher": ctx.login("Nguyễn Văn A", "correct horse"),
        "head": ctx.login("Lê Thọ Tiển", "battery staple"),
    }
    yield httpd, ctx
    httpd.shutdown()
    httpd.server_close()
