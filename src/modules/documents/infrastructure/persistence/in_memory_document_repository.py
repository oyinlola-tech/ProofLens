from __future__ import annotations

from uuid import UUID

from modules.documents.domain.document import Document
from modules.documents.domain.document_page import DocumentPage
from modules.documents.domain.repositories.document_repository import DocumentRepository


class InMemoryDocumentRepository(DocumentRepository):
    def __init__(self) -> None:
        self._documents: dict[UUID, Document] = {}
        self._pages: dict[UUID, list[DocumentPage]] = {}

    async def save(self, document: Document) -> None:
        self._documents[document.id] = document

    async def find_by_id(self, document_id: UUID, owner_id: UUID | None = None) -> Document | None:
        doc = self._documents.get(document_id)
        if doc is None:
            return None
        if owner_id is not None and doc.owner_id != owner_id:
            return None
        return doc

    async def find_all(self, owner_id: UUID | None = None, offset: int = 0, limit: int = 20) -> list[Document]:
        docs = list(self._documents.values())
        if owner_id is not None:
            docs = [d for d in docs if d.owner_id == owner_id]
        return docs[offset : offset + limit]

    async def save_pages(self, pages: list[DocumentPage]) -> None:
        for page in pages:
            doc_pages = self._pages.setdefault(page.document_id, [])
            doc_pages.append(page)

    async def find_pages_by_document_id(self, document_id: UUID) -> list[DocumentPage]:
        pages = self._pages.get(document_id, [])
        return sorted(pages, key=lambda p: p.page_number)

    async def delete_pages_by_document_id(self, document_id: UUID) -> None:
        self._pages.pop(document_id, None)
