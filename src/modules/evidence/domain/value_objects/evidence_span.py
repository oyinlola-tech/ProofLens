from __future__ import annotations

from dataclasses import dataclass

from shared.domain.value_object import ValueObject


@dataclass(frozen=True)
class EvidenceSpan(ValueObject):
    """Location of evidence within a document."""

    page_number: int
    start_offset: int
    end_offset: int

    def __post_init__(self) -> None:
        if self.page_number < 1:
            raise ValueError("Page number must be >= 1")
        if self.start_offset < 0:
            raise ValueError("Start offset must be >= 0")
        if self.end_offset <= self.start_offset:
            raise ValueError("End offset must be greater than start offset")
