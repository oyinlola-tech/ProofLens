from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.repositories.evidence_repository import EvidenceRepository
from shared.application.query import Query, QueryHandler
from shared.errors.domain import EvidenceNotFoundError


@dataclass
class GetEvidence(Query):
    evidence_id: UUID
    owner_id: UUID


@dataclass
class GetEvidenceHandler(QueryHandler[GetEvidence]):
    def __init__(self, repository: EvidenceRepository) -> None:
        self._repository = repository

    async def handle(self, query: GetEvidence) -> Evidence:
        evidence = await self._repository.find_by_id(
            query.evidence_id, owner_id=query.owner_id
        )
        if evidence is None:
            raise EvidenceNotFoundError(str(query.evidence_id))
        return evidence
