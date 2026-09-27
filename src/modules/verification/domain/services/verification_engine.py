from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from modules.verification.domain.value_objects.analysis_metadata import AnalysisMetadata
from modules.verification.domain.value_objects.claim_analysis import ClaimAnalysis
from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.deterministic_finding import DeterministicFinding
from modules.verification.domain.value_objects.evidence_reference import EvidenceReference
from modules.verification.domain.value_objects.verdict import Verdict


@dataclass(frozen=True)
class EvidencePassage:
    ref: str
    content: str
    document_id: str | None = None
    page: int | None = None
    section: str | None = None


@dataclass(frozen=True)
class SourceGroundedResult:
    source_grounded_statement: str = ""
    why_claim_does_not_match: str = ""
    unsupported_parts: str = ""
    source_limitations: str = ""
    supported_parts: str = ""
    conclusion: str = ""


@dataclass(frozen=True)
class EngineVerdict:
    verdict: Verdict
    confidence: Confidence
    reasoning: str
    source_grounded: SourceGroundedResult | None = field(default=None, hash=False)
    evidence_refs: list[str] = field(default_factory=list, hash=False)
    evidence_references: list[EvidenceReference] = field(default_factory=list, hash=False)
    findings: list[DeterministicFinding] = field(default_factory=list, hash=False)
    claim_analysis: ClaimAnalysis | None = field(default=None, hash=False)
    analysis: AnalysisMetadata | None = field(default=None, hash=False)


class ReasoningUnavailableError(Exception):
    """The configured reasoning provider could not produce a usable result.

    Raised instead of inventing a verdict; callers surface an unavailable state.
    """

    def __init__(self, provider: str, kind: str) -> None:
        self.provider = provider
        self.kind = kind
        super().__init__(f"{provider} reasoning {kind}")


class VerificationEngine(ABC):
    @abstractmethod
    async def evaluate(
        self, claim_text: str, evidence: list[EvidencePassage]
    ) -> EngineVerdict: ...
