from __future__ import annotations

from dataclasses import dataclass

from shared.domain.value_object import ValueObject
from shared.errors.domain import InvalidConfidenceError


@dataclass(frozen=True)
class Confidence(ValueObject):
    value: float

    def __post_init__(self) -> None:
        if not 0.0 <= self.value <= 1.0:
            raise InvalidConfidenceError(self.value)
