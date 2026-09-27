from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from shared.domain.entity import Entity


@dataclass
class DocumentPage(Entity):
    document_id: UUID = field(default_factory=uuid4)
    page_number: int = 0
    text: str = ""
    char_offset: int = 0
    char_length: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @classmethod
    def create(
        cls,
        document_id: UUID,
        page_number: int,
        text: str,
        char_offset: int = 0,
    ) -> DocumentPage:
        return cls(
            id=uuid4(),
            document_id=document_id,
            page_number=page_number,
            text=text,
            char_offset=char_offset,
            char_length=len(text),
        )
