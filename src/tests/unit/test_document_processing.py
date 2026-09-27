from __future__ import annotations

import os
import tempfile
from uuid import uuid4

import pytest

from modules.documents.application.processing_service import (
    DocumentProcessingService,
    InMemoryDocumentParser,
    UploadDocument,
)
from modules.documents.domain.document_type import DocumentType
from modules.documents.domain.processing_status import ProcessingStatus
from modules.documents.infrastructure.parsers import ExtractedPage, ParsedDocument
from modules.documents.infrastructure.parsers.pdf_parser import PdfParser
from modules.documents.infrastructure.persistence.in_memory_document_repository import (
    InMemoryDocumentRepository,
)
from shared.errors.domain import InvalidDocumentError
from tests.fixtures.pdf_helpers import (
    create_multi_page_pdf,
    create_single_page_pdf,
    create_text_file_bytes,
)


def _make_service(parser: InMemoryDocumentParser | None = None) -> tuple[DocumentProcessingService, InMemoryDocumentRepository]:
    repo = InMemoryDocumentRepository()
    if parser is None:
        parser = InMemoryDocumentParser()
    service = DocumentProcessingService(repository=repo, parser=parser)
    return service, repo


class TestPdfParser:
    def test_parse_single_page_pdf(self) -> None:
        data = create_single_page_pdf("Title", "Body text here.")
        parser = PdfParser()
        result = parser.parse_bytes(data)
        assert result.total_pages == 1
        assert "Title" in result.pages[0].text
        assert "Body text here." in result.pages[0].text
        assert result.pages[0].page_number == 1

    def test_parse_multi_page_pdf(self) -> None:
        data = create_multi_page_pdf()
        parser = PdfParser()
        result = parser.parse_bytes(data)
        assert result.total_pages == 3
        assert result.pages[0].page_number == 1
        assert result.pages[1].page_number == 2
        assert result.pages[2].page_number == 3
        assert "Introduction" in result.pages[0].text
        assert "Evidence" in result.pages[1].text
        assert "Conclusion" in result.pages[2].text

    def test_page_ordering_preserved(self) -> None:
        pages = [
            {"title": "Page One", "body": "First page content."},
            {"title": "Page Two", "body": "Second page content."},
        ]
        data = create_multi_page_pdf(pages)
        parser = PdfParser()
        result = parser.parse_bytes(data)
        assert result.pages[0].page_number < result.pages[1].page_number
        assert "First page" in result.pages[0].text
        assert "Second page" in result.pages[1].text

    def test_metadata_extracted(self) -> None:
        data = create_single_page_pdf("My Title")
        parser = PdfParser()
        result = parser.parse_bytes(data)
        assert result.metadata.get("title") == "My Title"

    def test_invalid_pdf_rejected(self) -> None:
        parser = PdfParser()
        with pytest.raises(ValueError, match="not a valid PDF"):
            parser.parse_bytes(b"not a pdf file at all")

    def test_empty_file_rejected(self) -> None:
        parser = PdfParser()
        with pytest.raises(ValueError):
            parser.parse_bytes(b"")

    def test_content_concatenation(self) -> None:
        pages = [
            {"title": "A", "body": "Content A"},
            {"title": "B", "body": "Content B"},
        ]
        data = create_multi_page_pdf(pages)
        parser = PdfParser()
        result = parser.parse_bytes(data)
        assert "Content A" in result.content
        assert "Content B" in result.content

    def test_char_offsets_accumulate(self) -> None:
        pages = [
            {"title": "First", "body": "A" * 50},
            {"title": "Second", "body": "B" * 50},
        ]
        data = create_multi_page_pdf(pages)
        parser = PdfParser()
        result = parser.parse_bytes(data)
        assert result.pages[0].char_offset == 0
        assert result.pages[1].char_offset > 0

    def test_parse_file_with_real_file(self, tmp_path: object) -> None:
        data = create_single_page_pdf("File Test", "Content from file.")
        fd, path = tempfile.mkstemp(suffix=".pdf")
        try:
            os.write(fd, data)
            os.close(fd)
            parser = PdfParser()
            result = parser.parse_file(path)
            assert result.total_pages == 1
            assert "File Test" in result.pages[0].text
        finally:
            os.unlink(path)


class TestDocumentProcessingService:
    async def test_text_document_processing(self) -> None:
        service, repo = _make_service()
        owner = uuid4()
        cmd = UploadDocument(
            filename="test.txt",
            content=create_text_file_bytes("Hello from text file."),
            owner_id=owner,
        )
        result = await service.process_upload(cmd)
        assert result.document.filename == "test.txt"
        assert result.document.document_type == DocumentType.TEXT
        assert result.document.processing_status == ProcessingStatus.PROCESSED
        assert len(result.pages) == 1
        assert result.pages[0].page_number == 1
        assert "Hello from text file." in result.pages[0].text

    async def test_text_document_persisted(self) -> None:
        service, repo = _make_service()
        owner = uuid4()
        cmd = UploadDocument(
            filename="persist.txt",
            content=create_text_file_bytes("Persist this."),
            owner_id=owner,
        )
        result = await service.process_upload(cmd)
        found = await repo.find_by_id(result.document.id)
        assert found is not None
        assert found.processing_status == ProcessingStatus.PROCESSED
        pages = await repo.find_pages_by_document_id(result.document.id)
        assert len(pages) == 1

    async def test_unsupported_file_type_rejected(self) -> None:
        service, _ = _make_service()
        owner = uuid4()
        cmd = UploadDocument(
            filename="image.png",
            content=b"\x89PNG\r\n\x1a\n",
            owner_id=owner,
        )
        with pytest.raises(InvalidDocumentError, match="Unsupported file type"):
            await service.process_upload(cmd)

    async def test_empty_text_file_accepted(self) -> None:
        service, _ = _make_service()
        owner = uuid4()
        cmd = UploadDocument(
            filename="empty.txt",
            content=b"",
            owner_id=owner,
        )
        result = await service.process_upload(cmd)
        assert result.document.processing_status == ProcessingStatus.PROCESSED

    async def test_unicode_text_file(self) -> None:
        service, _ = _make_service()
        owner = uuid4()
        cmd = UploadDocument(
            filename="unicode.txt",
            content="日本語テスト内容".encode(),
            owner_id=owner,
        )
        result = await service.process_upload(cmd)
        assert "日本語テスト内容" in result.document.content

    async def test_processing_status_updates_correctly(self) -> None:
        service, _ = _make_service()
        owner = uuid4()
        cmd = UploadDocument(
            filename="status.txt",
            content=create_text_file_bytes("Status test."),
            owner_id=owner,
        )
        result = await service.process_upload(cmd)
        assert result.document.processing_status == ProcessingStatus.PROCESSED
        assert result.document.processing_error is None

    async def test_file_extension_detection(self) -> None:
        service, _ = _make_service()
        assert service._detect_type("file.pdf") == DocumentType.PDF
        assert service._detect_type("file.txt") == DocumentType.TEXT
        assert service._detect_type("file.md") == DocumentType.TEXT
        assert service._detect_type("file.xyz") == DocumentType.UNKNOWN
        assert service._detect_type("FILE.PDF") == DocumentType.PDF


class TestInMemoryDocumentParser:
    async def test_returns_empty_by_default(self) -> None:
        parser = InMemoryDocumentParser()
        result = await parser.parse_bytes(b"")
        assert result.total_pages == 0
        assert result.content == ""

    async def test_returns_custom_result(self) -> None:
        custom = ParsedDocument(
            pages=[ExtractedPage(page_number=1, text="custom", char_offset=0)],
            metadata={"key": "val"},
        )
        parser = InMemoryDocumentParser(custom)
        result = await parser.parse_bytes(b"")
        assert result.total_pages == 1
        assert result.pages[0].text == "custom"
