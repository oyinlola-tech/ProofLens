from __future__ import annotations

import pytest

from modules.verification.domain.services.verification_engine import EvidencePassage
from modules.verification.domain.value_objects.claim_analysis import AssertionStrength
from modules.verification.domain.value_objects.deterministic_finding import FindingKind
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.infrastructure.llm.provenance import locate_quote
from modules.verification.infrastructure.rules.deterministic_analysis import (
    analyze,
    analyze_claim,
)
from modules.verification.infrastructure.rules.rule_based_engine import (
    RuleBasedVerificationEngine,
)


def _p(*texts: str) -> list[EvidencePassage]:
    return [EvidencePassage(ref=f"ev-{i}", content=t) for i, t in enumerate(texts, 1)]


ACCEPTANCE = [
    ("The study proves that Drug X causes faster recovery.", "The study found an association between Drug X and faster recovery.", Verdict.PARTIALLY_SUPPORTED, FindingKind.QUALIFIER_GAP),
    ("The study involved 10,000 participants.", "The study involved 1,200 participants.", Verdict.CONTRADICTED, FindingKind.NUMBER_MISMATCH),
    ("The drug is safe.", "It is false that the drug is safe.", Verdict.CONTRADICTED, FindingKind.NEGATION_CONFLICT),
    ("The drug is safe.", "Bananas are yellow.", Verdict.INSUFFICIENT_EVIDENCE, FindingKind.LOW_RELEVANCE),
    ("The study included 1,200 participants.", "The study included 1,200 participants.", Verdict.SUPPORTED, FindingKind.EXACT_MATCH),
    ("The treatment always works.", "The treatment improved outcomes in 72% of participants.", Verdict.PARTIALLY_SUPPORTED, FindingKind.QUALIFIER_GAP),
    ("The program began in 2020.", "The program began in 2022.", Verdict.CONTRADICTED, FindingKind.DATE_MISMATCH),
    ("Company A conducted the study.", "Company B conducted the study.", Verdict.CONTRADICTED, FindingKind.ENTITY_MISMATCH),
    ("The report says the program reduced unemployment by 30%.", "The report states that unemployment decreased by 8%.", Verdict.CONTRADICTED, FindingKind.NUMBER_MISMATCH),
    ("The program permanently eliminated unemployment.", "The report measured unemployment falling during a two year period.", Verdict.PARTIALLY_SUPPORTED, FindingKind.QUALIFIER_GAP),
]


@pytest.mark.parametrize("claim,evidence,verdict,kind", ACCEPTANCE)
async def test_acceptance_scenarios(claim: str, evidence: str, verdict: Verdict, kind: FindingKind):
    result = await RuleBasedVerificationEngine().evaluate(claim, _p(evidence))
    assert result.verdict == verdict
    assert kind in {f.kind for f in result.findings}
    assert result.source_grounded is not None
    assert result.claim_analysis is not None


async def test_numbers_present_anywhere_in_evidence_are_not_conflicts():
    result = await RuleBasedVerificationEngine().evaluate(
        "Revenue grew 10% in 2023",
        _p("Revenue grew 40% in 2022.", "In 2023, revenue grew 10%."),
    )
    assert result.verdict == Verdict.SUPPORTED
    assert not any(f.conflict for f in result.findings)


async def test_percent_words_and_thousand_separators_normalise():
    result = await RuleBasedVerificationEngine().evaluate(
        "Recovery was 40% faster among 1200 patients",
        _p("Recovery was 40 percent faster among 1,200 patients."),
    )
    assert result.verdict == Verdict.SUPPORTED
    assert not any(f.conflict for f in result.findings)


async def test_unrelated_evidence_has_no_source_statement():
    result = await RuleBasedVerificationEngine().evaluate("The drug is safe.", _p("Bananas are yellow."))
    assert result.source_grounded is not None
    assert result.source_grounded.source_grounded_statement == ""
    assert "does not address" in result.source_grounded.source_limitations
    assert result.evidence_references == []


async def test_partial_support_separates_supported_and_unsupported():
    result = await RuleBasedVerificationEngine().evaluate(
        "The treatment reduced recovery time by 40% and proves that the treatment caused the improvement.",
        _p("The study observed a 40% difference in recovery time but describes the relationship as observational."),
    )
    assert result.verdict == Verdict.PARTIALLY_SUPPORTED
    sg = result.source_grounded
    assert sg is not None
    assert sg.supported_parts and sg.unsupported_parts and sg.source_limitations
    assert "causation" in sg.unsupported_parts


async def test_contradiction_reference_carries_the_source_quote():
    result = await RuleBasedVerificationEngine().evaluate(
        "The study involved 10,000 participants.",
        [EvidencePassage(ref="e1", content="Intro text. The study involved 1,200 participants.", document_id="d1", page=7)],
    )
    [ref] = result.evidence_references
    assert ref.document_id == "d1" and ref.page == 7
    assert ref.quote == "The study involved 1,200 participants."
    assert ref.role.value == "contradicts"


def test_claim_analysis_extracts_structure():
    analysis = analyze_claim("The study proves that Drug X causes patients to recover 40% faster in 2021.")
    assert analysis.causal
    assert analysis.quantitative
    assert analysis.assertion_strength == AssertionStrength.ABSOLUTE
    assert "Drug X" in analysis.entities
    assert analysis.numbers == ("40%",)
    assert analysis.dates == ("2021",)
    assert not analysis.negated
    assert analyze_claim("The drug is not safe").negated


def test_decisive_verdict_only_for_hard_cases():
    assert analyze("The drug is safe.", _p("It is false that the drug is safe.")).decisive_verdict() == Verdict.CONTRADICTED
    assert analyze("The earth is round", _p("The earth is round")).decisive_verdict() == Verdict.SUPPORTED
    assert analyze("The earth is round and blue and large", _p("The earth is round")).decisive_verdict() is None
    assert analyze("The drug is safe.", _p("Bananas are yellow.")).decisive_verdict() is None


def test_locate_quote_returns_stored_source_text():
    source = "The  study\ninvolved 1,200 Participants across three sites."
    assert locate_quote(source, "study involved 1,200 participants") == "study\ninvolved 1,200 Participants"
    assert locate_quote(source, "involved 9,999 participants") is None
    assert locate_quote(source, "study") is None
