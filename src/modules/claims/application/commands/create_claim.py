from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from modules.claims.domain.entities.claim import Claim
from modules.claims.domain.repositories.claim_repository import ClaimRepository
from modules.claims.domain.value_objects.claim_text import ClaimText
from shared.application.command import Command, CommandHandler


@dataclass
class CreateClaim(Command):
    text: str
    owner_id: UUID


@dataclass
class CreateClaimHandler(CommandHandler[CreateClaim]):
    def __init__(self, repository: ClaimRepository) -> None:
        self._repository = repository

    async def handle(self, command: CreateClaim) -> Claim:
        claim_text = ClaimText(value=command.text)
        claim = Claim.create(text=claim_text, owner_id=command.owner_id)
        await self._repository.save(claim)
        return claim
