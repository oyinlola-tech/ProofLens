from __future__ import annotations


class ProofLensError(Exception):
    """Base exception for all ProofLens errors."""

    def __init__(self, message: str = "", code: str = "UNKNOWN_ERROR") -> None:
        self.code = code
        super().__init__(message)


class DomainError(ProofLensError):
    """Base exception for domain layer errors."""

    def __init__(self, message: str = "", code: str = "DOMAIN_ERROR") -> None:
        super().__init__(message=message, code=code)


class ApplicationError(ProofLensError):
    """Base exception for application layer errors.

    `extra` holds safe, client-facing fields merged into the error response.
    """

    def __init__(
        self, message: str = "", code: str = "APPLICATION_ERROR", **extra: object
    ) -> None:
        self.extra: dict[str, object] = extra
        super().__init__(message=message, code=code)


class InfrastructureError(ProofLensError):
    """Base exception for infrastructure layer errors."""

    def __init__(self, message: str = "", code: str = "INFRASTRUCTURE_ERROR") -> None:
        super().__init__(message=message, code=code)
