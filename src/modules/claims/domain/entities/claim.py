from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from modules.claims.domain.value_objects.claim_status import ClaimStatus
from modules.claims.domain.value_objects.claim_text import ClaimText
from shared.domain.aggregate import AggregateRoot


@dataclass
class Claim(AggregateRoot):
    owner_id: UUID = field(default_factory=uuid4)
    text: ClaimText = field(default_factory=lambda: ClaimText(value=""))
    status: ClaimStatus = field(default=ClaimStatus.PENDING)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @classmethod
    def create(cls, text: ClaimText, owner_id: UUID) -> Claim:
        return cls(
            id=uuid4(),
            owner_id=owner_id,
            text=text,
            status=ClaimStatus.PENDING,
        )

    def mark_analyzing(self) -> None:
        self.status = ClaimStatus.ANALYZING
        self.updated_at = datetime.now(UTC)

    def mark_verified(self) -> None:
        self.status = ClaimStatus.VERIFIED
        self.updated_at = datetime.now(UTC)

    def mark_rejected(self) -> None:
        self.status = ClaimStatus.REJECTED
        self.updated_at = datetime.now(UTC)

    def mark_unverified(self) -> None:
        """Verification ran but the evidence could not settle the claim either way."""
        self.status = ClaimStatus.UNVERIFIED
        self.updated_at = datetime.now(UTC)

    def mark_failed(self) -> None:
        self.status = ClaimStatus.FAILED
        self.updated_at = datetime.now(UTC)
