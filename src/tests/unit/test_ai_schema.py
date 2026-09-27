from __future__ import annotations

import json

import pytest

from modules.verification.infrastructure.llm.schema import (
    RESPONSE_SCHEMA,
    MalformedAiResponseError,
    parse_ai_response,
    response_json_schema,
)


def _walk(node, seen):
    if isinstance(node, dict):
        seen.append(node)
        for v in node.values():
            _walk(v, seen)
    elif isinstance(node, list):
        for v in node:
            _walk(v, seen)


def test_schema_is_strict_and_self_contained():
    nodes: list[dict] = []
    _walk(RESPONSE_SCHEMA, nodes)
    assert not any("$ref" in n for n in nodes)
    for n in nodes:
        if n.get("type") == "object" and "properties" in n:
            assert n["additionalProperties"] is False
            assert set(n["required"]) == set(n["properties"].keys())
    assert RESPONSE_SCHEMA["properties"]["verdict"]["enum"] == [
        "supported", "partially_supported", "contradicted", "insufficient_evidence",
    ]
    assert RESPONSE_SCHEMA["properties"]["confidence"]["maximum"] == 1.0
    assert response_json_schema() == RESPONSE_SCHEMA


def test_parse_accepts_fenced_json_and_clips_long_text():
    body = {
        "verdict": "supported",
        "confidence": 0.5,
        "summary": "s" * 5_000,
        "claim_analysis": {"entities": ["a"] * 50},
        "evidence_references": [{"ref": "r", "quote": "q" * 5_000, "role": "supports"}],
        "unexpected": "ignored",
    }
    parsed = parse_ai_response("```json\n" + json.dumps(body) + "\n```")
    assert len(parsed.summary) == 1_500
    assert len(parsed.claim_analysis.entities) == 20
    assert len(parsed.evidence_references[0].quote) == 1_000


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "[]",
        '{"verdict": "true", "confidence": 0.5, "summary": "x", "claim_analysis": {}}',
        '{"verdict": "supported", "confidence": -0.1, "summary": "x", "claim_analysis": {}}',
        '{"verdict": "supported", "confidence": 1.1, "summary": "x", "claim_analysis": {}}',
        '{"verdict": "supported", "confidence": 0.5, "summary": "x", "claim_analysis": {}, "evidence_references": [{"ref": "r", "role": "invents"}]}',
        '{"verdict": "supported", "confidence": 0.5, "claim_analysis": {}}',
    ],
)
def test_parse_rejects_invalid_output(raw: str):
    with pytest.raises(MalformedAiResponseError):
        parse_ai_response(raw)
