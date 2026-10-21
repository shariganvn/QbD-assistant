import json
from pathlib import Path

import pytest

from qbd_core.modules.egress_gate.api import (
    Destination,
    Payload,
    PayloadPart,
    try_load_manifest,
)
from qbd_core.modules.provider_access.api import (
    LLMRequest,
    ProviderFailed,
    ProviderGateway,
    ProviderRefused,
    RecordedMiss,
    RecordedProvider,
    request_digest,
)

EGRESS_FIXTURES = Path(__file__).parents[2] / "egress_gate" / "tests" / "fixtures"
MANIFEST = try_load_manifest(EGRESS_FIXTURES / "manifest.json")
TEXT = json.loads((EGRESS_FIXTURES / "texts.json").read_text(encoding="utf-8"))
MODELS = {"model-a"}


def request(source="A-APPROVED", text=None, model="model-a"):
    part = PayloadPart(kind="evidence", text=text or TEXT["safe"], source_ids=(source,))
    return LLMRequest(model=model, payload=Payload(parts=(part,)))


def provider_for(req, answer="drafted text", destination=Destination.REMOTE):
    return RecordedProvider({request_digest(req): answer}, destination)


def test_allowed_request_returns_the_recorded_answer():
    req = request()
    provider = provider_for(req)
    result = ProviderGateway(provider, MODELS, MANIFEST).call(req)
    assert result.text == "drafted text"
    assert result.request_digest == request_digest(req)
    assert provider.calls == 1


@pytest.mark.parametrize("source", ["B-BOOK", "C-INTERNAL", "Q-UNSORTED", "A-PENDING", "GHOST"])
def test_restricted_source_never_reaches_a_remote_provider(source):
    req = request(source=source)
    provider = provider_for(req)
    with pytest.raises(ProviderRefused) as caught:
        ProviderGateway(provider, MODELS, MANIFEST).call(req)
    assert caught.value.code == "E_EGRESS_BLOCKED"
    assert provider.calls == 0


def test_restricted_text_pasted_under_an_approved_source_is_refused():
    req = request(text=TEXT["secret_b"])
    provider = provider_for(req)
    with pytest.raises(ProviderRefused) as caught:
        ProviderGateway(provider, MODELS, MANIFEST).call(req)
    assert "E_RESTRICTED_TEXT" in caught.value.detail
    assert provider.calls == 0


def test_missing_manifest_refuses_a_remote_call():
    req = request()
    provider = provider_for(req)
    with pytest.raises(ProviderRefused) as caught:
        ProviderGateway(provider, MODELS, None).call(req)
    assert caught.value.detail == ("E_MANIFEST_MISSING",)
    assert provider.calls == 0


def test_unapproved_model_is_refused_before_anything_else():
    req = request(source="B-BOOK", model="other-model")
    provider = provider_for(req)
    with pytest.raises(ProviderRefused) as caught:
        ProviderGateway(provider, MODELS, MANIFEST).call(req)
    assert caught.value.code == "E_MODEL_NOT_APPROVED"
    assert provider.calls == 0


def test_local_provider_may_see_restricted_material():
    req = request(source="B-BOOK")
    provider = provider_for(req, destination=Destination.LOCAL)
    assert ProviderGateway(provider, MODELS, MANIFEST).call(req).text == "drafted text"


def test_provider_error_returns_nothing_and_keeps_the_cause():
    class Broken:
        destination = Destination.REMOTE

        def complete(self, request):
            raise TimeoutError("down")

    with pytest.raises(ProviderFailed) as caught:
        ProviderGateway(Broken(), MODELS, MANIFEST).call(request())
    assert caught.value.code == "E_PROVIDER_ERROR"
    assert isinstance(caught.value.__cause__, TimeoutError)


def test_unknown_request_in_a_recording_is_a_failure_not_an_invention():
    provider = RecordedProvider({})
    with pytest.raises(ProviderFailed) as caught:
        ProviderGateway(provider, MODELS, MANIFEST).call(request())
    assert isinstance(caught.value.__cause__, RecordedMiss)


@pytest.mark.parametrize("answer", ["", "   \n"])
def test_blank_answer_is_invalid(answer):
    req = request()
    with pytest.raises(ProviderFailed) as caught:
        ProviderGateway(provider_for(req, answer), MODELS, MANIFEST).call(req)
    assert caught.value.code == "E_RESPONSE_INVALID"


def test_runs_are_repeatable_and_digest_depends_on_content():
    req = request()
    gateway = ProviderGateway(provider_for(req), MODELS, MANIFEST)
    assert gateway.call(req) == gateway.call(req)
    assert request_digest(req) != request_digest(request(text="another sentence entirely"))
    assert request_digest(req) != request_digest(request(model="model-b"))


def test_recorded_provider_loads_from_a_file(tmp_path):
    req = request()
    path = tmp_path / "answers.json"
    path.write_text(json.dumps({request_digest(req): "from file"}), encoding="utf-8")
    provider = RecordedProvider.from_file(path)
    assert ProviderGateway(provider, MODELS, MANIFEST).call(req).text == "from file"
