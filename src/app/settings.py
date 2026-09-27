from __future__ import annotations

from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="PROOFLENS_",
        case_sensitive=False,
    )

    APP_NAME: str = "ProofLens"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    HOST: str = "127.0.0.1"
    PORT: int = 8000

    API_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/prooflens"
    DATABASE_ECHO: bool = False

    # --- AI verification -------------------------------------------------------------
    # Which provider runs AI verification. Empty selects automatically from whichever
    # provider has credentials configured (gemini, then nvidia, then groq); "none"
    # disables AI so the deterministic rule engine decides alone.
    AI_PROVIDER: Literal["", "none", "gemini", "nvidia", "groq", "ollama"] = ""
    # Overrides the per-provider default model when set.
    AI_MODEL: str = ""
    AI_TIMEOUT_SECONDS: float = 30.0
    AI_MAX_EVIDENCE_PASSAGES: int = 20
    AI_MAX_PROMPT_TOKENS: int = 8_000
    AI_MAX_OUTPUT_TOKENS: int = 2_000
    AI_TEMPERATURE: float = 0.0
    # Reasoning depth for providers that support it (Gemini thinking, OpenAI-style
    # reasoning_effort, Ollama think). Empty leaves the provider default.
    AI_REASONING_EFFORT: Literal["", "low", "medium", "high"] = ""

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODELS: str = ""

    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_MODEL: str = "nvidia/nemotron-3-super-120b-a12b"
    # Comma-separated models tried in order when the main model fails.
    NVIDIA_FALLBACK_MODELS: str = ""

    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FALLBACK_MODELS: str = ""

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"

    # ----------------------------------------------------------------------------------

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8081"]
    CORS_ALLOW_CREDENTIALS: bool = False
    CORS_ALLOW_METHODS: list[str] = ["GET", "POST", "PUT", "DELETE"]
    CORS_ALLOW_HEADERS: list[str] = ["Authorization", "Content-Type"]

    # IPs of reverse proxies whose X-Forwarded-For / X-Real-IP headers are trusted.
    # Leave empty when the app is exposed directly.
    TRUSTED_PROXY_IPS: list[str] = []

    LOG_LEVEL: str = "INFO"

    AUTH_TOKEN_EXPIRY_HOURS: int = 24

    # Email verification is a one-time numeric code the user types in, never a link.
    OTP_LENGTH: int = 6
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    MAX_VERIFICATION_EMAILS_PER_HOUR: int = 3

    EMAIL_BACKEND: Literal["console", "resend", "smtp"] = "console"
    EMAIL_FROM: str = "ProofLens <no-reply@localhost>"
    SUPPORT_EMAIL: str = "support@prooflens.app"
    PUBLIC_WEB_URL: str = "http://localhost:3000"
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_SECURITY: Literal["starttls", "ssl", "none"] = "starttls"
    SMTP_TIMEOUT_SECONDS: float = 10.0
    AUTH_MAX_SESSIONS: int = 5
    MAX_REQUEST_BODY_BYTES: int = 1_048_576  # 1MB
    MAX_DOCUMENT_REQUEST_BYTES: int = 52_428_800  # 50MB for document endpoints

    EVIDENCE_MAX_LENGTH: int = 50_000
    DOCUMENT_CONTENT_MAX_LENGTH: int = 10_000_000
    FILENAME_MAX_LENGTH: int = 255
    SECTION_MAX_LENGTH: int = 255
    PDF_PARSE_TIMEOUT_SECONDS: float = 60.0
    PDF_MAX_PAGES: int = 1000
    PDF_WORKER_MEMORY_LIMIT_MB: int = 1024
    PDF_MAX_CONCURRENT_PARSES: int = 4

    PAGINATION_DEFAULT_LIMIT: int = 20
    PAGINATION_MAX_LIMIT: int = 100

    TEST_DATABASE_URL: str = ""

    @model_validator(mode="after")
    def _check_safety(self) -> Self:
        if self.ENVIRONMENT == "production" and self.EMAIL_BACKEND == "console":
            raise ValueError(
                "PROOFLENS_EMAIL_BACKEND=console only logs emails; configure resend or smtp in production"
            )
        if self.EMAIL_BACKEND == "resend" and not self.RESEND_API_KEY:
            raise ValueError("PROOFLENS_EMAIL_BACKEND=resend requires PROOFLENS_RESEND_API_KEY")
        if not 4 <= self.OTP_LENGTH <= 10:
            raise ValueError("PROOFLENS_OTP_LENGTH must be between 4 and 10")
        required_key = {"gemini": self.GEMINI_API_KEY, "nvidia": self.NVIDIA_API_KEY, "groq": self.GROQ_API_KEY}
        if self.AI_PROVIDER in required_key and not required_key[self.AI_PROVIDER]:
            raise ValueError(
                f"PROOFLENS_AI_PROVIDER={self.AI_PROVIDER} requires PROOFLENS_{self.AI_PROVIDER.upper()}_API_KEY"
            )
        return self

    def resolved_ai_provider(self) -> str:
        """The provider actually in effect: explicit setting, else the first with credentials."""
        if self.AI_PROVIDER == "none":
            return ""
        if self.AI_PROVIDER:
            return self.AI_PROVIDER
        if self.GEMINI_API_KEY:
            return "gemini"
        if self.NVIDIA_API_KEY:
            return "nvidia"
        if self.GROQ_API_KEY:
            return "groq"
        return ""

    def resolved_ai_model(self) -> str:
        if self.AI_MODEL:
            return self.AI_MODEL
        return {
            "gemini": self.GEMINI_MODEL,
            "nvidia": self.NVIDIA_MODEL,
            "groq": self.GROQ_MODEL,
            "ollama": self.OLLAMA_MODEL,
        }.get(self.resolved_ai_provider(), "")

    def resolved_ai_fallback_models(self) -> list[str]:
        raw = {
            "gemini": self.GEMINI_FALLBACK_MODELS,
            "nvidia": self.NVIDIA_FALLBACK_MODELS,
            "groq": self.GROQ_FALLBACK_MODELS,
        }.get(self.resolved_ai_provider(), "")
        primary = self.resolved_ai_model()
        models: list[str] = []
        for name in (m.strip() for m in raw.split(",")):
            if name and name != primary and name not in models:
                models.append(name)
        return models


settings = Settings()
