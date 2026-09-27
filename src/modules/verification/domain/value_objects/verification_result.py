from __future__ import annotations

from dataclasses import dataclass, field

from modules.verification.domain.value_objects.analysis_metadata import AnalysisMetadata
from modules.verification.domain.value_objects.claim_analysis import ClaimAnalysis
from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.deterministic_finding import DeterministicFinding
from modules.verification.domain.value_objects.evidence_reference import EvidenceReference
from modules.verification.domain.value_objects.verdict import Verdict
from shared.domain.value_object import ValueObject


@dataclass(frozen=True)
class VerificationResult(ValueObject):
    verdict: Verdict
    confidence: Confidence
    reasoning: str
    source_grounded_statement: str = ""
    why_claim_does_not_match: str = ""
    unsupported_parts: str = ""
    source_limitations: str = ""
    supported_parts: str = ""
    conclusion: str = ""
    claim_analysis: ClaimAnalysis | None = None
    findings: tuple[DeterministicFinding, ...] = ()
    evidence_references: tuple[EvidenceReference, ...] = ()
    analysis: AnalysisMetadata | None = None
    evidence_refs: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.evidence_refs and self.evidence_references:
            ids: list[str] = []
            for ref in self.evidence_references:
                if ref.evidence_id not in ids:
                    ids.append(ref.evidence_id)
            object.__setattr__(self, "evidence_refs", ids)

    def __hash__(self) -> int:
        return hash((self.verdict, self.confidence, self.reasoning, tuple(self.evidence_refs)))
