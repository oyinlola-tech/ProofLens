from __future__ import annotations

import asyncio
from typing import Any

import httpx

from modules.ai.application.provider import AiProviderError, InferenceProvider
from modules.ai.domain.inference_result import InferenceResult
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt


class OpenAiCompatProvider(InferenceProvider):
    """Chat-completions provider for OpenAI-compatible endpoints (NVIDIA NIM, Groq)."""

    def __init__(
        self,
        name: str,
        base_url: str,
        api_key: str,
        timeout_seconds: float,
    ) -> None:
        self.name = name
        self._timeout_seconds = timeout_seconds
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=timeout_seconds,
        )

    async def complete(self, model: Model, prompt: Prompt) -> InferenceResult:
        return await self._chat(model, prompt, extra={})

    async def complete_structured(
        self, model: Model, prompt: Prompt, json_schema: dict[str, Any]
    ) -> InferenceResult:
        # Strict OpenAI-style JSON schema; NVIDIA NIM and Groq both accept it.
        extra: dict[str, Any] = {
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "response", "strict": True, "schema": json_schema},
            }
        }
        return await self._chat(model, prompt, extra=extra)

    async def _chat(self, model: Model, prompt: Prompt, extra: dict[str, Any]) -> InferenceResult:
        messages = []
        if prompt.system:
            messages.append({"role": "system", "content": prompt.system})
        messages.append({"role": "user", "content": prompt.render()})
        body = {
            "model": model.name,
            "messages": messages,
            "temperature": model.temperature,
            "max_tokens": model.max_tokens,
            **extra,
        }
        if model.reasoning_effort:
            body["reasoning_effort"] = model.reasoning_effort
        try:
            response = await asyncio.wait_for(
                self._client.post("/chat/completions", json=body),
                timeout=self._timeout_seconds + 1,
            )
            response.raise_for_status()
            payload = response.json()
        except (TimeoutError, httpx.TimeoutException) as e:
            raise AiProviderError(self.name, "timeout") from e
        except httpx.HTTPStatusError as e:
            raise AiProviderError(
                self.name, "unavailable", f"HTTP {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            raise AiProviderError(self.name, "unavailable", type(e).__name__) from e
        except ValueError as e:
            raise AiProviderError(self.name, "malformed_output", "response is not JSON") from e

        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as e:
            raise AiProviderError(self.name, "malformed_output", "unexpected response shape") from e

        usage = payload.get("usage") or {}
        return InferenceResult(
            content=content,
            model=model.name,
            usage={
                "prompt_tokens": int(usage.get("prompt_tokens") or 0),
                "completion_tokens": int(usage.get("completion_tokens") or 0),
                "total_tokens": int(usage.get("total_tokens") or 0),
            },
        )

    async def close(self) -> None:
        await self._client.aclose()
