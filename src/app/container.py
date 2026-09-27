from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings
from modules.ai.domain.model import Model
from modules.ai.infrastructure.factory import build_provider
from modules.claims.domain.repositories.claim_repository import ClaimRepository
from modules.claims.infrastructure.persistence.postgres_claim_repository import (
    PostgresClaimRepository,
)
from modules.documents.application.processing_service import DocumentProcessingService
from modules.documents.domain.repositories.document_repository import DocumentRepository
from modules.documents.infrastructure.parsers.pdf_parser import SubprocessPdfParser
from modules.documents.infrastructure.persistence.postgres_document_repository import (
    PostgresDocumentRepository,
)
from modules.evidence.domain.repositories.evidence_repository import EvidenceRepository
from modules.evidence.infrastructure.persistence.postgres_evidence_repository import (
    PostgresEvidenceRepository,
)
from modules.verification.domain.repositories.verification_repository import (
    VerificationRepository,
)
from modules.verification.domain.services.verification_engine import VerificationEngine
from modules.verification.infrastructure.llm import LlmVerificationEngine
from modules.verification.infrastructure.persistence.postgres_verification_repository import (
    PostgresVerificationRepository,
)
from modules.verification.infrastructure.rules.rule_based_engine import (
    RuleBasedVerificationEngine,
)
from shared.infrastructure.clock import UtcClock

_pdf_parser: SubprocessPdfParser | None = None
_verification_engine: VerificationEngine | None = None


def get_claim_repository(session: AsyncSession) -> ClaimRepository:
    return PostgresClaimRepository(session)


def get_document_repository(session: AsyncSession) -> DocumentRepository:
    return PostgresDocumentRepository(session)


def get_evidence_repository(session: AsyncSession) -> EvidenceRepository:
    return PostgresEvidenceRepository(session)


def get_verification_repository(session: AsyncSession) -> VerificationRepository:
    return PostgresVerificationRepository(session)


def get_verification_engine() -> VerificationEngine:
    global _verification_engine
    if _verification_engine is not None:
        return _verification_engine

    rule_based = RuleBasedVerificationEngine()
    provider = build_provider(settings)

    if provider is None:
        _verification_engine = rule_based
        return _verification_engine

    def _model(name: str) -> Model:
        return Model(
            name=name,
            provider=settings.resolved_ai_provider(),
            temperature=settings.AI_TEMPERATURE,
            max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
            reasoning_effort=settings.AI_REASONING_EFFORT,
        )

    model = _model(settings.resolved_ai_model())

    _verification_engine = LlmVerificationEngine(
        provider=provider,
        model=model,
        fallback=rule_based,
        max_passages=settings.AI_MAX_EVIDENCE_PASSAGES,
        max_prompt_tokens=settings.AI_MAX_PROMPT_TOKENS,
        fallback_models=tuple(_model(n) for n in settings.resolved_ai_fallback_models()),
    )
    return _verification_engine


async def close_ai_client() -> None:
    global _verification_engine
    if _verification_engine is not None and hasattr(_verification_engine, "_provider"):
        await _verification_engine._provider.close()
    _verification_engine = None


def get_clock() -> UtcClock:
    return UtcClock()


def get_pdf_parser() -> SubprocessPdfParser:
    global _pdf_parser
    if _pdf_parser is None:
        _pdf_parser = SubprocessPdfParser(
            max_pages=settings.PDF_MAX_PAGES,
            timeout_seconds=settings.PDF_PARSE_TIMEOUT_SECONDS,
            memory_limit_mb=settings.PDF_WORKER_MEMORY_LIMIT_MB,
            max_concurrency=settings.PDF_MAX_CONCURRENT_PARSES,
        )
    return _pdf_parser


def get_document_processing_service(session: AsyncSession) -> DocumentProcessingService:
    return DocumentProcessingService(
        repository=get_document_repository(session),
        parser=get_pdf_parser(),
        max_content_length=settings.DOCUMENT_CONTENT_MAX_LENGTH,
    )
