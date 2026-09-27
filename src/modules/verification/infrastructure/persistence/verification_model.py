from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column

from shared.infrastructure.database import Base

verification_evidence = Table(
    "verification_evidence",
    Base.metadata,
    Column("verification_id", String(36), ForeignKey("verifications.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "evidence_id",
        String(36),
        ForeignKey(
            "evidence.id",
            name="verification_evidence_evidence_id_fkey",
            deferrable=True,
            initially="DEFERRED",
        ),
        primary_key=True,
    ),
)


class VerificationModel(Base):
    __tablename__ = "verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True
    )
    verdict: Mapped[str | None] = mapped_column(String(30), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_grounded_statement: Mapped[str | None] = mapped_column(Text, nullable=True)
    why_claim_does_not_match: Mapped[str | None] = mapped_column(Text, nullable=True)
    unsupported_parts: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_limitations: Mapped[str | None] = mapped_column(Text, nullable=True)
    supported_parts: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_refs: Mapped[str | None] = mapped_column(Text, nullable=True)
    conclusion: Mapped[str | None] = mapped_column(Text, nullable=True)
    claim_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_references: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
