from __future__ import annotations

import asyncio
from typing import Any

import httpx

from modules.ai.application.provider import AiProviderError, InferenceProvider
from modules.ai.domain.inference_result import InferenceResult
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt


class OllamaProvider(InferenceProvider):
    """Local models via Ollama, so development needs no hosted AI provider."""

    name = "ollama"

    def __init__(self, base_url: str, timeout_seconds: float) -> None:
        self._timeout_seconds = timeout_seconds
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout_seconds)

    async def complete(self, model: Model, prompt: Prompt) -> InferenceResult:
        return await self._chat(model, prompt, json_schema=None)

    async def complete_structured(
        self, model: Model, prompt: Prompt, json_schema: dict[str, Any]
    ) -> InferenceResult:
        return await self._chat(model, prompt, json_schema=json_schema)

    async def _chat(
        self, model: Model, prompt: Prompt, json_schema: dict[str, Any] | None
    ) -> InferenceResult:
        messages = []
        if prompt.system:
            messages.append({"role": "system", "content": prompt.system})
        messages.append({"role": "user", "content": prompt.render()})
        body: dict[str, Any] = {
            "model": model.name,
            "messages": messages,
            "stream": False,
            "options": {"temperature": model.temperature, "num_predict": model.max_tokens},
        }
        if json_schema is not None:
            body["format"] = json_schema
        if model.reasoning_effort:
            body["think"] = model.reasoning_effort != "low"

        try:
            response = await asyncio.wait_for(
                self._client.post("/api/chat", json=body),
                timeout=self._timeout_seconds + 1,
            )
            response.raise_for_status()
            payload = response.json()
            content = payload["message"]["content"]
        except (TimeoutError, httpx.TimeoutException) as e:
            raise AiProviderError(self.name, "timeout") from e
        except httpx.HTTPStatusError as e:
            raise AiProviderError(self.name, "unavailable", f"HTTP {e.response.status_code}") from e
        except httpx.HTTPError as e:
            raise AiProviderError(self.name, "unavailable", type(e).__name__) from e
        except (KeyError, TypeError, ValueError) as e:
            raise AiProviderError(self.name, "malformed_output", "unexpected response shape") from e

        return InferenceResult(
            content=content,
            model=model.name,
            usage={
                "prompt_tokens": int(payload.get("prompt_eval_count") or 0),
                "completion_tokens": int(payload.get("eval_count") or 0),
                "total_tokens": int(payload.get("prompt_eval_count") or 0)
                + int(payload.get("eval_count") or 0),
            },
        )

    async def close(self) -> None:
        await self._client.aclose()
