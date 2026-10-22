"""Public entry points of the provider_access module. Other modules import only from here."""

from qbd_core.modules.provider_access.anthropic_http import AnthropicProvider
from qbd_core.modules.provider_access.errors import ProviderFailed, ProviderRefused
from qbd_core.modules.provider_access.gateway import ProviderGateway
from qbd_core.modules.provider_access.gemini_http import GeminiProvider
from qbd_core.modules.provider_access.http_provider import (
    ProviderConfig,
    ProviderSetupError,
    load_config,
)
from qbd_core.modules.provider_access.models import LLMRequest, ProviderResult
from qbd_core.modules.provider_access.openai_http import OpenAIProvider
from qbd_core.modules.provider_access.port import LLMPort
from qbd_core.modules.provider_access.recorded import (
    RecordedMiss,
    RecordedProvider,
    request_digest,
)

HTTP_PROVIDERS = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
}


def build_provider(name, config, environ):
    """The adapter for a configured vendor; unknown names are a setup error."""
    try:
        return HTTP_PROVIDERS[name](config, environ)
    except KeyError:
        raise ProviderSetupError(f"unknown provider {name}") from None


__all__ = [
    "HTTP_PROVIDERS",
    "GeminiProvider",
    "OpenAIProvider",
    "build_provider",
    "AnthropicProvider",
    "ProviderConfig",
    "ProviderSetupError",
    "load_config",
    "LLMPort",
    "LLMRequest",
    "ProviderFailed",
    "ProviderGateway",
    "ProviderRefused",
    "ProviderResult",
    "RecordedMiss",
    "RecordedProvider",
    "request_digest",
]
