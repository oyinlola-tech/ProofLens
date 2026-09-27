from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.settings import Settings
from modules.ai.application.provider import AiProviderError
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt
from modules.ai.infrastructure.factory import build_provider
from modules.ai.infrastructure.gemini import GeminiProvider, gemini_schema
from modules.ai.infrastructure.ollama import OllamaProvider
from modules.ai.infrastructure.openai_compat import OpenAiCompatProvider

SCHEMA = {"type": "object", "properties": {"a": {"type": "string", "maxLength": 3}}, "required": ["a"], "additionalProperties": False}
PROMPT = Prompt(system="sys", template="user {x}", variables={"x": "text"})
MODEL = Model(name="m", provider="p", temperature=0.0, max_tokens=50, reasoning_effort="low")


def _settings(**kw: Any) -> Settings:
    return Settings(_env_file=None, **kw)


def test_factory_selects_provider_from_configuration():
    assert build_provider(_settings(AI_PROVIDER="none", GEMINI_API_KEY="k")) is None
    assert build_provider(_settings()) is None
    assert build_provider(_settings(GEMINI_API_KEY="k")).name == "gemini"
    assert build_provider(_settings(NVIDIA_API_KEY="k")).name == "nvidia"
    assert build_provider(_settings(GROQ_API_KEY="k")).name == "groq"
    assert build_provider(_settings(AI_PROVIDER="ollama")).name == "ollama"
    assert build_provider(_settings(AI_PROVIDER="groq", GROQ_API_KEY="g", GEMINI_API_KEY="k")).name == "groq"


def test_model_resolution_and_validation():
    s = _settings(GEMINI_API_KEY="k")
    assert s.resolved_ai_provider() == "gemini"
    assert s.resolved_ai_model() == "gemini-3.8-flash"
    assert _settings(GEMINI_API_KEY="k", AI_MODEL="custom").resolved_ai_model() == "custom"
    assert _settings(AI_PROVIDER="ollama", OLLAMA_MODEL="llama3.1").resolved_ai_model() == "llama3.1"
    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        _settings(AI_PROVIDER="gemini")
    with pytest.raises(ValueError):
        _settings(AI_REASONING_EFFORT="max")


def _openai_provider(handler, name="groq") -> OpenAiCompatProvider:
    provider = OpenAiCompatProvider(name=name, base_url="https://x.test/v1", api_key="sk-secret", timeout_seconds=2)
    provider._client = httpx.AsyncClient(base_url="https://x.test/v1", transport=httpx.MockTransport(handler), headers={"Authorization": "Bearer sk-secret"})
    return provider


async def test_groq_uses_strict_json_schema_and_reasoning_effort():
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        seen["auth"] = request.headers["Authorization"]
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"a": "b"}'}}], "usage": {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5}})

    result = await _openai_provider(handler).complete_structured(MODEL, PROMPT, SCHEMA)
    assert result.content == '{"a": "b"}'
    assert result.usage == {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5}
    body = seen["body"]
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["strict"] is True
    assert body["response_format"]["json_schema"]["schema"] == SCHEMA
    assert body["reasoning_effort"] == "low"
    assert body["messages"][0] == {"role": "system", "content": "sys"}
    assert body["messages"][1] == {"role": "user", "content": "user text"}
    assert seen["auth"] == "Bearer sk-secret"


async def test_nvidia_uses_strict_json_schema():
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    await _openai_provider(handler, name="nvidia").complete_structured(MODEL, PROMPT, SCHEMA)
    assert seen["body"]["response_format"]["json_schema"]["schema"] == SCHEMA
    assert "nvext" not in seen["body"]


@pytest.mark.parametrize(
    "response,kind",
    [
        (httpx.Response(503, text="upstream down sk-secret"), "unavailable"),
        (httpx.Response(401, text="bad key"), "unavailable"),
        (httpx.Response(200, text="not json"), "malformed_output"),
        (httpx.Response(200, json={"choices": []}), "malformed_output"),
    ],
)
async def test_openai_compat_errors_are_classified_and_safe(response: httpx.Response, kind: str):
    provider = _openai_provider(lambda request: response)
    with pytest.raises(AiProviderError) as exc:
        await provider.complete_structured(MODEL, PROMPT, SCHEMA)
    assert exc.value.kind == kind
    assert exc.value.provider == "groq"
    assert "sk-secret" not in str(exc.value)


async def test_openai_compat_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    with pytest.raises(AiProviderError) as exc:
        await _openai_provider(handler).complete_structured(MODEL, PROMPT, SCHEMA)
    assert exc.value.kind == "timeout"


async def test_ollama_sends_format_schema_and_think():
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"message": {"content": '{"a": "b"}'}, "prompt_eval_count": 4, "eval_count": 6})

    provider = OllamaProvider(base_url="http://ollama.test", timeout_seconds=2)
    provider._client = httpx.AsyncClient(base_url="http://ollama.test", transport=httpx.MockTransport(handler))
    result = await provider.complete_structured(MODEL, PROMPT, SCHEMA)
    assert seen["path"] == "/api/chat"
    assert seen["body"]["format"] == SCHEMA
    assert seen["body"]["think"] is False
    assert seen["body"]["options"] == {"temperature": 0.0, "num_predict": 50}
    assert result.usage["total_tokens"] == 10


async def test_ollama_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    provider = OllamaProvider(base_url="http://ollama.test", timeout_seconds=2)
    provider._client = httpx.AsyncClient(base_url="http://ollama.test", transport=httpx.MockTransport(handler))
    with pytest.raises(AiProviderError) as exc:
        await provider.complete(MODEL, PROMPT)
    assert exc.value.kind == "unavailable"


def test_gemini_schema_strips_unsupported_keywords():
    cleaned = gemini_schema({"type": "object", "additionalProperties": False, "properties": {"a": {"type": "string", "maxLength": 3, "enum": ["x"]}}, "required": ["a"]})
    assert cleaned == {"type": "object", "properties": {"a": {"type": "string", "enum": ["x"]}}, "required": ["a"]}


class _FakeResponse:
    def __init__(self, text: str) -> None:
        self.text = text
        self.usage_metadata = type("U", (), {"prompt_token_count": 7, "candidates_token_count": 2, "total_token_count": 9})()


class _FakeModels:
    def __init__(self, outcome: Any) -> None:
        self.outcome = outcome
        self.calls: list[dict[str, Any]] = []

    async def generate_content(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


class _FakeClient:
    def __init__(self, outcome: Any) -> None:
        self.aio = type("Aio", (), {})()
        self.aio.models = _FakeModels(outcome)


async def test_gemini_structured_call_uses_native_json_schema():
    provider = GeminiProvider(api_key="AIza-secret", timeout_seconds=2)
    client = _FakeClient(_FakeResponse('{"a": "b"}'))
    provider._client = client
    result = await provider.complete_structured(MODEL, PROMPT, SCHEMA)
    assert result.content == '{"a": "b"}'
    assert result.usage == {"prompt_tokens": 7, "completion_tokens": 2, "total_tokens": 9}
    [call] = client.aio.models.calls
    assert call["model"] == "m"
    assert call["contents"] == "user text"
    config = call["config"]
    assert config.system_instruction == "sys"
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema == gemini_schema(SCHEMA)
    assert config.max_output_tokens == 50


async def test_gemini_errors_are_classified_without_leaking():
    from google.genai import errors as genai_errors

    provider = GeminiProvider(api_key="AIza-secret", timeout_seconds=2)
    provider._client = _FakeClient(genai_errors.APIError(503, {"error": {"message": "key AIza-secret invalid"}}))
    with pytest.raises(AiProviderError) as exc:
        await provider.complete_structured(MODEL, PROMPT, SCHEMA)
    assert exc.value.kind == "unavailable"
    assert "AIza-secret" not in str(exc.value)

    provider._client = _FakeClient(_FakeResponse(""))
    with pytest.raises(AiProviderError) as exc:
        await provider.complete(MODEL, PROMPT)
    assert exc.value.kind == "malformed_output"


async def test_gemini_timeout(monkeypatch: pytest.MonkeyPatch):
    import asyncio

    class Slow(_FakeModels):
        async def generate_content(self, **kwargs: Any) -> Any:
            await asyncio.sleep(1)

    provider = GeminiProvider(api_key="k", timeout_seconds=0.01)
    client = _FakeClient(None)
    client.aio.models = Slow(None)
    provider._client = client
    with pytest.raises(AiProviderError) as exc:
        await provider.complete(MODEL, PROMPT)
    assert exc.value.kind == "timeout"
