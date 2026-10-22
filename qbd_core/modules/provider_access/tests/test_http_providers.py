"""OpenAI and Gemini behind the same gateway: same refusals, same fail-closed behaviour."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from qbd_core.modules.egress_gate.api import Payload, PayloadPart, try_load_manifest
from qbd_core.modules.provider_access import http_provider
from qbd_core.modules.provider_access.api import (
    LLMRequest,
    ProviderFailed,
    ProviderGateway,
    ProviderRefused,
    ProviderSetupError,
    build_provider,
    load_config,
)

MODEL = "approved-model"
KEY = "secret-key-123"
MANIFEST = Path(__file__).parents[2] / "egress_gate/tests/fixtures/manifest.json"

GOOD = {
    "openai": {"choices": [{"finish_reason": "stop", "message": {"content": "xin chào"}}]},
    "gemini": {
        "candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "xin chào"}]}}]
    },
}
CUT = {
    "openai": {"choices": [{"finish_reason": "length", "message": {"content": "cắt"}}]},
    "gemini": {
        "candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "cắt"}]}}]
    },
}


class Server:
    def __init__(self, status=200, body=None):
        outer = self
        self.seen: list[dict] = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                size = int(self.headers["content-length"])
                outer.seen.append(
                    {"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()},
                     "body": json.loads(self.rfile.read(size))}
                )  # fmt: skip
                self.send_response(status)
                self.end_headers()
                self.wfile.write(body if isinstance(body, bytes) else json.dumps(body).encode())

            def log_message(self, *args):
                pass

        self.httpd = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def base(self):
        return f"http://127.0.0.1:{self.httpd.server_port}"

    def close(self):
        self.httpd.shutdown()


def config(name, base, models=(MODEL,)):
    shipped = load_config(name)
    path = "/v1/chat/completions" if name == "openai" else "/models/{model}:generateContent"
    values = {**shipped.__dict__, "enabled": True, "approved_models": tuple(models)}
    values["endpoint"] = base + path
    values["timeout_seconds"] = 5.0
    from qbd_core.modules.provider_access.api import ProviderConfig

    return ProviderConfig(**values)


def gateway(name, cfg):
    manifest = try_load_manifest(MANIFEST)
    assert manifest is not None
    provider = build_provider(name, cfg, {cfg.api_key_env: KEY})
    return ProviderGateway(provider, {MODEL}, manifest)


def request(model=MODEL, source="A-APPROVED"):
    parts = (
        PayloadPart(kind="instruction", text="hãy viết ngắn"),
        PayloadPart(kind="evidence", text="câu hỏi", source_ids=(source,)),
    )
    return LLMRequest(model=model, payload=Payload(parts=parts))


NAMES = ["openai", "gemini"]


@pytest.mark.parametrize("name", NAMES)
def test_shipped_config_is_off_with_no_approved_model(name):
    cfg = load_config(name)
    assert cfg.enabled is False and cfg.approved_models == ()
    with pytest.raises(ProviderSetupError):
        build_provider(name, cfg, {cfg.api_key_env: KEY})


@pytest.mark.parametrize("name", NAMES)
def test_answer_and_request_shape(name):
    server = Server(body=GOOD[name])
    try:
        result = gateway(name, config(name, server.base())).call(request())
    finally:
        server.close()
    assert result.text == "xin chào"
    sent = server.seen[0]
    assert "hãy viết ngắn" in json.dumps(sent["body"], ensure_ascii=False)
    if name == "gemini":
        assert sent["path"] == f"/models/{MODEL}:generateContent"
        assert sent["headers"]["x-goog-api-key"] == KEY and KEY not in sent["path"]
    else:
        assert sent["headers"]["authorization"] == f"Bearer {KEY}"
        assert sent["body"]["model"] == MODEL


@pytest.mark.parametrize("name", NAMES)
@pytest.mark.parametrize("kind", ["status", "json", "empty", "cut"])
def test_bad_answers_fail_closed_and_hide_the_key(name, kind):
    status, body = {
        "status": (500, {"error": "x"}),
        "json": (200, b"not json"),
        "empty": (200, {}),
        "cut": (200, CUT[name]),
    }[kind]
    server = Server(status, body)
    try:
        with pytest.raises(ProviderFailed) as failed:
            gateway(name, config(name, server.base())).call(request())
    finally:
        server.close()
    error, chain = failed.value, []
    while error is not None:
        chain.append(repr(error) + str(error))
        error = error.__cause__
    assert not any(KEY in text for text in chain)


@pytest.mark.parametrize("name", NAMES)
def test_refusals_send_nothing(name):
    server = Server(body=GOOD[name])
    try:
        gate = gateway(name, config(name, server.base()))
        with pytest.raises(ProviderRefused) as unapproved:
            gate.call(request(model="other"))
        with pytest.raises(ProviderRefused) as restricted:
            gate.call(request(source="B-BOOK"))
        with pytest.raises(ProviderRefused) as unknown:
            gate.call(request(source="NOPE"))
    finally:
        server.close()
    assert unapproved.value.code == "E_MODEL_NOT_APPROVED"
    assert restricted.value.code == unknown.value.code == "E_EGRESS_BLOCKED"
    assert server.seen == []


def test_gemini_model_with_odd_characters_never_reaches_the_address():
    server = Server(body=GOOD["gemini"])
    bad = "m/../../x"
    try:
        cfg = config("gemini", server.base(), models=(bad,))
        gate = ProviderGateway(
            build_provider("gemini", cfg, {cfg.api_key_env: KEY}),
            {bad},
            try_load_manifest(MANIFEST),
        )
        with pytest.raises(ProviderFailed):
            gate.call(request(model=bad))
    finally:
        server.close()
    assert server.seen == []


def test_unknown_vendor_is_a_setup_error():
    with pytest.raises(ProviderSetupError):
        build_provider("perplexity", load_config(), {})


@pytest.mark.parametrize("name", NAMES)
def test_a_redirect_never_reaches_the_second_host(name):
    second = Server(body=GOOD[name])
    first = Server(302, {})
    original = first.httpd.RequestHandlerClass.send_response

    def with_location(self, code, message=None):
        original(self, code, message)
        self.send_header("Location", second.base() + "/elsewhere")

    first.httpd.RequestHandlerClass.send_response = with_location
    try:
        with pytest.raises(ProviderFailed):
            gateway(name, config(name, first.base())).call(request())
    finally:
        first.close()
        second.close()
    assert second.seen == []


def test_gemini_thought_parts_are_left_out():
    body = {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": "nghĩ", "thought": True}, {"text": "kết quả"}]},
            }
        ]
    }
    server = Server(body=body)
    try:
        result = gateway("gemini", config("gemini", server.base())).call(request())
    finally:
        server.close()
    assert result.text == "kết quả"


def _vendor(name, **changes):
    base = {
        "enabled": False, "approved_models": ["m"], "api_key_env": "K", "max_tokens": 10,
        "timeout_seconds": 5, "endpoint": f"https://{http_provider.VENDOR_HOSTS[name]}/v1/x",
    }  # fmt: skip
    return {**base, **changes}


@pytest.mark.parametrize(
    "changes",
    [
        {"endpoint": "https://evil.example.com/v1/x"},
        {"endpoint": "http://api.anthropic.com/v1/x"},
        {"endpoint": "https://user:pw@api.anthropic.com/v1/x"},
        {"endpoint": "https://api.anthropic.com/v1/x?key=1"},
        {"endpoint": "https://api.anthropic.com:8443/v1/x"},
        {"endpoint": None},
        {"approved_models": "abc"},
        {"approved_models": [""]},
        {"timeout_seconds": None},
        {"timeout_seconds": 0},
        {"max_tokens": True},
        {"enabled": "false"},
    ],
)
def test_bad_vendor_entries_are_refused(changes):
    with pytest.raises((ValueError, KeyError, TypeError, AttributeError)):
        http_provider._check("anthropic", _vendor("anthropic", **changes))


@pytest.mark.parametrize("name", ["anthropic", *NAMES])
def test_a_well_formed_vendor_entry_passes(name):
    http_provider._check(name, _vendor(name))
