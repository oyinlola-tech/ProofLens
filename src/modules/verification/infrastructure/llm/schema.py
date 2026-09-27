from __future__ import annotations

import copy
import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from modules.verification.domain.value_objects.verdict import Verdict

MAX_SHORT = 300
MAX_TEXT = 1_500
MAX_QUOTE = 1_000
MAX_ITEMS = 20


def _clip(value: str, limit: int) -> str:
    return value.strip()[:limit]


class AiEvidenceReference(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    ref: str
    quote: str = ""
    role: Literal["supports", "contradicts", "context"] = "context"

    @field_validator("ref")
    @classmethod
    def _ref(cls, v: str) -> str:
        return _clip(v, 64)

    @field_validator("quote")
    @classmethod
    def _quote(cls, v: str) -> str:
        return _clip(v, MAX_QUOTE)


class AiClaimAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    subject: str = ""
    proposition: str = ""
    assertion_strength: Literal["hedged", "moderate", "absolute"] = "moderate"
    causal: bool = False
    quantitative: bool = False
    entities: list[str] = Field(default_factory=list)
    numbers: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)

    @field_validator("subject")
    @classmethod
    def _subject(cls, v: str) -> str:
        return _clip(v, MAX_SHORT)

    @field_validator("proposition")
    @classmethod
    def _proposition(cls, v: str) -> str:
        return _clip(v, MAX_TEXT)

    @field_validator("entities", "numbers", "dates")
    @classmethod
    def _items(cls, v: list[str]) -> list[str]:
        return [_clip(str(x), MAX_SHORT) for x in v[:MAX_ITEMS] if str(x).strip()]


class AiFinding(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    kind: Literal[
        "supported_component",
        "unsupported_component",
        "contradiction",
        "qualifier_gap",
        "scope_gap",
        "negation",
    ]
    description: str
    refs: list[str] = Field(default_factory=list)

    @field_validator("description")
    @classmethod
    def _description(cls, v: str) -> str:
        return _clip(v, MAX_TEXT)

    @field_validator("refs")
    @classmethod
    def _refs(cls, v: list[str]) -> list[str]:
        return [_clip(str(x), 64) for x in v[:MAX_ITEMS] if str(x).strip()]


class AiVerificationResponse(BaseModel):
    """Structured output every provider must produce; validated before it reaches the domain."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    claim_analysis: AiClaimAnalysis
    supported_parts: str = ""
    unsupported_parts: str = ""
    why_claim_does_not_match: str = ""
    source_grounded_statement: str = ""
    source_limitations: str = ""
    conclusion: str = ""
    findings: list[AiFinding] = Field(default_factory=list)
    evidence_references: list[AiEvidenceReference] = Field(default_factory=list)

    @field_validator(
        "summary",
        "supported_parts",
        "unsupported_parts",
        "why_claim_does_not_match",
        "source_grounded_statement",
        "source_limitations",
        "conclusion",
    )
    @classmethod
    def _text(cls, v: str) -> str:
        return _clip(v, MAX_TEXT)

    @field_validator("findings", "evidence_references")
    @classmethod
    def _lists(cls, v: list[Any]) -> list[Any]:
        return v[:MAX_ITEMS]


class MalformedAiResponseError(ValueError):
    pass


def parse_ai_response(content: str) -> AiVerificationResponse:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise MalformedAiResponseError("no JSON object in model output")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        raise MalformedAiResponseError("model output is not valid JSON") from e
    if not isinstance(data, dict):
        raise MalformedAiResponseError("model output is not a JSON object")
    try:
        return AiVerificationResponse.model_validate(data)
    except ValidationError as e:
        raise MalformedAiResponseError(f"{e.error_count()} schema violation(s)") from e


def _inline(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, list):
        return [_inline(x, defs) for x in node]
    if not isinstance(node, dict):
        return node
    if "$ref" in node:
        name = node["$ref"].split("/")[-1]
        return _inline(copy.deepcopy(defs[name]), defs)
    if "allOf" in node and len(node["allOf"]) == 1:
        merged = {k: v for k, v in node.items() if k != "allOf"}
        merged.update(node["allOf"][0])
        return _inline(merged, defs)
    out: dict[str, Any] = {}
    for key, value in node.items():
        if key in ("title", "default"):
            continue
        out[key] = _inline(value, defs)
    if out.get("type") == "object" and "properties" in out:
        out["additionalProperties"] = False
        out["required"] = list(out["properties"].keys())
    return out


def response_json_schema() -> dict[str, Any]:
    """Strict, self-contained JSON schema: no $ref, every property required, no extras."""
    raw = AiVerificationResponse.model_json_schema()
    defs = raw.pop("$defs", {})
    schema: dict[str, Any] = _inline(raw, defs)
    return schema


RESPONSE_SCHEMA = response_json_schema()
