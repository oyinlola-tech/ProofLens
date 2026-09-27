from __future__ import annotations

import re
from dataclasses import dataclass, field
from uuid import UUID

from modules.documents.domain.document_page import DocumentPage


@dataclass(frozen=True)
class RetrievedPassage:
    page_number: int
    text: str
    score: float
    document_id: UUID
    char_offset: int = 0


@dataclass(frozen=True)
class RetrievalResult:
    query: str
    passages: list[RetrievedPassage] = field(default_factory=list)

    @property
    def has_results(self) -> bool:
        return len(self.passages) > 0


def _normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _tokenize(text: str) -> list[str]:
    normalized = _normalize_text(text)
    words = normalized.split()
    return [w for w in words if len(w) > 2]


def _compute_overlap_score(query_tokens: list[str], passage_tokens: list[str]) -> float:
    if not query_tokens:
        return 0.0

    passage_set = set(passage_tokens)
    matched = sum(1 for t in query_tokens if t in passage_set)
    return matched / len(query_tokens)


def retrieve_passages(
    query: str,
    pages: list[DocumentPage],
    max_results: int = 10,
    min_score: float = 0.05,
) -> RetrievalResult:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return RetrievalResult(query=query)

    scored: list[RetrievedPassage] = []

    for page in pages:
        if not page.text.strip():
            continue

        passage_tokens = _tokenize(page.text)
        score = _compute_overlap_score(query_tokens, passage_tokens)

        if score >= min_score:
            scored.append(
                RetrievedPassage(
                    page_number=page.page_number,
                    text=page.text,
                    score=score,
                    document_id=page.document_id,
                    char_offset=page.char_offset,
                )
            )

    scored.sort(key=lambda p: p.score, reverse=True)
    top = scored[:max_results]

    return RetrievalResult(query=query, passages=top)
