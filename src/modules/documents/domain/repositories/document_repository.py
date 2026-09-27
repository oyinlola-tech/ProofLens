from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from modules.documents.domain.document import Document
from modules.documents.domain.document_page import DocumentPage


class DocumentRepository(ABC):
    @abstractmethod
    async def save(self, document: Document) -> None: ...

    @abstractmethod
    async def find_by_id(self, document_id: UUID, owner_id: UUID | None = None) -> Document | None: ...

    @abstractmethod
    async def find_all(self, owner_id: UUID | None = None, offset: int = 0, limit: int = 20) -> list[Document]: ...

    @abstractmethod
    async def save_pages(self, pages: list[DocumentPage]) -> None: ...

    @abstractmethod
    async def find_pages_by_document_id(self, document_id: UUID) -> list[DocumentPage]: ...

    @abstractmethod
    async def delete_pages_by_document_id(self, document_id: UUID) -> None: ...
