from __future__ import annotations

from dataclasses import dataclass

from shared.domain.value_object import ValueObject


@dataclass(frozen=True)
class SourceReference(ValueObject):
    """Reference to the source location of evidence in a document."""

    document_id: str
    section: str | None = None
    page: int | None = None
