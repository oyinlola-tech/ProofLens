from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from shared.domain.value_object import ValueObject


class AnalysisMode(StrEnum):
    AI = "ai"
    DETERMINISTIC = "deterministic"


@dataclass(frozen=True)
class AnalysisMetadata(ValueObject):
    mode: AnalysisMode
    provider: str = ""
    model: str = ""
    duration_ms: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    failure: str = ""
