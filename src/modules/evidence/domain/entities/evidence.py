from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from modules.evidence.domain.value_objects.evidence_span import EvidenceSpan
from modules.evidence.domain.value_objects.source_reference import SourceReference
from shared.domain.aggregate import AggregateRoot


@dataclass
class Evidence(AggregateRoot):
    claim_id: UUID = field(default_factory=uuid4)
    content: str = ""
    span: EvidenceSpan | None = None
    source: SourceReference | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @classmethod
    def create(
        cls,
        claim_id: UUID,
        content: str,
        span: EvidenceSpan | None = None,
        source: SourceReference | None = None,
    ) -> Evidence:
        return cls(
            id=uuid4(),
            claim_id=claim_id,
            content=content,
            span=span,
            source=source,
        )
