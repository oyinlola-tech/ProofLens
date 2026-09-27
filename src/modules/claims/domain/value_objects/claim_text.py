from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from shared.domain.value_object import ValueObject


@dataclass(frozen=True)
class ClaimText(ValueObject):
    """Validated claim text with length constraints."""

    MAX_LENGTH: ClassVar[int] = 10_000

    value: str

    def __post_init__(self) -> None:
        if not self.value or not self.value.strip():
            raise ValueError("Claim text cannot be empty")
        if len(self.value) > self.MAX_LENGTH:
            raise ValueError(f"Claim text exceeds maximum length of {self.MAX_LENGTH:,} characters")
