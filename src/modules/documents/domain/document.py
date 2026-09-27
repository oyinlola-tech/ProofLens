from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from modules.documents.domain.document_type import DocumentType
from modules.documents.domain.processing_status import ProcessingStatus
from shared.domain.aggregate import AggregateRoot


@dataclass
class Document(AggregateRoot):
    owner_id: UUID = field(default_factory=uuid4)
    filename: str = ""
    document_type: DocumentType = DocumentType.UNKNOWN
    content: str = ""
    metadata: dict[str, str] = field(default_factory=dict)
    processing_status: ProcessingStatus = ProcessingStatus.UPLOADED
    processing_error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @classmethod
    def create(
        cls,
        filename: str,
        owner_id: UUID,
        document_type: DocumentType = DocumentType.UNKNOWN,
        content: str = "",
    ) -> Document:
        return cls(
            id=uuid4(),
            owner_id=owner_id,
            filename=filename,
            document_type=document_type,
            content=content,
        )

    def mark_processing(self) -> None:
        self.processing_status = ProcessingStatus.PROCESSING

    def mark_processed(self) -> None:
        self.processing_status = ProcessingStatus.PROCESSED
        self.processing_error = None

    def mark_failed(self, error: str) -> None:
        self.processing_status = ProcessingStatus.FAILED
        self.processing_error = error
