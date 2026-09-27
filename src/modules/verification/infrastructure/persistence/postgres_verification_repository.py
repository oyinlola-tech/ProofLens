from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.infrastructure.persistence.claim_model import ClaimModel
from modules.verification.domain.entities.verification import Verification
from modules.verification.domain.repositories.verification_repository import (
    VerificationRepository,
)
from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.domain.value_objects.verification_result import VerificationResult
from modules.verification.infrastructure.persistence.serialization import (
    dumps,
    load_analysis,
    load_claim_analysis,
    load_findings,
    load_references,
)
from modules.verification.infrastructure.persistence.verification_model import (
    VerificationModel,
    verification_evidence,
)


class PostgresVerificationRepository(VerificationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, verification: Verification) -> None:
        r = verification.result
        model = VerificationModel(
            id=str(verification.id),
            claim_id=str(verification.claim_id),
            verdict=r.verdict.value if r else None,
            confidence=r.confidence.value if r else None,
            reasoning=r.reasoning if r else None,
            source_grounded_statement=r.source_grounded_statement if r else None,
            why_claim_does_not_match=r.why_claim_does_not_match if r else None,
            unsupported_parts=r.unsupported_parts if r else None,
            source_limitations=r.source_limitations if r else None,
            supported_parts=r.supported_parts if r else None,
            conclusion=r.conclusion if r else None,
            evidence_refs=json.dumps(r.evidence_refs) if r and r.evidence_refs else None,
            claim_analysis=dumps(r.claim_analysis) if r else None,
            findings=dumps(list(r.findings)) if r else None,
            evidence_references=dumps(list(r.evidence_references)) if r else None,
            analysis=dumps(r.analysis) if r else None,
            created_at=verification.created_at,
            completed_at=verification.completed_at,
        )
        await self._session.merge(model)
        await self._session.flush()

    async def save_evidence_snapshot(self, verification_id: UUID, evidence_ids: list[UUID]) -> None:
        await self._session.execute(
            delete(verification_evidence).where(
                verification_evidence.c.verification_id == str(verification_id)
            )
        )
        for eid in evidence_ids:
            await self._session.execute(
                verification_evidence.insert().values(
                    verification_id=str(verification_id),
                    evidence_id=str(eid),
                )
            )
        await self._session.flush()

    async def find_evidence_ids(self, verification_id: UUID) -> list[UUID]:
        result = await self._session.execute(
            select(verification_evidence.c.evidence_id).where(
                verification_evidence.c.verification_id == str(verification_id)
            )
        )
        return [UUID(row[0]) for row in result.all()]

    async def find_by_id(self, verification_id: UUID) -> Verification | None:
        result = await self._session.execute(
            select(VerificationModel).where(VerificationModel.id == str(verification_id))
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None

        evidence_ids = await self.find_evidence_ids(verification_id)

        return self._to_domain(model, evidence_ids)

    async def find_by_id_with_owner(
        self, verification_id: UUID, owner_id: UUID
    ) -> Verification | None:
        stmt = (
            select(VerificationModel)
            .join(ClaimModel, VerificationModel.claim_id == ClaimModel.id)
            .where(
                VerificationModel.id == str(verification_id),
                ClaimModel.owner_id == str(owner_id),
            )
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None

        evidence_ids = await self.find_evidence_ids(verification_id)
        return self._to_domain(model, evidence_ids)

    async def find_by_claim_id(self, claim_id: UUID) -> list[Verification]:
        result = await self._session.execute(
            select(VerificationModel).where(VerificationModel.claim_id == str(claim_id))
        )
        models = result.scalars().all()
        verifications = []
        for m in models:
            evidence_ids = await self.find_evidence_ids(UUID(m.id))
            verifications.append(self._to_domain(m, evidence_ids))
        return verifications

    def _to_domain(self, model: VerificationModel, evidence_ids: list[UUID] | None = None) -> Verification:
        result = None
        if model.verdict is not None and model.confidence is not None:
            refs = []
            if model.evidence_refs:
                try:
                    refs = json.loads(model.evidence_refs)
                except (json.JSONDecodeError, TypeError):
                    refs = []

            result = VerificationResult(
                verdict=Verdict(model.verdict),
                confidence=Confidence(value=model.confidence),
                reasoning=model.reasoning or "",
                source_grounded_statement=model.source_grounded_statement or "",
                why_claim_does_not_match=model.why_claim_does_not_match or "",
                unsupported_parts=model.unsupported_parts or "",
                source_limitations=model.source_limitations or "",
                supported_parts=model.supported_parts or "",
                conclusion=model.conclusion or "",
                claim_analysis=load_claim_analysis(model.claim_analysis),
                findings=load_findings(model.findings),
                evidence_references=load_references(model.evidence_references),
                analysis=load_analysis(model.analysis),
                evidence_refs=refs,
            )

        return Verification(
            id=UUID(model.id),
            claim_id=UUID(model.claim_id),
            evidence_ids=evidence_ids or [],
            result=result,
            created_at=model.created_at,
            completed_at=model.completed_at,
        )
