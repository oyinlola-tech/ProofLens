from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from modules.claims.domain.repositories.claim_repository import ClaimRepository
from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.repositories.evidence_repository import EvidenceRepository
from modules.verification.domain.entities.verification import Verification
from modules.verification.domain.repositories.verification_repository import (
    VerificationRepository,
)
from modules.verification.domain.services.verification_engine import (
    EvidencePassage,
    ReasoningUnavailableError,
    VerificationEngine,
)
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.domain.value_objects.verification_result import VerificationResult
from shared.application.command import Command, CommandHandler
from shared.errors.application import ServiceUnavailableError
from shared.errors.domain import ClaimNotFoundError
from shared.infrastructure.logger import get_logger

logger = get_logger(__name__)


@dataclass
class VerifyClaim(Command):
    claim_id: UUID
    owner_id: UUID


@dataclass
class VerifyClaimResult:
    verification: Verification
    claim_text: str
    evidence_used: list[Evidence] = field(default_factory=list)


def _to_passages(evidence_list: list[Evidence]) -> list[EvidencePassage]:
    return [
        EvidencePassage(
            ref=str(e.id),
            content=e.content,
            document_id=e.source.document_id if e.source else None,
            page=e.source.page if e.source else None,
            section=e.source.section if e.source else None,
        )
        for e in evidence_list
    ]


@dataclass
class VerifyClaimHandler(CommandHandler[VerifyClaim]):
    def __init__(
        self,
        engine: VerificationEngine,
        claim_repository: ClaimRepository,
        evidence_repository: EvidenceRepository,
        verification_repository: VerificationRepository,
    ) -> None:
        self._engine = engine
        self._claim_repository = claim_repository
        self._evidence_repository = evidence_repository
        self._verification_repository = verification_repository

    async def handle(self, command: VerifyClaim) -> VerifyClaimResult:
        claim = await self._claim_repository.find_by_id(command.claim_id, owner_id=command.owner_id)
        if claim is None:
            raise ClaimNotFoundError(str(command.claim_id))

        claim.mark_analyzing()
        await self._claim_repository.save(claim)

        evidence_list = await self._evidence_repository.find_by_claim_id(
            command.claim_id, owner_id=command.owner_id
        )
        passages = _to_passages(evidence_list)
        evidence_ids = [e.id for e in evidence_list]
        verification = Verification.create(claim_id=command.claim_id, evidence_ids=evidence_ids)

        try:
            engine_verdict = await self._engine.evaluate(
                claim_text=claim.text.value,
                evidence=passages,
            )
        except ReasoningUnavailableError as e:
            logger.warning(
                "verification unavailable verification_id=%s claim_id=%s provider=%s kind=%s",
                verification.id, claim.id, e.provider, e.kind,
            )
            raise ServiceUnavailableError("verification reasoning") from None

        known_ids = {str(e.id) for e in evidence_list}
        references = tuple(
            r for r in engine_verdict.evidence_references if r.evidence_id in known_ids
        )
        sg = engine_verdict.source_grounded
        result = VerificationResult(
            verdict=engine_verdict.verdict,
            confidence=engine_verdict.confidence,
            reasoning=engine_verdict.reasoning,
            source_grounded_statement=sg.source_grounded_statement if sg else "",
            why_claim_does_not_match=sg.why_claim_does_not_match if sg else "",
            unsupported_parts=sg.unsupported_parts if sg else "",
            source_limitations=sg.source_limitations if sg else "",
            supported_parts=sg.supported_parts if sg else "",
            conclusion=sg.conclusion if sg else "",
            claim_analysis=engine_verdict.claim_analysis,
            findings=tuple(engine_verdict.findings),
            evidence_references=references,
            analysis=engine_verdict.analysis,
            evidence_refs=[r for r in engine_verdict.evidence_refs if r in known_ids],
        )
        verification.complete(result)

        if engine_verdict.verdict in (Verdict.SUPPORTED, Verdict.PARTIALLY_SUPPORTED):
            claim.mark_verified()
        elif engine_verdict.verdict == Verdict.CONTRADICTED:
            claim.mark_rejected()
        else:
            claim.mark_unverified()

        await self._verification_repository.save(verification)
        await self._verification_repository.save_evidence_snapshot(
            verification.id, evidence_ids
        )
        await self._claim_repository.save(claim)

        analysis = engine_verdict.analysis
        logger.info(
            "verification completed verification_id=%s claim_id=%s verdict=%s confidence=%.2f "
            "mode=%s provider=%s model=%s duration_ms=%d evidence=%d",
            verification.id, claim.id, engine_verdict.verdict.value,
            engine_verdict.confidence.value,
            analysis.mode.value if analysis else "",
            analysis.provider if analysis else "",
            analysis.model if analysis else "",
            analysis.duration_ms if analysis else 0,
            len(evidence_list),
        )

        return VerifyClaimResult(
            verification=verification,
            claim_text=claim.text.value,
            evidence_used=evidence_list,
        )
