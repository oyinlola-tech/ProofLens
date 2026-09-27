from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.repositories.evidence_repository import EvidenceRepository
from modules.evidence.domain.value_objects.source_reference import SourceReference
from shared.application.command import Command, CommandHandler


@dataclass
class ExtractEvidence(Command):
    claim_id: UUID
    content: str
    document_id: str
    source: SourceReference | None = None


@dataclass
class ExtractEvidenceHandler(CommandHandler[ExtractEvidence]):
    def __init__(self, repository: EvidenceRepository) -> None:
        self._repository = repository

    async def handle(self, command: ExtractEvidence) -> Evidence:
        source = command.source
        if source is None:
            source = SourceReference(document_id=command.document_id)

        evidence = Evidence.create(
            claim_id=command.claim_id,
            content=command.content,
            source=source,
        )
        await self._repository.save(evidence)
        return evidence
