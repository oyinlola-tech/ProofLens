from __future__ import annotations

from app.settings import Settings
from modules.ai.application.provider import InferenceProvider
from modules.ai.infrastructure.gemini import GeminiProvider
from modules.ai.infrastructure.ollama import OllamaProvider
from modules.ai.infrastructure.openai_compat import OpenAiCompatProvider


def build_provider(settings: Settings) -> InferenceProvider | None:
    """Build the configured inference provider, or None when AI is disabled.

    Selection is configuration only; no verification logic knows which vendor runs.
    """
    provider = settings.resolved_ai_provider()
    if provider == "gemini":
        return GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            timeout_seconds=settings.AI_TIMEOUT_SECONDS,
        )
    if provider == "nvidia":
        return OpenAiCompatProvider(
            name="nvidia",
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
            timeout_seconds=settings.AI_TIMEOUT_SECONDS,
        )
    if provider == "groq":
        return OpenAiCompatProvider(
            name="groq",
            base_url=settings.GROQ_BASE_URL,
            api_key=settings.GROQ_API_KEY,
            timeout_seconds=settings.AI_TIMEOUT_SECONDS,
        )
    if provider == "ollama":
        return OllamaProvider(
            base_url=settings.OLLAMA_BASE_URL,
            timeout_seconds=settings.AI_TIMEOUT_SECONDS,
        )
    return None
