from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any

from modules.verification.domain.value_objects.analysis_metadata import (
    AnalysisMetadata,
    AnalysisMode,
)
from modules.verification.domain.value_objects.claim_analysis import (
    AssertionStrength,
    ClaimAnalysis,
)
from modules.verification.domain.value_objects.deterministic_finding import (
    DeterministicFinding,
    FindingKind,
)
from modules.verification.domain.value_objects.evidence_reference import (
    EvidenceReference,
    ReferenceRole,
)


def dumps(value: Any) -> str | None:
    if value is None or value == () or value == []:
        return None
    if isinstance(value, list | tuple):
        return json.dumps([asdict(v) for v in value])
    return json.dumps(asdict(value))


def _loads(raw: str | None) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def load_claim_analysis(raw: str | None) -> ClaimAnalysis | None:
    data = _loads(raw)
    if not isinstance(data, dict):
        return None
    try:
        return ClaimAnalysis(
            subject=str(data.get("subject", "")),
            proposition=str(data.get("proposition", "")),
            assertion_strength=AssertionStrength(data.get("assertion_strength", "moderate")),
            causal=bool(data.get("causal", False)),
            quantitative=bool(data.get("quantitative", False)),
            negated=bool(data.get("negated", False)),
            entities=tuple(str(x) for x in data.get("entities", [])),
            numbers=tuple(str(x) for x in data.get("numbers", [])),
            dates=tuple(str(x) for x in data.get("dates", [])),
        )
    except ValueError:
        return None


def load_findings(raw: str | None) -> tuple[DeterministicFinding, ...]:
    data = _loads(raw)
    if not isinstance(data, list):
        return ()
    out: list[DeterministicFinding] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            out.append(
                DeterministicFinding(
                    kind=FindingKind(item["kind"]),
                    description=str(item.get("description", "")),
                    claim_value=str(item.get("claim_value", "")),
                    evidence_value=str(item.get("evidence_value", "")),
                    evidence_ref=str(item.get("evidence_ref", "")),
                    conflict=bool(item.get("conflict", False)),
                )
            )
        except (KeyError, ValueError):
            continue
    return tuple(out)


def load_references(raw: str | None) -> tuple[EvidenceReference, ...]:
    data = _loads(raw)
    if not isinstance(data, list):
        return ()
    out: list[EvidenceReference] = []
    for item in data:
        if not isinstance(item, dict) or not item.get("evidence_id"):
            continue
        try:
            page = item.get("page")
            out.append(
                EvidenceReference(
                    evidence_id=str(item["evidence_id"]),
                    document_id=str(item["document_id"]) if item.get("document_id") else None,
                    page=int(page) if page is not None else None,
                    quote=str(item.get("quote", "")),
                    role=ReferenceRole(item.get("role", "context")),
                )
            )
        except (ValueError, TypeError):
            continue
    return tuple(out)


def load_analysis(raw: str | None) -> AnalysisMetadata | None:
    data = _loads(raw)
    if not isinstance(data, dict):
        return None
    try:
        return AnalysisMetadata(
            mode=AnalysisMode(data.get("mode", "deterministic")),
            provider=str(data.get("provider", "")),
            model=str(data.get("model", "")),
            duration_ms=int(data.get("duration_ms", 0)),
            prompt_tokens=int(data.get("prompt_tokens", 0)),
            completion_tokens=int(data.get("completion_tokens", 0)),
            failure=str(data.get("failure", "")),
        )
    except (ValueError, TypeError):
        return None
