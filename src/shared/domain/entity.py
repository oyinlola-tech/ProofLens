from __future__ import annotations

import uuid
from dataclasses import dataclass, field


def _default_uuid() -> uuid.UUID:
    return uuid.uuid4()


@dataclass
class Entity:
    """Base class for domain entities.

    Equality is determined by identity (id), not attribute values.
    """

    id: uuid.UUID = field(default_factory=_default_uuid)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)
