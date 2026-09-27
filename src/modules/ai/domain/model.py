from __future__ import annotations

from dataclasses import dataclass

from shared.domain.value_object import ValueObject


@dataclass(frozen=True)
class Model(ValueObject):
    name: str
    provider: str = ""
    temperature: float = 0.0
    max_tokens: int = 2048
    reasoning_effort: str = ""
