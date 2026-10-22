import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from qbd_core.modules.egress_gate.api import Payload, PayloadPart
from qbd_core.modules.provider_access.api import (
    AnthropicProvider,
    LLMRequest,
    ProviderConfig,
    ProviderFailed,
    ProviderGateway,
    ProviderRefused,
    ProviderSetupError,
    load_config,
)


class Server:
    def __init__(self, status=200, body=None, delay=0.0):
        outer = self
        self.seen: list[dict] = []
        reply = (
            body
            if body is not None
            else {"content": [{"type": "text", "text": "xin chào"}], "stop_reason": "end_turn"}
        )

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                size = int(self.headers["content-length"])
                outer.seen.append({"headers": dict(self.headers), "body": self.rfile.read(size)})
                if delay:
                    threading.Event().wait(delay)
                self.send_response(status)
                self.end_headers()
                self.wfile.write(reply if isinstance(reply, bytes) else json.dumps(reply).encode())

            def log_message(self, *args):
                pass

        self.httpd = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.httpd.server_port}/v1/messages"

    def close(self):
        self.httpd.shutdown()


def config(url, timeout=5.0, **changes):
    base = load_config()
    values = {**base.__dict__, "endpoint": url, "timeout_seconds": timeout, "enabled": True}
    return ProviderConfig(**{**values, **changes})


def request(model="claude-sonnet-5-5", text="câu hỏi", source="A-APPROVED"):
    parts = (
        PayloadPart(kind="instruction", text="hãy viết ngắn"),
        PayloadPart(kind="evidence", text=text, source_ids=(source,)),
    )
    return LLMRequest(model=model, payload=Payload(parts=parts))


@pytest.fixture
def manifest():
    from qbd_core.modules.egress_gate.api import try_load_manifest

    path = Path(__file__).parents[2] / "egress_gate/tests/fixtures/manifest.json"
    loaded = try_load_manifest(path)
    assert loaded is not None
    return loaded


def gateway(cfg, manifest):
    provider = AnthropicProvider(cfg, {cfg.api_key_env: "test-key"})
    return ProviderGateway(provider, cfg.approved_models, manifest)


def test_shipped_config_is_off_and_names_one_model():
    cfg = load_config()
    assert cfg.enabled is False
    assert cfg.approved_models == ("claude-sonnet-5-5",)


def test_missing_key_is_a_setup_error():
    with pytest.raises(ProviderSetupError):
        AnthropicProvider(load_config(), {})


def test_answer_text_is_returned_and_request_is_well_formed(manifest):
    server = Server()
    try:
        result = gateway(config(server.url), manifest).call(request())
    finally:
        server.close()
    assert result.text == "xin chào"
    sent = server.seen[0]
    body = json.loads(sent["body"])
    assert body["model"] == "claude-sonnet-5-5" and body["system"] == "hãy viết ngắn"
    assert {k.lower(): v for k, v in sent["headers"].items()}["x-api-key"] == "test-key"


@pytest.mark.parametrize(
    ("status", "body"),
    [
        (500, {"error": "x"}),
        (200, b"not json"),
        (200, {"content": [], "stop_reason": "end_turn"}),
        (200, {"nope": 1}),
        (200, {"content": [{"type": "text", "text": "cắt"}], "stop_reason": "max_tokens"}),
        (302, {"content": []}),
    ],
)
def test_bad_answers_fail_closed(status, body, manifest):
    server = Server(status, body)
    try:
        with pytest.raises(ProviderFailed) as failed:
            gateway(config(server.url), manifest).call(request())
    finally:
        server.close()
    assert failed.value.code in {"E_PROVIDER_ERROR", "E_RESPONSE_INVALID"}


def test_timeout_fails_closed(manifest):
    server = Server(delay=1.0)
    try:
        with pytest.raises(ProviderFailed):
            gateway(config(server.url, timeout=0.2), manifest).call(request())
    finally:
        server.close()


def test_unapproved_model_is_refused_before_any_request(manifest):
    server = Server()
    try:
        with pytest.raises(ProviderRefused) as refused:
            gateway(config(server.url), manifest).call(request(model="other-model"))
    finally:
        server.close()
    assert refused.value.code == "E_MODEL_NOT_APPROVED" and server.seen == []


def test_restricted_source_never_reaches_the_server(manifest):
    restricted = "B-BOOK"
    server = Server()
    try:
        with pytest.raises(ProviderRefused) as refused:
            gateway(config(server.url), manifest).call(request(source=restricted))
    finally:
        server.close()
    assert refused.value.code == "E_EGRESS_BLOCKED" and server.seen == []


def test_no_manifest_means_nothing_is_sent():
    server = Server()
    try:
        with pytest.raises(ProviderRefused):
            gateway(config(server.url), None).call(request())
    finally:
        server.close()
    assert server.seen == []


def test_disabled_config_cannot_build_a_provider():
    with pytest.raises(ProviderSetupError):
        AnthropicProvider(load_config(), {"ANTHROPIC_API_KEY": "k"})


@pytest.mark.parametrize(
    ("parts", "code"),
    [
        ((PayloadPart(kind="evidence", text="x", source_ids=("NOPE",)),), "E_SOURCE_UNKNOWN"),
        (
            (PayloadPart(kind="evidence", text="x", source_ids=("A-PENDING",)),),
            "E_SOURCE_UNAPPROVED",
        ),
        ((PayloadPart(kind="evidence", text="x"),), "E_PART_UNATTRIBUTED"),
    ],
)
def test_other_egress_refusals_send_nothing(parts, code, manifest):
    server = Server()
    try:
        with pytest.raises(ProviderRefused) as refused:
            gateway(config(server.url), manifest).call(
                LLMRequest(model="claude-sonnet-5-5", payload=Payload(parts=parts))
            )
    finally:
        server.close()
    assert code in refused.value.detail and server.seen == []


def test_the_key_never_appears_in_a_failure(manifest):
    server = Server(500, {"error": "x"})
    try:
        with pytest.raises(ProviderFailed) as failed:
            gateway(config(server.url), manifest).call(request())
    finally:
        server.close()
    chain, error = [], failed.value
    while error is not None:
        chain.append(repr(error) + str(error))
        error = error.__cause__
    assert not any("test-key" in text for text in chain)
