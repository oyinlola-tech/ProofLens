from __future__ import annotations

from dataclasses import dataclass, fields


@dataclass(frozen=True)
class ValueObject:
    """Base class for immutable value objects.

    Equality is determined by attribute values, not identity.
    """

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return all(
            getattr(self, f.name) == getattr(other, f.name) for f in fields(self)
        )

    def __hash__(self) -> int:
        return hash(
            tuple(getattr(self, f.name) for f in fields(self))
        )
