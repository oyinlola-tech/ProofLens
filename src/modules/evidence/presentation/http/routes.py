from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import get_claim_repository, get_document_repository, get_evidence_repository
from app.settings import settings
from modules.evidence.application.commands.extract_evidence import (
    ExtractEvidence,
    ExtractEvidenceHandler,
)
from modules.evidence.application.queries.get_evidence import GetEvidence, GetEvidenceHandler
from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.value_objects.source_reference import SourceReference
from modules.evidence.infrastructure.persistence.evidence_model import EvidenceModel
from shared.errors.domain import ClaimNotFoundError, DocumentNotFoundError
from shared.infrastructure.auth import CurrentUser, get_current_user
from shared.infrastructure.database import get_session

router = APIRouter(prefix="/evidence")


def _extract_handler(
    session: AsyncSession = Depends(get_session, scope="function"),
) -> ExtractEvidenceHandler:
    repository = get_evidence_repository(session)
    return ExtractEvidenceHandler(repository=repository)


def _get_handler(
    session: AsyncSession = Depends(get_session, scope="function"),
) -> GetEvidenceHandler:
    repository = get_evidence_repository(session)
    return GetEvidenceHandler(repository=repository)


class ExtractEvidenceRequest(BaseModel):
    claim_id: UUID
    content: str = Field(..., min_length=1, max_length=settings.EVIDENCE_MAX_LENGTH)
    document_id: UUID
    section: str | None = Field(None, max_length=settings.SECTION_MAX_LENGTH)
    page: int | None = Field(None, ge=1)


class EvidenceResponse(BaseModel):
    id: str
    claim_id: str
    content: str
    source_document_id: str | None = None
    source_section: str | None = None
    source_page: int | None = None
    created_at: str


def _to_response(evidence: Evidence) -> EvidenceResponse:
    return EvidenceResponse(
        id=str(evidence.id),
        claim_id=str(evidence.claim_id),
        content=evidence.content,
        source_document_id=evidence.source.document_id if evidence.source else None,
        source_section=evidence.source.section if evidence.source else None,
        source_page=evidence.source.page if evidence.source else None,
        created_at=evidence.created_at.isoformat(),
    )


@router.post(
    "/",
    response_model=EvidenceResponse,
    status_code=201,
    summary="Add evidence to a claim",
    description="Attach an evidence passage to an existing claim. The claim and document must belong to the caller.",
    responses={404: {"description": "Claim or document not found"}},
)
async def extract_evidence(
    request: ExtractEvidenceRequest,
    current_user: CurrentUser = Depends(get_current_user),
    handler: ExtractEvidenceHandler = Depends(_extract_handler),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> EvidenceResponse:
    claim_repo = get_claim_repository(session)
    claim = await claim_repo.find_by_id(request.claim_id, owner_id=current_user.id)
    if claim is None:
        raise ClaimNotFoundError(str(request.claim_id))

    doc_repo = get_document_repository(session)
    document = await doc_repo.find_by_id(request.document_id, owner_id=current_user.id)
    if document is None:
        raise DocumentNotFoundError(str(request.document_id))

    source = SourceReference(
        document_id=str(request.document_id),
        section=request.section,
        page=request.page,
    )
    command = ExtractEvidence(
        claim_id=request.claim_id,
        content=request.content,
        document_id=str(request.document_id),
        source=source,
    )
    evidence = await handler.handle(command)
    return _to_response(evidence)


@router.get(
    "/",
    response_model=list[EvidenceResponse],
    summary="List evidence for a claim",
    description="Return every evidence entry attached to a claim owned by the caller, oldest first.",
    responses={404: {"description": "Claim not found"}},
)
async def list_evidence(
    claim_id: UUID = Query(..., description="Claim whose evidence to list"),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> list[EvidenceResponse]:
    claim_repo = get_claim_repository(session)
    claim = await claim_repo.find_by_id(claim_id, owner_id=current_user.id)
    if claim is None:
        raise ClaimNotFoundError(str(claim_id))

    evidence_repo = get_evidence_repository(session)
    items = await evidence_repo.find_by_claim_id(claim_id, owner_id=current_user.id)
    return [_to_response(e) for e in items]


@router.get(
    "/{evidence_id}",
    response_model=EvidenceResponse,
    summary="Get evidence by ID",
    description="Retrieve a single evidence entry. Returns 404 if not found or not owned by the caller.",
    responses={404: {"description": "Evidence not found"}},
)
async def get_evidence(
    evidence_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetEvidenceHandler = Depends(_get_handler),
) -> EvidenceResponse:
    query = GetEvidence(evidence_id=evidence_id, owner_id=current_user.id)
    evidence = await handler.handle(query)
    return _to_response(evidence)


@router.delete(
    "/{evidence_id}",
    status_code=204,
    summary="Delete evidence",
    description="Remove evidence that has not been used in any verification. Returns 409 if linked to a verification.",
    responses={404: {"description": "Evidence not found"}, 409: {"description": "Evidence is used in a verification"}},
)
async def delete_evidence(
    evidence_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> None:
    evidence_repo = get_evidence_repository(session)
    evidence = await evidence_repo.find_by_id(evidence_id, owner_id=current_user.id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")

    in_use = HTTPException(
        status_code=409,
        detail="Evidence is used in a verification and cannot be deleted",
    )
    if await evidence_repo.is_used_in_verification(evidence_id):
        raise in_use

    # The foreign key also refuses the delete, which covers a verification that
    # snapshots this evidence between the check above and the delete below.
    try:
        async with session.begin_nested():
            await session.execute(delete(EvidenceModel).where(EvidenceModel.id == str(evidence_id)))
            # The constraint is deferred to commit; check it now so the conflict becomes a 409.
            await session.execute(text("SET CONSTRAINTS verification_evidence_evidence_id_fkey IMMEDIATE"))
    except IntegrityError:
        raise in_use from None
