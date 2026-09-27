from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from shared.domain.value_object import ValueObject


class ReferenceRole(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    CONTEXT = "context"


@dataclass(frozen=True)
class EvidenceReference(ValueObject):
    evidence_id: str
    document_id: str | None = None
    page: int | None = None
    quote: str = ""
    role: ReferenceRole = ReferenceRole.CONTEXT
