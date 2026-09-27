from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.infrastructure.persistence.claim_model import ClaimModel
from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.repositories.evidence_repository import EvidenceRepository
from modules.evidence.domain.value_objects.evidence_span import EvidenceSpan
from modules.evidence.domain.value_objects.source_reference import SourceReference
from modules.evidence.infrastructure.persistence.evidence_model import EvidenceModel
from modules.verification.infrastructure.persistence.verification_model import (
    verification_evidence,
)


class PostgresEvidenceRepository(EvidenceRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, evidence: Evidence) -> None:
        model = EvidenceModel(
            id=str(evidence.id),
            claim_id=str(evidence.claim_id),
            content=evidence.content,
            source_document_id=evidence.source.document_id if evidence.source else None,
            source_section=evidence.source.section if evidence.source else None,
            source_page=evidence.source.page if evidence.source else None,
            span_page_number=evidence.span.page_number if evidence.span else None,
            span_start_offset=evidence.span.start_offset if evidence.span else None,
            span_end_offset=evidence.span.end_offset if evidence.span else None,
            created_at=evidence.created_at,
        )
        await self._session.merge(model)
        await self._session.flush()

    async def find_by_id(
        self, evidence_id: UUID, *, owner_id: UUID | None = None
    ) -> Evidence | None:
        stmt = (
            select(EvidenceModel)
            .join(ClaimModel, EvidenceModel.claim_id == ClaimModel.id)
            .where(EvidenceModel.id == str(evidence_id))
        )
        if owner_id is not None:
            stmt = stmt.where(ClaimModel.owner_id == str(owner_id))

        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    async def find_by_claim_id(
        self, claim_id: UUID, *, owner_id: UUID | None = None
    ) -> list[Evidence]:
        stmt = select(EvidenceModel).where(EvidenceModel.claim_id == str(claim_id))
        stmt = self._scope_to_owner(stmt, owner_id).order_by(EvidenceModel.created_at)
        result = await self._session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def find_by_ids(
        self, evidence_ids: list[UUID], *, owner_id: UUID | None = None
    ) -> list[Evidence]:
        if not evidence_ids:
            return []
        str_ids = [str(eid) for eid in evidence_ids]
        stmt = select(EvidenceModel).where(EvidenceModel.id.in_(str_ids))
        stmt = self._scope_to_owner(stmt, owner_id).order_by(EvidenceModel.created_at)
        result = await self._session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    @staticmethod
    def _scope_to_owner(stmt: Select[Any], owner_id: UUID | None) -> Select[Any]:
        if owner_id is None:
            return stmt
        return stmt.join(ClaimModel, EvidenceModel.claim_id == ClaimModel.id).where(
            ClaimModel.owner_id == str(owner_id)
        )

    async def is_used_in_verification(self, evidence_id: UUID) -> bool:
        result = await self._session.execute(
            select(func.count(verification_evidence.c.evidence_id)).where(
                verification_evidence.c.evidence_id == str(evidence_id)
            )
        )
        return result.scalar_one() > 0

    def _to_domain(self, model: EvidenceModel) -> Evidence:
        span = None
        if (
            model.span_page_number is not None
            and model.span_start_offset is not None
            and model.span_end_offset is not None
        ):
            span = EvidenceSpan(
                page_number=model.span_page_number,
                start_offset=model.span_start_offset,
                end_offset=model.span_end_offset,
            )

        source = None
        if model.source_document_id is not None:
            source = SourceReference(
                document_id=model.source_document_id,
                section=model.source_section,
                page=model.source_page,
            )

        return Evidence(
            id=UUID(model.id),
            claim_id=UUID(model.claim_id),
            content=model.content,
            span=span,
            source=source,
            created_at=model.created_at,
        )
