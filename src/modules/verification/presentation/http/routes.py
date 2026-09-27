from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import (
    get_claim_repository,
    get_evidence_repository,
    get_verification_engine,
    get_verification_repository,
)
from app.settings import settings
from modules.claims.infrastructure.persistence.claim_model import ClaimModel
from modules.evidence.domain.entities.evidence import Evidence
from modules.verification.application.commands.verify_claim import (
    VerifyClaim,
    VerifyClaimHandler,
)
from modules.verification.domain.entities.verification import Verification
from modules.verification.infrastructure.persistence.verification_model import (
    VerificationModel,
    verification_evidence,
)
from shared.errors.domain import ClaimNotFoundError, VerificationNotFoundError
from shared.infrastructure.auth import CurrentUser, get_current_user
from shared.infrastructure.database import get_session

router = APIRouter(prefix="/verification")


def _verify_handler(
    session: AsyncSession = Depends(get_session, scope="function"),
) -> VerifyClaimHandler:
    claim_repo = get_claim_repository(session)
    evidence_repo = get_evidence_repository(session)
    verification_repo = get_verification_repository(session)
    engine = get_verification_engine()
    return VerifyClaimHandler(
        engine=engine,
        claim_repository=claim_repo,
        evidence_repository=evidence_repo,
        verification_repository=verification_repo,
    )


class VerifyClaimRequest(BaseModel):
    claim_id: UUID


class EvidenceDetail(BaseModel):
    id: str
    content: str
    source_document_id: str | None = None
    source_section: str | None = None
    source_page: int | None = None


class VerificationSummary(BaseModel):
    id: str
    claim_id: str
    claim_text: str
    verdict: str | None = None
    confidence: float | None = None
    evidence_count: int
    created_at: str
    completed_at: str | None = None


class ClaimAnalysisResponse(BaseModel):
    subject: str
    proposition: str
    assertion_strength: str
    causal: bool
    quantitative: bool
    negated: bool
    entities: list[str]
    numbers: list[str]
    dates: list[str]


class FindingResponse(BaseModel):
    kind: str
    description: str
    claim_value: str
    evidence_value: str
    evidence_id: str | None = None
    conflict: bool


class EvidenceReferenceResponse(BaseModel):
    evidence_id: str
    document_id: str | None = None
    page: int | None = None
    quote: str
    role: str


class AnalysisResponse(BaseModel):
    mode: str
    provider: str
    model: str


class VerificationResponse(BaseModel):
    id: str
    claim_id: str
    claim_text: str
    verdict: str | None = None
    confidence: float | None = None
    reasoning: str | None = None
    source_grounded_statement: str | None = None
    why_claim_does_not_match: str | None = None
    unsupported_parts: str | None = None
    source_limitations: str | None = None
    supported_parts: str | None = None
    conclusion: str | None = None
    claim_analysis: ClaimAnalysisResponse | None = None
    findings: list[FindingResponse] = []
    evidence_references: list[EvidenceReferenceResponse] = []
    analysis: AnalysisResponse | None = None
    evidence_refs: list[str] = []
    evidence_used: list[EvidenceDetail] = []
    created_at: str
    completed_at: str | None = None


def _to_response(
    verification: Verification, claim_text: str, evidence: list[Evidence]
) -> VerificationResponse:
    r = verification.result
    known = {str(e.id) for e in evidence}
    analysis = r.analysis if r else None
    return VerificationResponse(
        id=str(verification.id),
        claim_id=str(verification.claim_id),
        claim_text=claim_text,
        verdict=r.verdict.value if r else None,
        confidence=r.confidence.value if r else None,
        reasoning=r.reasoning if r else None,
        source_grounded_statement=r.source_grounded_statement if r else None,
        why_claim_does_not_match=r.why_claim_does_not_match if r else None,
        unsupported_parts=r.unsupported_parts if r else None,
        source_limitations=r.source_limitations if r else None,
        supported_parts=r.supported_parts if r else None,
        conclusion=r.conclusion if r else None,
        claim_analysis=(
            ClaimAnalysisResponse(
                subject=r.claim_analysis.subject,
                proposition=r.claim_analysis.proposition,
                assertion_strength=r.claim_analysis.assertion_strength.value,
                causal=r.claim_analysis.causal,
                quantitative=r.claim_analysis.quantitative,
                negated=r.claim_analysis.negated,
                entities=list(r.claim_analysis.entities),
                numbers=list(r.claim_analysis.numbers),
                dates=list(r.claim_analysis.dates),
            )
            if r and r.claim_analysis
            else None
        ),
        findings=[
            FindingResponse(
                kind=f.kind.value,
                description=f.description,
                claim_value=f.claim_value,
                evidence_value=f.evidence_value,
                evidence_id=f.evidence_ref if f.evidence_ref in known else None,
                conflict=f.conflict,
            )
            for f in (r.findings if r else ())
        ],
        evidence_references=[
            EvidenceReferenceResponse(
                evidence_id=ref.evidence_id,
                document_id=ref.document_id,
                page=ref.page,
                quote=ref.quote,
                role=ref.role.value,
            )
            for ref in (r.evidence_references if r else ())
            if ref.evidence_id in known
        ],
        analysis=(
            AnalysisResponse(mode=analysis.mode.value, provider=analysis.provider, model=analysis.model)
            if analysis
            else None
        ),
        evidence_refs=[x for x in (r.evidence_refs if r else []) if x in known],
        evidence_used=[
            EvidenceDetail(
                id=str(e.id),
                content=e.content,
                source_document_id=e.source.document_id if e.source else None,
                source_section=e.source.section if e.source else None,
                source_page=e.source.page if e.source else None,
            )
            for e in evidence
        ],
        created_at=verification.created_at.isoformat(),
        completed_at=verification.completed_at.isoformat() if verification.completed_at else None,
    )


@router.post(
    "/",
    response_model=VerificationResponse,
    status_code=201,
    summary="Verify a claim",
    description="Verify the claim against all evidence attached to it. Returns the verdict, confidence, reasoning, source grounded explanation, and evidence used.",
    responses={
        404: {"description": "Claim not found"},
        409: {"description": "Verification already in progress"},
        503: {"description": "Reasoning provider unavailable; no verdict was produced"},
    },
)
async def verify_claim(
    request: VerifyClaimRequest,
    current_user: CurrentUser = Depends(get_current_user),
    handler: VerifyClaimHandler = Depends(_verify_handler),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> VerificationResponse:
    claim_id = request.claim_id

    claim_repo = get_claim_repository(session)
    if not await claim_repo.lock_for_verification(claim_id, current_user.id):
        raise ClaimNotFoundError(str(claim_id))

    command = VerifyClaim(claim_id=claim_id, owner_id=current_user.id)
    result = await handler.handle(command)
    return _to_response(result.verification, result.claim_text, result.evidence_used)


@router.get(
    "/",
    response_model=list[VerificationSummary],
    summary="List verifications",
    description="Return the caller's verifications, newest first.",
)
async def list_verifications(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
    claim_id: UUID | None = Query(None, description="Only verifications of this claim"),
    offset: int = Query(0, ge=0),
    limit: int = Query(settings.PAGINATION_DEFAULT_LIMIT, ge=1, le=settings.PAGINATION_MAX_LIMIT),
) -> list[VerificationSummary]:
    evidence_count = (
        select(func.count())
        .where(verification_evidence.c.verification_id == VerificationModel.id)
        .correlate(VerificationModel)
        .scalar_subquery()
    )
    stmt = (
        select(VerificationModel, ClaimModel.text, evidence_count)
        .join(ClaimModel, VerificationModel.claim_id == ClaimModel.id)
        .where(ClaimModel.owner_id == str(current_user.id))
    )
    if claim_id is not None:
        stmt = stmt.where(VerificationModel.claim_id == str(claim_id))
    stmt = stmt.order_by(VerificationModel.created_at.desc()).offset(offset).limit(limit)

    rows = (await session.execute(stmt)).all()
    return [
        VerificationSummary(
            id=m.id,
            claim_id=m.claim_id,
            claim_text=text,
            verdict=m.verdict,
            confidence=m.confidence,
            evidence_count=int(count or 0),
            created_at=m.created_at.isoformat(),
            completed_at=m.completed_at.isoformat() if m.completed_at else None,
        )
        for m, text, count in rows
    ]


@router.get(
    "/{verification_id}",
    response_model=VerificationResponse,
    summary="Get verification result",
    description="Retrieve a completed or in-progress verification, including evidence and source grounded explanation.",
    responses={404: {"description": "Verification not found"}},
)
async def get_verification(
    verification_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> VerificationResponse:
    verification_repo = get_verification_repository(session)
    claim_repo = get_claim_repository(session)
    evidence_repo = get_evidence_repository(session)

    verification = await verification_repo.find_by_id_with_owner(verification_id, current_user.id)
    if verification is None:
        raise VerificationNotFoundError(str(verification_id))

    claim = await claim_repo.find_by_id(verification.claim_id, owner_id=current_user.id)
    if claim is None:
        raise VerificationNotFoundError(str(verification_id))

    snapshot_evidence = await evidence_repo.find_by_ids(
        verification.evidence_ids, owner_id=current_user.id
    )

    return _to_response(verification, claim.text.value, snapshot_evidence)
