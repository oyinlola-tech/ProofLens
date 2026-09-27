from __future__ import annotations

from shared.errors.base import ApplicationError


class NotFoundError(ApplicationError):
    def __init__(self, resource: str, resource_id: str) -> None:
        super().__init__(
            message=f"{resource} not found: {resource_id}",
            code="NOT_FOUND",
        )


class ValidationError(ApplicationError):
    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message=message, code="VALIDATION_ERROR")


class ConflictError(ApplicationError):
    def __init__(self, message: str = "Resource conflict") -> None:
        super().__init__(message=message, code="CONFLICT")


class ServiceUnavailableError(ApplicationError):
    def __init__(self, service: str) -> None:
        super().__init__(
            message=f"Service unavailable: {service}",
            code="SERVICE_UNAVAILABLE",
        )
