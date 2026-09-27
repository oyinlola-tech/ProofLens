from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from shared.domain.value_object import ValueObject


class AssertionStrength(StrEnum):
    HEDGED = "hedged"
    MODERATE = "moderate"
    ABSOLUTE = "absolute"


@dataclass(frozen=True)
class ClaimAnalysis(ValueObject):
    subject: str = ""
    proposition: str = ""
    assertion_strength: AssertionStrength = AssertionStrength.MODERATE
    causal: bool = False
    quantitative: bool = False
    negated: bool = False
    entities: tuple[str, ...] = ()
    numbers: tuple[str, ...] = ()
    dates: tuple[str, ...] = ()
