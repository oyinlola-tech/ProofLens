from __future__ import annotations

from enum import StrEnum


class DocumentType(StrEnum):
    PDF = "pdf"
    TEXT = "text"
    HTML = "html"
    UNKNOWN = "unknown"
