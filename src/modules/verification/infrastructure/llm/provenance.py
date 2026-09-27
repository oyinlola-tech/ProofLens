from __future__ import annotations

import re

from modules.verification.domain.services.verification_engine import EvidencePassage
from modules.verification.domain.value_objects.evidence_reference import (
    EvidenceReference,
    ReferenceRole,
)
from modules.verification.infrastructure.llm.schema import AiEvidenceReference

_WS = re.compile(r"\s+")
_MIN_QUOTE_CHARS = 8


def _normalized(text: str) -> tuple[str, list[int]]:
    """Lower-cased text with whitespace runs collapsed, plus a map back to original offsets."""
    out: list[str] = []
    offsets: list[int] = []
    pending_space = False
    for i, ch in enumerate(text):
        if ch.isspace():
            pending_space = bool(out)
            continue
        if pending_space:
            out.append(" ")
            offsets.append(i)
            pending_space = False
        out.append(ch.lower())
        offsets.append(i)
    return "".join(out), offsets


def locate_quote(source: str, quote: str) -> str | None:
    """The stored source text that `quote` refers to, or None if it is not in the source."""
    needle = _WS.sub(" ", quote.strip()).lower().strip(" \"'“”")
    if len(needle) < _MIN_QUOTE_CHARS:
        return None
    hay, offsets = _normalized(source)
    idx = hay.find(needle)
    if idx < 0:
        return None
    start = offsets[idx]
    end = offsets[idx + len(needle) - 1] + 1
    return source[start:end]


def validate_references(
    proposed: list[AiEvidenceReference], evidence: list[EvidencePassage]
) -> list[EvidenceReference]:
    """Keep only references that resolve to supplied passages; quotes must be verbatim source text.

    Document IDs and pages always come from the stored passage, never from the model.
    """
    by_ref = {p.ref: p for p in evidence}
    kept: list[EvidenceReference] = []
    seen: set[tuple[str, str]] = set()
    for ref in proposed:
        passage = by_ref.get(ref.ref)
        if passage is None:
            continue
        quote = locate_quote(passage.content, ref.quote) if ref.quote else None
        key = (passage.ref, quote or "")
        if key in seen:
            continue
        seen.add(key)
        kept.append(
            EvidenceReference(
                evidence_id=passage.ref,
                document_id=passage.document_id,
                page=passage.page,
                quote=quote or "",
                role=ReferenceRole(ref.role),
            )
        )
    return kept
