from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from modules.claims.domain.entities.claim import Claim
from modules.claims.domain.repositories.claim_repository import ClaimRepository
from shared.application.query import Query, QueryHandler
from shared.errors.domain import ClaimNotFoundError


@dataclass
class GetClaim(Query):
    claim_id: UUID
    owner_id: UUID


@dataclass
class GetClaimHandler(QueryHandler[GetClaim]):
    def __init__(self, repository: ClaimRepository) -> None:
        self._repository = repository

    async def handle(self, query: GetClaim) -> Claim:
        claim = await self._repository.find_by_id(query.claim_id, owner_id=query.owner_id)
        if claim is None:
            raise ClaimNotFoundError(str(query.claim_id))
        return claim
