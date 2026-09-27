from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import get_document_processing_service, get_document_repository
from app.settings import settings
from modules.documents.application.processing_service import (
    DocumentProcessingService,
    UploadDocument,
)
from modules.documents.domain.document import Document
from shared.errors.domain import (
    DocumentNotFoundError,
    DocumentProcessingError,
    DocumentTooLargeError,
    InvalidDocumentError,
)
from shared.infrastructure.auth import CurrentUser, get_current_user
from shared.infrastructure.database import get_session

router = APIRouter(prefix="/documents")

PDF_MIME_TYPES = {"application/pdf"}
TEXT_MIME_TYPES = {"text/plain", "text/markdown", "text/csv"}
ALLOWED_MIME_TYPES = PDF_MIME_TYPES | TEXT_MIME_TYPES


def _processing_service(
    session: AsyncSession = Depends(get_session, scope="function"),
) -> DocumentProcessingService:
    return get_document_processing_service(session)


class ProcessDocumentRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=settings.FILENAME_MAX_LENGTH)
    content: str = Field(..., min_length=1)
    document_type: Literal["text"] = Field(
        "text", description="Inline content is always plain text; upload PDFs via /documents/upload."
    )


class DocumentResponse(BaseModel):
    id: str
    filename: str
    document_type: str
    content_length: int
    processing_status: str
    created_at: str


class DocumentPageResponse(BaseModel):
    id: str
    page_number: int
    text: str
    char_offset: int
    char_length: int


class DocumentPagesResponse(BaseModel):
    document_id: str
    total_pages: int
    pages: list[DocumentPageResponse]


def _to_response(document: Document) -> DocumentResponse:
    return DocumentResponse(
        id=str(document.id),
        filename=document.filename,
        document_type=document.document_type.value,
        content_length=len(document.content),
        processing_status=document.processing_status.value,
        created_at=document.created_at.isoformat(),
    )


@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=201,
    summary="Upload a document (text content)",
    description=(
        f"Store an evidence document from inline plain text (max {settings.DOCUMENT_CONTENT_MAX_LENGTH:,} "
        "characters). Use /documents/upload for PDF files. Request body limit: 50 MB."
    ),
    responses={413: {"description": "Content too large"}},
)
async def process_document(
    request: ProcessDocumentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    service: DocumentProcessingService = Depends(_processing_service),
) -> DocumentResponse:
    try:
        result = await service.process_text(request.filename, request.content, current_user.id)
    except DocumentTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e)) from e
    return _to_response(result.document)


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=201,
    summary="Upload a file document",
    description="Upload a PDF or text file. PDFs are parsed and pages are extracted. Request body limit: 50 MB.",
    responses={
        413: {"description": "File too large"},
        422: {"description": "Invalid file type or content"},
    },
)
async def upload_file(
    file: UploadFile,
    current_user: CurrentUser = Depends(get_current_user),
    service: DocumentProcessingService = Depends(_processing_service),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> DocumentResponse:
    if not file.filename:
        raise HTTPException(status_code=422, detail="Filename is required")
    if len(file.filename) > settings.FILENAME_MAX_LENGTH:
        raise HTTPException(status_code=422, detail="Filename is too long")

    content_type = file.content_type or ""
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        lower_name = file.filename.lower()
        if not (lower_name.endswith(".pdf") or lower_name.endswith((".txt", ".text", ".md", ".csv"))):
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported file type: {content_type}",
            )

    if file.size is not None and file.size > settings.MAX_DOCUMENT_REQUEST_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    file_data = await file.read()

    if len(file_data) > settings.MAX_DOCUMENT_REQUEST_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    if not file_data:
        raise HTTPException(status_code=422, detail="File is empty")

    command = UploadDocument(
        filename=file.filename,
        content=file_data,
        owner_id=current_user.id,
    )

    try:
        result = await service.process_upload(command)
    except (DocumentTooLargeError, ValueError, InvalidDocumentError, DocumentProcessingError) as e:
        # Keep the document's "failed" status: raising below would otherwise roll it back.
        await session.commit()
        status_code = 413 if isinstance(e, DocumentTooLargeError) else 422
        raise HTTPException(status_code=status_code, detail=str(e)) from e

    return _to_response(result.document)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get a document by ID",
    description="Retrieve document metadata. Returns 404 if not found or not owned by the caller.",
    responses={404: {"description": "Document not found"}},
)
async def get_document(
    document_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> DocumentResponse:
    repository = get_document_repository(session)
    document = await repository.find_by_id(document_id, owner_id=current_user.id)
    if document is None:
        raise DocumentNotFoundError(str(document_id))
    return _to_response(document)


@router.get(
    "/{document_id}/pages",
    response_model=DocumentPagesResponse,
    summary="Get extracted pages",
    description="Retrieve extracted pages for a document. Returns 404 if not found or not owned by the caller.",
    responses={404: {"description": "Document not found"}},
)
async def get_document_pages(
    document_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> DocumentPagesResponse:
    repository = get_document_repository(session)
    document = await repository.find_by_id(document_id, owner_id=current_user.id)
    if document is None:
        raise DocumentNotFoundError(str(document_id))

    pages = await repository.find_pages_by_document_id(document.id)
    return DocumentPagesResponse(
        document_id=str(document.id),
        total_pages=len(pages),
        pages=[
            DocumentPageResponse(
                id=str(p.id),
                page_number=p.page_number,
                text=p.text,
                char_offset=p.char_offset,
                char_length=p.char_length,
            )
            for p in pages
        ],
    )


@router.get(
    "/",
    response_model=list[DocumentResponse],
    summary="List documents",
    description="Return documents owned by the current user. Supports offset/limit pagination.",
)
async def list_documents(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
    offset: int = Query(0, ge=0),
    limit: int = Query(settings.PAGINATION_DEFAULT_LIMIT, ge=1, le=settings.PAGINATION_MAX_LIMIT),
) -> list[DocumentResponse]:
    repository = get_document_repository(session)
    documents = await repository.find_all(owner_id=current_user.id, offset=offset, limit=limit)
    return [_to_response(d) for d in documents]
