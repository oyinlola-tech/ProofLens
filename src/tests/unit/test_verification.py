
import pytest

from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.domain.value_objects.verification_result import VerificationResult
from shared.errors.domain import InvalidConfidenceError


def test_verdict_values():
    assert Verdict.SUPPORTED == "supported"
    assert Verdict.PARTIALLY_SUPPORTED == "partially_supported"
    assert Verdict.CONTRADICTED == "contradicted"
    assert Verdict.INSUFFICIENT_EVIDENCE == "insufficient_evidence"


def test_confidence_valid():
    c = Confidence(value=0.5)
    assert c.value == 0.5

    c_min = Confidence(value=0.0)
    assert c_min.value == 0.0

    c_max = Confidence(value=1.0)
    assert c_max.value == 1.0


def test_confidence_invalid():
    with pytest.raises(InvalidConfidenceError):
        Confidence(value=-0.1)

    with pytest.raises(InvalidConfidenceError):
        Confidence(value=1.1)


def test_verification_result():
    result = VerificationResult(
        verdict=Verdict.SUPPORTED,
        confidence=Confidence(value=0.85),
        reasoning="Strong evidence supports the claim",
    )
    assert result.verdict == Verdict.SUPPORTED
    assert result.confidence.value == 0.85
    assert result.reasoning == "Strong evidence supports the claim"
