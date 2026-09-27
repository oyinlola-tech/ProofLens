"""Live check of the configured AI provider against real verification requests.

    python -m scripts.check_ai                  # configured model + fallbacks
    python -m scripts.check_ai model-a model-b  # specific models on the same provider

Uses the API key from .env; prints only model names and outcomes, never the key.
"""

from __future__ import annotations

import asyncio
import sys
import time

from app.settings import settings
from modules.ai.domain.model import Model
from modules.ai.infrastructure.factory import build_provider
from modules.verification.domain.services.verification_engine import (
    EvidencePassage,
    ReasoningUnavailableError,
)
from modules.verification.infrastructure.llm.llm_engine import LlmVerificationEngine
from modules.verification.infrastructure.rules.rule_based_engine import (
    RuleBasedVerificationEngine,
)

CLAIM = "The trial showed the drug cut hospital admissions by about a third."
EVIDENCE = [
    EvidencePassage(
        content=(
            "In the 2024 trial of 1,200 patients, hospital admissions fell from 18% in the "
            "placebo group to 12% in the treatment group."
        ),
        ref="ev-1",
        document_id="doc-1",
        page=4,
    )
]


async def check(model_name: str) -> bool:
    provider = build_provider(settings)
    if provider is None:
        print("No AI provider configured: set an API key in .env")
        return False
    engine = LlmVerificationEngine(
        provider=provider,
        model=Model(
            name=model_name,
            provider=provider.name,
            temperature=settings.AI_TEMPERATURE,
            max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
            reasoning_effort=settings.AI_REASONING_EFFORT,
        ),
        fallback=RuleBasedVerificationEngine(),
        max_passages=settings.AI_MAX_EVIDENCE_PASSAGES,
        max_prompt_tokens=settings.AI_MAX_PROMPT_TOKENS,
    )
    started = time.monotonic()
    try:
        result = await engine.evaluate(CLAIM, EVIDENCE)
    except ReasoningUnavailableError as e:
        ok, outcome = False, f"FAIL {e.kind}"
    else:
        meta = result.analysis
        ok = meta is not None and meta.mode.value == "ai"
        outcome = f"OK   {result.verdict.value}" if ok else f"FAIL {meta.failure if meta else '?'}"
    finally:
        await provider.close()
    print(f"{provider.name:7} {model_name:45} {outcome:28} {time.monotonic() - started:5.1f}s")
    return ok


async def main(models: list[str]) -> int:
    if not models:
        models = [settings.resolved_ai_model(), *settings.resolved_ai_fallback_models()]
    results = [await check(m) for m in models if m]
    return 0 if results and all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
