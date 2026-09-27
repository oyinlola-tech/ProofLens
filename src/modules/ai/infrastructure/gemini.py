from __future__ import annotations

import asyncio
import copy
from typing import Any

from modules.ai.application.provider import AiProviderError, InferenceProvider
from modules.ai.domain.inference_result import InferenceResult
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt

_UNSUPPORTED_SCHEMA_KEYS = {"additionalProperties", "maxLength", "minLength", "pattern", "$schema"}
_THINKING_LEVELS = {"low": "LOW", "medium": "MEDIUM", "high": "HIGH"}


def gemini_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Strip JSON Schema keywords the Gemini structured-output subset rejects."""

    def walk(node: Any) -> Any:
        if isinstance(node, list):
            return [walk(x) for x in node]
        if not isinstance(node, dict):
            return node
        return {k: walk(v) for k, v in node.items() if k not in _UNSUPPORTED_SCHEMA_KEYS}

    cleaned: dict[str, Any] = walk(copy.deepcopy(schema))
    return cleaned


class GeminiProvider(InferenceProvider):
    """Google Gemini via the google-genai SDK, with native structured output."""

    name = "gemini"

    def __init__(self, api_key: str, timeout_seconds: float) -> None:
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from google import genai

            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def complete(self, model: Model, prompt: Prompt) -> InferenceResult:
        return await self._generate(model, prompt, json_schema=None)

    async def complete_structured(
        self, model: Model, prompt: Prompt, json_schema: dict[str, Any]
    ) -> InferenceResult:
        return await self._generate(model, prompt, json_schema=json_schema)

    def _config(self, model: Model, json_schema: dict[str, Any] | None) -> Any:
        from google.genai import types as genai_types

        kwargs: dict[str, Any] = {
            "temperature": model.temperature,
            "max_output_tokens": model.max_tokens,
        }
        if json_schema is not None:
            kwargs["response_mime_type"] = "application/json"
            kwargs["response_json_schema"] = gemini_schema(json_schema)
        level = _THINKING_LEVELS.get(model.reasoning_effort)
        if level is not None and hasattr(genai_types, "ThinkingConfig"):
            try:
                kwargs["thinking_config"] = genai_types.ThinkingConfig(
                    thinking_level=genai_types.ThinkingLevel(level)
                )
            except (TypeError, ValueError, AttributeError):
                pass
        return genai_types.GenerateContentConfig(**kwargs)

    async def _generate(
        self, model: Model, prompt: Prompt, json_schema: dict[str, Any] | None
    ) -> InferenceResult:
        from google.genai import errors as genai_errors

        config = self._config(model, json_schema)
        config.system_instruction = prompt.system

        try:
            response = await asyncio.wait_for(
                self._get_client().aio.models.generate_content(
                    model=model.name, contents=prompt.render(), config=config
                ),
                timeout=self._timeout_seconds,
            )
        except TimeoutError as e:
            raise AiProviderError(self.name, "timeout") from e
        except genai_errors.APIError as e:
            raise AiProviderError(self.name, "unavailable", f"HTTP {e.code}") from e
        except Exception as e:
            raise AiProviderError(self.name, "unavailable", type(e).__name__) from e

        content = getattr(response, "text", None)
        if not content:
            raise AiProviderError(self.name, "malformed_output", "empty response")

        usage = getattr(response, "usage_metadata", None)
        return InferenceResult(
            content=content,
            model=model.name,
            usage={
                "prompt_tokens": int(getattr(usage, "prompt_token_count", 0) or 0),
                "completion_tokens": int(getattr(usage, "candidates_token_count", 0) or 0),
                "total_tokens": int(getattr(usage, "total_token_count", 0) or 0),
            },
        )

    async def close(self) -> None:
        client = self._client
        self._client = None
        if client is None:
            return
        aio = getattr(client, "aio", None)
        aclose = getattr(aio, "aclose", None)
        if callable(aclose):
            try:
                await aclose()
            except Exception:
                pass

