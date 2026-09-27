from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from modules.verification.domain.entities.verification import Verification


class VerificationRepository(ABC):
    @abstractmethod
    async def save(self, verification: Verification) -> None: ...

    @abstractmethod
    async def find_by_id(self, verification_id: UUID) -> Verification | None: ...

    @abstractmethod
    async def find_by_id_with_owner(
        self, verification_id: UUID, owner_id: UUID
    ) -> Verification | None: ...

    @abstractmethod
    async def find_by_claim_id(self, claim_id: UUID) -> list[Verification]: ...

    @abstractmethod
    async def save_evidence_snapshot(self, verification_id: UUID, evidence_ids: list[UUID]) -> None: ...

    @abstractmethod
    async def find_evidence_ids(self, verification_id: UUID) -> list[UUID]: ...
