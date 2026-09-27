from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from modules.ai.domain.inference_result import InferenceResult
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt


class AiProviderError(Exception):
    """A provider call failed (network, auth, timeout, or unusable output).

    The message must stay safe to log: no API keys, no raw SDK payloads.
    """

    def __init__(self, provider: str, kind: str, detail: str = "") -> None:
        self.provider = provider
        self.kind = kind  # "timeout" | "unavailable" | "malformed_output" | "error"
        super().__init__(f"{provider} provider {kind}" + (f": {detail}" if detail else ""))


class InferenceProvider(ABC):
    """Vendor-neutral inference interface.

    Verification logic depends on this contract only; swapping Gemini, NVIDIA NIM,
    Groq or Ollama is a configuration change, never a business-logic change.
    """

    name: str = "unknown"

    @abstractmethod
    async def complete(self, model: Model, prompt: Prompt) -> InferenceResult: ...

    @abstractmethod
    async def complete_structured(
        self, model: Model, prompt: Prompt, json_schema: dict[str, Any]
    ) -> InferenceResult:
        """Return a completion constrained to `json_schema` where the vendor supports it.

        The result's content is the raw JSON text; callers must still validate it.
        """

    async def close(self) -> None:  # pragma: no cover - trivial default
        return None
