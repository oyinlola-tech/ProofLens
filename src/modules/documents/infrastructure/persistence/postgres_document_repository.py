from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.documents.domain.document import Document
from modules.documents.domain.document_page import DocumentPage
from modules.documents.domain.document_type import DocumentType
from modules.documents.domain.processing_status import ProcessingStatus
from modules.documents.domain.repositories.document_repository import DocumentRepository
from modules.documents.infrastructure.persistence.document_model import DocumentModel
from modules.documents.infrastructure.persistence.document_page_model import DocumentPageModel


class PostgresDocumentRepository(DocumentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, document: Document) -> None:
        model = DocumentModel(
            id=str(document.id),
            owner_id=str(document.owner_id),
            filename=document.filename,
            document_type=document.document_type.value,
            content=document.content,
            metadata_json=json.dumps(document.metadata) if document.metadata else None,
            processing_status=document.processing_status.value,
            processing_error=document.processing_error,
            created_at=document.created_at,
        )
        await self._session.merge(model)
        await self._session.flush()

    async def find_by_id(self, document_id: UUID, owner_id: UUID | None = None) -> Document | None:
        stmt = select(DocumentModel).where(DocumentModel.id == str(document_id))
        if owner_id is not None:
            stmt = stmt.where(DocumentModel.owner_id == str(owner_id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    async def find_all(self, owner_id: UUID | None = None, offset: int = 0, limit: int = 20) -> list[Document]:
        stmt = select(DocumentModel)
        if owner_id is not None:
            stmt = stmt.where(DocumentModel.owner_id == str(owner_id))
        stmt = stmt.order_by(DocumentModel.created_at.desc(), DocumentModel.id.desc())
        stmt = stmt.offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [self._to_domain(m) for m in models]

    async def save_pages(self, pages: list[DocumentPage]) -> None:
        for page in pages:
            model = DocumentPageModel(
                id=str(page.id),
                document_id=str(page.document_id),
                page_number=page.page_number,
                text=page.text,
                char_offset=page.char_offset,
                char_length=page.char_length,
                created_at=page.created_at,
            )
            self._session.add(model)
        await self._session.flush()

    async def find_pages_by_document_id(self, document_id: UUID) -> list[DocumentPage]:
        stmt = (
            select(DocumentPageModel)
            .where(DocumentPageModel.document_id == str(document_id))
            .order_by(DocumentPageModel.page_number)
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [self._page_to_domain(m) for m in models]

    async def delete_pages_by_document_id(self, document_id: UUID) -> None:
        stmt = delete(DocumentPageModel).where(
            DocumentPageModel.document_id == str(document_id)
        )
        await self._session.execute(stmt)
        await self._session.flush()

    def _to_domain(self, model: DocumentModel) -> Document:
        return Document(
            id=UUID(model.id),
            owner_id=UUID(model.owner_id),
            filename=model.filename,
            document_type=DocumentType(model.document_type),
            content=model.content,
            metadata=json.loads(model.metadata_json) if model.metadata_json else {},
            processing_status=ProcessingStatus(model.processing_status),
            processing_error=model.processing_error,
            created_at=model.created_at,
        )

    def _page_to_domain(self, model: DocumentPageModel) -> DocumentPage:
        return DocumentPage(
            id=UUID(model.id),
            document_id=UUID(model.document_id),
            page_number=model.page_number,
            text=model.text,
            char_offset=model.char_offset,
            char_length=model.char_length,
            created_at=model.created_at,
        )
