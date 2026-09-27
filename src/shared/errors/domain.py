from __future__ import annotations

from shared.errors.base import DomainError


class ClaimNotFoundError(DomainError):
    def __init__(self, claim_id: str) -> None:
        super().__init__(
            message=f"Claim not found: {claim_id}",
            code="CLAIM_NOT_FOUND",
        )


class InvalidClaimTextError(DomainError):
    def __init__(self, reason: str) -> None:
        super().__init__(
            message=f"Invalid claim text: {reason}",
            code="INVALID_CLAIM_TEXT",
        )


class ClaimAlreadyVerifiedError(DomainError):
    def __init__(self, claim_id: str) -> None:
        super().__init__(
            message=f"Claim already verified: {claim_id}",
            code="CLAIM_ALREADY_VERIFIED",
        )


class EvidenceNotFoundError(DomainError):
    def __init__(self, evidence_id: str) -> None:
        super().__init__(
            message=f"Evidence not found: {evidence_id}",
            code="EVIDENCE_NOT_FOUND",
        )


class InvalidConfidenceError(DomainError):
    def __init__(self, value: float) -> None:
        super().__init__(
            message=f"Confidence must be between 0.0 and 1.0, got: {value}",
            code="INVALID_CONFIDENCE",
        )


class DocumentNotFoundError(DomainError):
    def __init__(self, document_id: str) -> None:
        super().__init__(
            message=f"Document not found: {document_id}",
            code="DOCUMENT_NOT_FOUND",
        )


class InvalidDocumentError(DomainError):
    def __init__(self, reason: str) -> None:
        super().__init__(
            message=f"Invalid document: {reason}",
            code="INVALID_DOCUMENT",
        )


class VerificationNotFoundError(DomainError):
    def __init__(self, verification_id: str) -> None:
        super().__init__(
            message=f"Verification not found: {verification_id}",
            code="VERIFICATION_NOT_FOUND",
        )


class DocumentProcessingError(DomainError):
    def __init__(self, reason: str) -> None:
        super().__init__(
            message=f"Document processing failed: {reason}",
            code="DOCUMENT_PROCESSING_ERROR",
        )


class DocumentTooLargeError(DomainError):
    def __init__(self, length: int, limit: int) -> None:
        super().__init__(
            message=f"Document text is {length} characters; the limit is {limit}",
            code="DOCUMENT_TOO_LARGE",
        )



