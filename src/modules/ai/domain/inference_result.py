from __future__ import annotations

from dataclasses import dataclass, field

from shared.domain.value_object import ValueObject


@dataclass(frozen=True)
class InferenceResult(ValueObject):
    content: str
    model: str
    usage: dict[str, int] = field(default_factory=dict)
    raw_response: dict[str, object] | None = None
