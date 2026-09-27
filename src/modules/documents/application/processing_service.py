from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from modules.documents.domain.document import Document
from modules.documents.domain.document_page import DocumentPage
from modules.documents.domain.document_type import DocumentType
from modules.documents.domain.repositories.document_repository import DocumentRepository
from modules.documents.infrastructure.parsers import DocumentParser, ParsedDocument
from shared.errors.domain import (
    DocumentProcessingError,
    DocumentTooLargeError,
    InvalidDocumentError,
)


@dataclass
class UploadDocument:
    filename: str
    content: bytes
    owner_id: UUID


@dataclass
class UploadDocumentResult:
    document: Document
    pages: list[DocumentPage]


class DocumentProcessingService:
    def __init__(
        self,
        repository: DocumentRepository,
        parser: DocumentParser,
        max_content_length: int = 10_000_000,
    ) -> None:
        self._repository = repository
        self._parser = parser
        self._max_content_length = max_content_length

    async def process_upload(self, command: UploadDocument) -> UploadDocumentResult:
        filename = command.filename
        document_type = self._detect_type(filename)

        if document_type == DocumentType.PDF:
            return await self._process_pdf(command, filename)
        elif document_type == DocumentType.TEXT:
            try:
                text = command.content.decode("utf-8")
            except UnicodeDecodeError as e:
                raise DocumentProcessingError("File encoding is not valid UTF-8") from e
            return await self.process_text(filename, text, command.owner_id)
        else:
            raise InvalidDocumentError(
                f"Unsupported file type for '{filename}'. "
                "Supported types: PDF, text."
            )

    async def _process_pdf(
        self, command: UploadDocument, filename: str
    ) -> UploadDocumentResult:
        document = Document.create(
            filename=filename,
            owner_id=command.owner_id,
            document_type=DocumentType.PDF,
        )
        document.mark_processing()
        await self._repository.save(document)

        try:
            parsed: ParsedDocument = await self._parser.parse_bytes(command.content)
            if len(parsed.content) > self._max_content_length:
                raise DocumentTooLargeError(len(parsed.content), self._max_content_length)
            pages = self._build_pages(document.id, parsed)

            document.content = parsed.content
            document.metadata = parsed.metadata
            document.mark_processed()

            await self._repository.save(document)
            await self._repository.save_pages(pages)

            return UploadDocumentResult(document=document, pages=pages)
        except DocumentTooLargeError as e:
            document.mark_failed(str(e))
            await self._repository.save(document)
            raise
        except TimeoutError as e:
            document.mark_failed("PDF parsing timed out")
            await self._repository.save(document)
            raise DocumentProcessingError("PDF parsing timed out") from e
        except ValueError as e:
            document.mark_failed(str(e))
            await self._repository.save(document)
            raise DocumentProcessingError(str(e)) from e
        except DocumentProcessingError:
            raise
        except Exception as e:
            document.mark_failed("Internal extraction error")
            await self._repository.save(document)
            raise DocumentProcessingError("Internal extraction error") from e

    async def process_text(
        self, filename: str, text: str, owner_id: UUID
    ) -> UploadDocumentResult:
        """Store a plain-text document as a single page."""
        if len(text) > self._max_content_length:
            raise DocumentTooLargeError(len(text), self._max_content_length)

        document = Document.create(
            filename=filename,
            owner_id=owner_id,
            document_type=DocumentType.TEXT,
            content=text,
        )
        document.mark_processing()
        await self._repository.save(document)

        pages = [
            DocumentPage.create(
                document_id=document.id,
                page_number=1,
                text=text,
                char_offset=0,
            )
        ]

        document.mark_processed()
        await self._repository.save(document)
        await self._repository.save_pages(pages)

        return UploadDocumentResult(document=document, pages=pages)

    def _detect_type(self, filename: str) -> DocumentType:
        lower = filename.lower()
        if lower.endswith(".pdf"):
            return DocumentType.PDF
        if lower.endswith((".txt", ".text", ".md", ".csv", ".log")):
            return DocumentType.TEXT
        return DocumentType.UNKNOWN

    def _build_pages(self, document_id: UUID, parsed: ParsedDocument) -> list[DocumentPage]:
        pages: list[DocumentPage] = []
        for ep in parsed.pages:
            page = DocumentPage.create(
                document_id=document_id,
                page_number=ep.page_number,
                text=ep.text,
                char_offset=ep.char_offset,
            )
            pages.append(page)
        return pages


class InMemoryDocumentParser:
    def __init__(self, parsed_result: ParsedDocument | None = None) -> None:
        self._parsed = parsed_result or ParsedDocument()

    async def parse_bytes(self, data: bytes) -> ParsedDocument:
        return self._parsed
