from uuid import uuid4

import pytest

from modules.documents.application.processing_service import (
    DocumentProcessingService,
    InMemoryDocumentParser,
)
from modules.documents.domain.document_type import DocumentType
from modules.documents.domain.processing_status import ProcessingStatus
from modules.documents.infrastructure.persistence.in_memory_document_repository import (
    InMemoryDocumentRepository,
)
from shared.errors.domain import DocumentTooLargeError

TEST_OWNER = uuid4()


def _service(max_content_length: int = 10_000_000) -> tuple[DocumentProcessingService, InMemoryDocumentRepository]:
    repo = InMemoryDocumentRepository()
    service = DocumentProcessingService(
        repository=repo, parser=InMemoryDocumentParser(), max_content_length=max_content_length
    )
    return service, repo


async def test_process_text():
    service, _ = _service()

    result = await service.process_text("test.txt", "Hello world", TEST_OWNER)

    doc = result.document
    assert doc.filename == "test.txt"
    assert doc.content == "Hello world"
    assert doc.document_type == DocumentType.TEXT
    assert doc.processing_status == ProcessingStatus.PROCESSED
    assert len(result.pages) == 1


async def test_process_text_persisted_with_pages():
    service, repo = _service()

    result = await service.process_text("report.txt", "Content here", TEST_OWNER)

    found = await repo.find_by_id(result.document.id)
    assert found is not None
    assert found.filename == "report.txt"
    pages = await repo.find_pages_by_document_id(result.document.id)
    assert [p.text for p in pages] == ["Content here"]


async def test_process_text_rejects_oversized_content():
    service, repo = _service(max_content_length=10)

    with pytest.raises(DocumentTooLargeError):
        await service.process_text("big.txt", "x" * 11, TEST_OWNER)

    assert await repo.find_all() == []


async def test_find_all_documents():
    service, repo = _service()

    await service.process_text("a.txt", "A", TEST_OWNER)
    await service.process_text("b.txt", "B", TEST_OWNER)

    all_docs = await repo.find_all()
    assert len(all_docs) == 2
