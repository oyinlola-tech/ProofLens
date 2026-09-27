from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class ExtractedPage:
    page_number: int
    text: str
    char_offset: int = 0


@dataclass(frozen=True)
class ParsedDocument:
    pages: list[ExtractedPage] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def total_pages(self) -> int:
        return len(self.pages)

    @property
    def content(self) -> str:
        return "\n\n".join(p.text for p in self.pages)


class DocumentParser(Protocol):
    async def parse_bytes(self, data: bytes) -> ParsedDocument:
        """Parse a document. Raises ValueError for invalid input, TimeoutError if too slow."""
        ...
