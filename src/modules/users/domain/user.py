from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4


@dataclass
class User:
    id: UUID = field(default_factory=uuid4)
    email: str = ""
    password_salt: str = ""
    password_hash: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @classmethod
    def create(cls, email: str, password_salt: str, password_hash: str) -> User:
        return cls(
            id=uuid4(),
            email=email,
            password_salt=password_salt,
            password_hash=password_hash,
        )
