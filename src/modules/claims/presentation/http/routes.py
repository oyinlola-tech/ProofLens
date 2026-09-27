from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import get_claim_repository
from app.settings import settings
from modules.claims.application.commands.create_claim import CreateClaim, CreateClaimHandler
from modules.claims.application.dto.claim_dto import ClaimResponse, CreateClaimRequest
from modules.claims.application.queries.get_claim import GetClaim, GetClaimHandler
from modules.claims.domain.entities.claim import Claim
from modules.claims.domain.value_objects.claim_text import ClaimText
from shared.infrastructure.auth import CurrentUser, get_current_user
from shared.infrastructure.database import get_session

router = APIRouter(prefix="/claims")


def _create_claim_handler(
    session: AsyncSession = Depends(get_session, scope="function"),
) -> CreateClaimHandler:
    repository = get_claim_repository(session)
    return CreateClaimHandler(repository=repository)


def _get_claim_handler(
    session: AsyncSession = Depends(get_session, scope="function"),
) -> GetClaimHandler:
    repository = get_claim_repository(session)
    return GetClaimHandler(repository=repository)


def _to_response(claim: Claim) -> ClaimResponse:
    return ClaimResponse(
        id=str(claim.id),
        text=claim.text.value,
        status=claim.status.value,
        created_at=claim.created_at.isoformat(),
        updated_at=claim.updated_at.isoformat(),
    )


@router.post(
    "/",
    response_model=ClaimResponse,
    status_code=201,
    summary="Submit a claim for verification",
    description=f"Create a new claim. Max {ClaimText.MAX_LENGTH:,} characters.",
)
async def create_claim(
    request: CreateClaimRequest,
    current_user: CurrentUser = Depends(get_current_user),
    handler: CreateClaimHandler = Depends(_create_claim_handler),
) -> ClaimResponse:
    command = CreateClaim(text=request.text, owner_id=current_user.id)
    claim = await handler.handle(command)
    return _to_response(claim)


@router.get(
    "/{claim_id}",
    response_model=ClaimResponse,
    summary="Get a claim by ID",
    description="Retrieve a single claim. Returns 404 if not found or not owned by the caller.",
    responses={404: {"description": "Claim not found"}},
)
async def get_claim(
    claim_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    handler: GetClaimHandler = Depends(_get_claim_handler),
) -> ClaimResponse:
    query = GetClaim(claim_id=claim_id, owner_id=current_user.id)
    claim = await handler.handle(query)
    return _to_response(claim)


@router.get(
    "/",
    response_model=list[ClaimResponse],
    summary="List claims",
    description="Return claims owned by the current user, newest first. Supports offset/limit pagination.",
)
async def list_claims(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
    offset: int = Query(0, ge=0),
    limit: int = Query(settings.PAGINATION_DEFAULT_LIMIT, ge=1, le=settings.PAGINATION_MAX_LIMIT),
) -> list[ClaimResponse]:
    repository = get_claim_repository(session)
    claims = await repository.find_all(owner_id=current_user.id, offset=offset, limit=limit)
    return [_to_response(c) for c in claims]
