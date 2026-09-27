from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from modules.verification.domain.value_objects.verification_result import VerificationResult
from shared.domain.aggregate import AggregateRoot


@dataclass
class Verification(AggregateRoot):
    claim_id: UUID = field(default_factory=uuid4)
    evidence_ids: list[UUID] = field(default_factory=list)
    result: VerificationResult | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None

    @classmethod
    def create(cls, claim_id: UUID, evidence_ids: list[UUID] | None = None) -> Verification:
        return cls(
            id=uuid4(),
            claim_id=claim_id,
            evidence_ids=evidence_ids or [],
        )

    def complete(self, result: VerificationResult) -> None:
        self.result = result
        self.completed_at = datetime.now(UTC)
