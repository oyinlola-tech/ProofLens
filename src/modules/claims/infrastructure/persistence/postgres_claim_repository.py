from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.domain.entities.claim import Claim
from modules.claims.domain.repositories.claim_repository import ClaimRepository
from modules.claims.domain.value_objects.claim_status import ClaimStatus
from modules.claims.domain.value_objects.claim_text import ClaimText
from modules.claims.infrastructure.persistence.claim_model import ClaimModel
from shared.errors.application import ConflictError

_LOCK_NOT_AVAILABLE = "55P03"


class PostgresClaimRepository(ClaimRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, claim: Claim) -> None:
        model = ClaimModel(
            id=str(claim.id),
            owner_id=str(claim.owner_id),
            text=claim.text.value,
            status=claim.status.value,
            created_at=claim.created_at,
            updated_at=claim.updated_at,
        )
        await self._session.merge(model)
        await self._session.flush()

    async def find_by_id(self, claim_id: UUID, owner_id: UUID | None = None) -> Claim | None:
        stmt = select(ClaimModel).where(ClaimModel.id == str(claim_id))
        if owner_id is not None:
            stmt = stmt.where(ClaimModel.owner_id == str(owner_id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return Claim(
            id=UUID(model.id),
            owner_id=UUID(model.owner_id),
            text=ClaimText(value=model.text),
            status=ClaimStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def lock_for_verification(self, claim_id: UUID, owner_id: UUID) -> bool:
        stmt = (
            select(ClaimModel.id)
            .where(ClaimModel.id == str(claim_id), ClaimModel.owner_id == str(owner_id))
            .with_for_update(nowait=True)
        )
        try:
            result = await self._session.execute(stmt)
        except DBAPIError as e:
            if getattr(e.orig, "sqlstate", None) == _LOCK_NOT_AVAILABLE:
                raise ConflictError("Verification already in progress for this claim") from e
            raise
        return result.scalar_one_or_none() is not None

    async def find_all(self, owner_id: UUID | None = None, offset: int = 0, limit: int = 20) -> list[Claim]:
        stmt = select(ClaimModel)
        if owner_id is not None:
            stmt = stmt.where(ClaimModel.owner_id == str(owner_id))
        stmt = stmt.order_by(ClaimModel.created_at.desc(), ClaimModel.id.desc())
        stmt = stmt.offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [
            Claim(
                id=UUID(m.id),
                owner_id=UUID(m.owner_id),
                text=ClaimText(value=m.text),
                status=ClaimStatus(m.status),
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m in models
        ]
