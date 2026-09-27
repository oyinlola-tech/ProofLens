from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from shared.domain.value_object import ValueObject


class FindingKind(StrEnum):
    NUMBER_MATCH = "number_match"
    NUMBER_MISMATCH = "number_mismatch"
    DATE_MATCH = "date_match"
    DATE_MISMATCH = "date_mismatch"
    ENTITY_MISMATCH = "entity_mismatch"
    NEGATION_CONFLICT = "negation_conflict"
    QUALIFIER_GAP = "qualifier_gap"
    EXACT_MATCH = "exact_match"
    LOW_RELEVANCE = "low_relevance"


@dataclass(frozen=True)
class DeterministicFinding(ValueObject):
    kind: FindingKind
    description: str
    claim_value: str = ""
    evidence_value: str = ""
    evidence_ref: str = ""
    conflict: bool = False
