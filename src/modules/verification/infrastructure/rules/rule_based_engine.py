from __future__ import annotations

from modules.verification.domain.services.verification_engine import (
    EngineVerdict,
    EvidencePassage,
    SourceGroundedResult,
    VerificationEngine,
)
from modules.verification.domain.value_objects.analysis_metadata import (
    AnalysisMetadata,
    AnalysisMode,
)
from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.deterministic_finding import (
    DeterministicFinding,
    FindingKind,
)
from modules.verification.domain.value_objects.evidence_reference import (
    EvidenceReference,
    ReferenceRole,
)
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.infrastructure.rules.deterministic_analysis import (
    STRONG_RELEVANCE,
    DeterministicReport,
    analyze,
)

_DETERMINISTIC = AnalysisMetadata(mode=AnalysisMode.DETERMINISTIC)


def _conflict_reason(finding: DeterministicFinding) -> str:
    if finding.kind == FindingKind.NEGATION_CONFLICT:
        return "Relevant evidence negates the claim"
    if finding.kind == FindingKind.ENTITY_MISMATCH:
        return "Relevant evidence refers to a different entity"
    return "Relevant evidence reports different figures"


def _limitation(gap: DeterministicFinding) -> str:
    if gap.claim_value == "causation":
        return "The source does not establish causation; it reports an association or observation"
    if gap.claim_value == "unqualified statement":
        return "The source qualifies the point rather than stating it as settled"
    return f"The source does not establish \"{gap.claim_value}\""


def _sentences(items: list[str]) -> str:
    return " ".join(s if s.endswith((".", "!", "?")) else s + "." for s in items if s)


class RuleBasedVerificationEngine(VerificationEngine):
    """Deterministic verification: term relevance, negation, figures, dates, entities, qualifiers."""

    async def evaluate(
        self, claim_text: str, evidence: list[EvidencePassage]
    ) -> EngineVerdict:
        report = analyze(claim_text, evidence)
        return self.verdict_from_report(claim_text, report)

    def verdict_from_report(self, claim_text: str, report: DeterministicReport) -> EngineVerdict:
        analysis = report.claim_analysis
        if not report.claim_content:
            reason = "No evidence provided" if report.best is None and not report.findings else "Claim has no verifiable content"
            return EngineVerdict(
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                confidence=Confidence(value=0.0),
                reasoning=reason,
                claim_analysis=analysis,
                analysis=_DETERMINISTIC,
            )
        best = report.best
        if best is None:
            return EngineVerdict(
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                confidence=Confidence(value=0.0),
                reasoning="No evidence provided",
                claim_analysis=analysis,
                analysis=_DETERMINISTIC,
            )

        if not report.relevant:
            missing = ", ".join(report.missing_terms)
            return EngineVerdict(
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                confidence=Confidence(value=0.3),
                reasoning="Evidence does not address the claim",
                source_grounded=SourceGroundedResult(
                    why_claim_does_not_match=(
                        "The supplied source does not contain relevant evidence establishing "
                        "or contradicting the claim."
                    ),
                    source_limitations=f"The supplied source does not address: {missing}.",
                    conclusion=(
                        "The supplied source does not contain evidence that establishes or "
                        "contradicts the claim."
                    ),
                ),
                findings=list(report.findings),
                claim_analysis=analysis,
                analysis=_DETERMINISTIC,
            )

        reference_role = ReferenceRole.SUPPORTS
        conflicts = report.conflicts
        if conflicts:
            reference_role = ReferenceRole.CONTRADICTS
            scale = 0.85 if report.relevance >= STRONG_RELEVANCE else 0.6
            why = _sentences([f.description for f in conflicts])
            verdict = EngineVerdict(
                verdict=Verdict.CONTRADICTED,
                confidence=Confidence(value=round(report.relevance * scale, 2)),
                reasoning=_conflict_reason(conflicts[0]),
                source_grounded=SourceGroundedResult(
                    source_grounded_statement=f"The source states: {best.text}",
                    why_claim_does_not_match=why,
                    conclusion=f"According to the supplied source, {best.text} This conflicts with the claim.",
                ),
            )
        elif report.exact_match:
            verdict = EngineVerdict(
                verdict=Verdict.SUPPORTED,
                confidence=Confidence(value=0.9),
                reasoning="Claim directly matches evidence",
                source_grounded=SourceGroundedResult(
                    source_grounded_statement=best.text,
                    supported_parts="The source explicitly states the same fact.",
                    conclusion=f"According to the supplied source, {best.text}",
                ),
            )
        elif report.qualifier_gaps:
            gaps = report.qualifier_gaps
            limitations = _sentences(list(dict.fromkeys(_limitation(g) for g in gaps if g.claim_value)))
            verdict = EngineVerdict(
                verdict=Verdict.PARTIALLY_SUPPORTED,
                confidence=Confidence(value=round(report.relevance * 0.7, 2)),
                reasoning="Evidence addresses the claim but with weaker language than the claim uses",
                source_grounded=SourceGroundedResult(
                    source_grounded_statement=best.text,
                    supported_parts="The source addresses the subject and the reported observation.",
                    unsupported_parts=_sentences([g.description for g in gaps]),
                    why_claim_does_not_match="The claim is stated more strongly than the supplied source supports.",
                    source_limitations=limitations,
                    conclusion=f"According to the supplied source, {best.text} {limitations}".strip(),
                ),
            )
        elif report.relevance >= STRONG_RELEVANCE:
            verdict = EngineVerdict(
                verdict=Verdict.SUPPORTED,
                confidence=Confidence(value=round(report.relevance * 0.85, 2)),
                reasoning="Evidence covers the claim's key terms",
                source_grounded=SourceGroundedResult(
                    source_grounded_statement=best.text,
                    supported_parts="The source covers the essential elements of the claim.",
                    conclusion=f"According to the supplied source, {best.text}",
                ),
            )
        else:
            missing = ", ".join(report.missing_terms)
            verdict = EngineVerdict(
                verdict=Verdict.PARTIALLY_SUPPORTED,
                confidence=Confidence(value=round(report.relevance * 0.6, 2)),
                reasoning="Evidence covers some of the claim's key terms",
                source_grounded=SourceGroundedResult(
                    source_grounded_statement=best.text,
                    supported_parts="The source addresses part of the claim.",
                    unsupported_parts=f"The source does not address: {missing}.",
                    why_claim_does_not_match="The source establishes only part of what the claim asserts.",
                    source_limitations=f"The supplied source does not establish the complete claim; it does not mention: {missing}.",
                    conclusion=f"According to the supplied source, {best.text}",
                ),
            )

        reference = EvidenceReference(
            evidence_id=best.ref,
            document_id=best.document_id,
            page=best.page,
            quote=best.text,
            role=reference_role,
        )
        return EngineVerdict(
            verdict=verdict.verdict,
            confidence=verdict.confidence,
            reasoning=verdict.reasoning,
            source_grounded=verdict.source_grounded,
            evidence_refs=[best.ref],
            evidence_references=[reference],
            findings=list(report.findings),
            claim_analysis=analysis,
            analysis=_DETERMINISTIC,
        )
