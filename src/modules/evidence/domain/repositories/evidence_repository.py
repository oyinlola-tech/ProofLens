from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from modules.evidence.domain.entities.evidence import Evidence


class EvidenceRepository(ABC):
    @abstractmethod
    async def save(self, evidence: Evidence) -> None: ...

    @abstractmethod
    async def find_by_id(
        self, evidence_id: UUID, *, owner_id: UUID | None = None
    ) -> Evidence | None: ...

    @abstractmethod
    async def find_by_claim_id(
        self, claim_id: UUID, *, owner_id: UUID | None = None
    ) -> list[Evidence]: ...

    @abstractmethod
    async def find_by_ids(
        self, evidence_ids: list[UUID], *, owner_id: UUID | None = None
    ) -> list[Evidence]: ...

    @abstractmethod
    async def is_used_in_verification(self, evidence_id: UUID) -> bool: ...
