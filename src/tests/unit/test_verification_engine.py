from modules.verification.domain.services.verification_engine import EvidencePassage
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.infrastructure.rules.rule_based_engine import (
    RuleBasedVerificationEngine,
)


def _passages(texts: list[str]) -> list[EvidencePassage]:
    return [EvidencePassage(content=t, ref=f"ref-{i}") for i, t in enumerate(texts, 1)]


async def test_no_evidence():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The earth is round",
        evidence=[],
    )
    assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE
    assert result.confidence.value == 0.0
    assert "No evidence" in result.reasoning


async def test_direct_match():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The earth is round",
        evidence=_passages(["The earth is round"]),
    )
    assert result.verdict == Verdict.SUPPORTED
    assert result.confidence.value == 0.9
    assert "directly matches" in result.reasoning.lower()


async def test_strong_overlap():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The earth is round and blue",
        evidence=_passages(["The earth is indeed round and very blue"]),
    )
    assert result.verdict == Verdict.SUPPORTED
    assert result.confidence.value > 0.5


async def test_partial_overlap():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The earth is round and blue and large",
        evidence=_passages(["The earth is round"]),
    )
    assert result.verdict == Verdict.PARTIALLY_SUPPORTED
    assert result.confidence.value > 0.0


async def test_unrelated_evidence_is_insufficient_not_contradicted():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="Quantum physics explains subatomic particles",
        evidence=_passages(["Basketball players score points in games"]),
    )
    assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE


async def test_negated_evidence_contradicts():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The drug is safe",
        evidence=_passages(["Trials found it is false that the drug is safe."]),
    )
    assert result.verdict == Verdict.CONTRADICTED
    assert "negates" in result.reasoning


async def test_negated_claim_contradicted_by_affirmative_evidence():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The bridge was not closed in 2021",
        evidence=_passages(["The bridge was closed in 2021 for repairs."]),
    )
    assert result.verdict == Verdict.CONTRADICTED


async def test_conflicting_figures_contradict():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="Revenue grew 10% in 2023",
        evidence=_passages(["Revenue grew 40% in 2023."]),
    )
    assert result.verdict == Verdict.CONTRADICTED
    assert "figures" in result.reasoning


async def test_matching_figures_support():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="Unemployment was 4.2% in March",
        evidence=_passages(["In March, unemployment stood at 4.2% according to the BLS."]),
    )
    assert result.verdict == Verdict.SUPPORTED


async def test_best_sentence_is_used():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The earth is round",
        evidence=_passages(["Bananas are yellow. The earth is round. It is not flat."]),
    )
    assert result.verdict == Verdict.SUPPORTED


async def test_multiple_evidence():
    engine = RuleBasedVerificationEngine()
    result = await engine.evaluate(
        claim_text="The earth is round",
        evidence=_passages([
            "The earth is indeed round",
            "Scientists confirm Earth is spherical",
        ]),
    )
    assert result.verdict == Verdict.SUPPORTED
