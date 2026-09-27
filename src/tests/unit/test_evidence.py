from uuid import uuid4

import pytest

from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.value_objects.evidence_span import EvidenceSpan
from modules.evidence.domain.value_objects.source_reference import SourceReference


def test_evidence_span_valid():
    span = EvidenceSpan(page_number=1, start_offset=0, end_offset=100)
    assert span.page_number == 1
    assert span.start_offset == 0
    assert span.end_offset == 100


def test_evidence_span_invalid_page():
    with pytest.raises(ValueError):
        EvidenceSpan(page_number=0, start_offset=0, end_offset=100)


def test_evidence_span_invalid_offsets():
    with pytest.raises(ValueError):
        EvidenceSpan(page_number=1, start_offset=-1, end_offset=100)

    with pytest.raises(ValueError):
        EvidenceSpan(page_number=1, start_offset=100, end_offset=50)


def test_source_reference():
    ref = SourceReference(document_id="doc-123", section="Introduction", page=1)
    assert ref.document_id == "doc-123"
    assert ref.section == "Introduction"
    assert ref.page == 1


def test_evidence_creation():
    claim_id = uuid4()
    evidence = Evidence.create(
        claim_id=claim_id,
        content="Test evidence content",
    )
    assert evidence.claim_id == claim_id
    assert evidence.content == "Test evidence content"
    assert evidence.id is not None
