from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from modules.claims.domain.entities.claim import Claim


class ClaimRepository(ABC):
    @abstractmethod
    async def save(self, claim: Claim) -> None: ...

    @abstractmethod
    async def find_by_id(self, claim_id: UUID, owner_id: UUID | None = None) -> Claim | None: ...

    @abstractmethod
    async def lock_for_verification(self, claim_id: UUID, owner_id: UUID) -> bool:
        """Lock the claim row for the rest of the transaction.

        Returns False if the claim does not exist for this owner. Raises ConflictError
        if another transaction already holds the lock.
        """

    @abstractmethod
    async def find_all(self, owner_id: UUID | None = None, offset: int = 0, limit: int = 20) -> list[Claim]: ...
