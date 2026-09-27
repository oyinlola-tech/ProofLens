from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.settings import settings
from shared.infrastructure.database import close_db


def _get_body_limit(request: Request) -> int:
    if request.url.path.startswith(f"{settings.API_PREFIX}/documents"):
        return settings.MAX_DOCUMENT_REQUEST_BYTES
    return settings.MAX_REQUEST_BODY_BYTES


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    from app.container import close_ai_client

    yield
    await close_ai_client()
    await close_db()


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        limit = _get_body_limit(request)

        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"error": "INVALID_CONTENT_LENGTH", "message": "Invalid Content-Length header"},
                )
            if size > limit:
                return JSONResponse(
                    status_code=413,
                    content={"error": "REQUEST_TOO_LARGE", "message": "Request body too large"},
                )

        original_receive = request._receive
        bytes_received = 0
        exceeded = False

        async def limited_receive() -> dict:
            nonlocal bytes_received, exceeded
            message = await original_receive()
            if message.get("type") == "http.request":
                body = message.get("body", b"")
                bytes_received += len(body)
                if bytes_received > limit:
                    exceeded = True
                    raise ConnectionResetError("Request body too large")
            return message  # type: ignore[return-value]

        request._receive = limited_receive

        too_large = JSONResponse(
            status_code=413,
            content={"error": "REQUEST_TOO_LARGE", "message": "Request body too large"},
        )
        try:
            response = await call_next(request)
        except ConnectionResetError:
            return too_large
        # FastAPI's body parser may catch the error above and answer 400; report it as 413.
        return too_large if exceeded else response


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="AI-powered evidence verification platform. Submit claims, attach evidence documents, and receive AI-generated verification verdicts with confidence scores.",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
        openapi_tags=[
            {"name": "auth", "description": "Register, login, logout, and session management"},
            {"name": "claims", "description": "Create and retrieve claims for verification"},
            {"name": "documents", "description": "Upload evidence documents"},
            {"name": "evidence", "description": "Attach evidence passages to claims"},
            {"name": "verification", "description": "Run AI verification and retrieve results"},
        ],
    )

    app.add_middleware(BodySizeLimitMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response

    _register_routes(app)
    _register_error_handlers(app)

    if settings.DEBUG:
        _configure_openapi(app)

    return app


def _configure_openapi(app: FastAPI) -> None:
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        from fastapi.openapi.utils import get_openapi

        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            tags=app.openapi_tags,
            routes=app.routes,
        )
        schema["components"] = schema.get("components", {})
        schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "Token",
                "description": "Paste the token returned from /auth/register or /auth/login",
            }
        }
        schema["security"] = [{"BearerAuth": []}]
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi  # type: ignore[method-assign]


def _register_routes(app: FastAPI) -> None:
    from modules.claims.presentation.http.routes import router as claims_router
    from modules.documents.presentation.http.routes import router as documents_router
    from modules.evidence.presentation.http.routes import router as evidence_router
    from modules.users.presentation.http.routes import router as auth_router
    from modules.verification.presentation.http.routes import router as verification_router

    prefix = settings.API_PREFIX

    @app.get(f"{prefix}/health")
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.APP_NAME}

    app.include_router(auth_router, prefix=prefix, tags=["auth"])
    app.include_router(claims_router, prefix=prefix, tags=["claims"])
    app.include_router(documents_router, prefix=prefix, tags=["documents"])
    app.include_router(evidence_router, prefix=prefix, tags=["evidence"])
    app.include_router(verification_router, prefix=prefix, tags=["verification"])


def _register_error_handlers(app: FastAPI) -> None:
    from fastapi.responses import JSONResponse

    from shared.errors import DomainError
    from shared.errors.application import ApplicationError
    from shared.errors.base import ProofLensError

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        status_code = 404 if exc.code.endswith("_NOT_FOUND") else 422
        return JSONResponse(
            status_code=status_code,
            content={"error": exc.code, "message": str(exc)},
        )

    @app.exception_handler(ApplicationError)
    async def application_error_handler(
        request: Request, exc: ApplicationError
    ) -> JSONResponse:
        status_code = {
            "NOT_FOUND": 404,
            "CONFLICT": 409,
            "VALIDATION_ERROR": 422,
            "SERVICE_UNAVAILABLE": 503,
            "RATE_LIMITED": 429,
            "OTP_ATTEMPTS_EXCEEDED": 429,
        }.get(exc.code, 400)
        content: dict[str, object] = {"error": exc.code, "message": str(exc)}
        content.update(exc.extra)
        headers = {}
        retry_after = exc.extra.get("retry_after")
        if isinstance(retry_after, int):
            headers["Retry-After"] = str(retry_after)
        return JSONResponse(status_code=status_code, content=content, headers=headers)

    @app.exception_handler(ProofLensError)
    async def base_error_handler(
        request: Request, exc: ProofLensError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": exc.code, "message": str(exc)},
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": "VALIDATION_ERROR", "message": str(exc)},
        )
