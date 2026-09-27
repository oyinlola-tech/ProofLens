from __future__ import annotations

import time

from modules.ai.application.provider import AiProviderError, InferenceProvider
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt
from modules.verification.domain.services.verification_engine import (
    EngineVerdict,
    EvidencePassage,
    ReasoningUnavailableError,
    SourceGroundedResult,
    VerificationEngine,
)
from modules.verification.domain.value_objects.analysis_metadata import (
    AnalysisMetadata,
    AnalysisMode,
)
from modules.verification.domain.value_objects.claim_analysis import (
    AssertionStrength,
    ClaimAnalysis,
)
from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.deterministic_finding import FindingKind
from modules.verification.domain.value_objects.evidence_reference import (
    EvidenceReference,
    ReferenceRole,
)
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.infrastructure.llm.prompt import (
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    format_checks,
    format_evidence,
    sanitize,
)
from modules.verification.infrastructure.llm.provenance import validate_references
from modules.verification.infrastructure.llm.schema import (
    RESPONSE_SCHEMA,
    AiVerificationResponse,
    MalformedAiResponseError,
    parse_ai_response,
)
from modules.verification.infrastructure.rules.deterministic_analysis import (
    STRONG_RELEVANCE,
    DeterministicReport,
    analyze,
)
from modules.verification.infrastructure.rules.rule_based_engine import (
    RuleBasedVerificationEngine,
)
from shared.infrastructure.logger import get_logger

logger = get_logger(__name__)

_CHARS_PER_TOKEN = 4
_HARD_CONFLICTS = {
    FindingKind.NUMBER_MISMATCH,
    FindingKind.DATE_MISMATCH,
    FindingKind.ENTITY_MISMATCH,
}


def _join(*parts: str) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


class LlmVerificationEngine(VerificationEngine):
    """Deterministic analysis first, then structured AI reasoning, then backend aggregation."""

    def __init__(
        self,
        provider: InferenceProvider,
        model: Model,
        fallback: RuleBasedVerificationEngine,
        max_passages: int,
        max_prompt_tokens: int,
        malformed_retries: int = 1,
        fallback_models: tuple[Model, ...] = (),
    ) -> None:
        self._provider = provider
        self._model = model
        # Tried in order when the previous model is unavailable, times out, or keeps
        # returning unusable output.
        self._models = (model, *(m for m in fallback_models if m.name != model.name))
        self._fallback = fallback
        self._max_passages = max_passages
        self._max_prompt_chars = max_prompt_tokens * _CHARS_PER_TOKEN
        self._malformed_retries = malformed_retries

    async def evaluate(
        self, claim_text: str, evidence: list[EvidencePassage]
    ) -> EngineVerdict:
        report = analyze(claim_text, evidence)
        if not evidence or not report.claim_content:
            return self._fallback.verdict_from_report(claim_text, report)

        prompt = self._build_prompt(claim_text, report, evidence)
        started = time.monotonic()
        failure = ""
        usage: dict[str, int] = {}
        parsed: AiVerificationResponse | None = None
        model = self._model
        for model in self._models:
            parsed, usage, failure = await self._try_model(model, prompt)
            if parsed is not None:
                break
            logger.warning(
                "ai model failed provider=%s model=%s kind=%s",
                self._provider.name, model.name, failure,
            )
        duration_ms = int((time.monotonic() - started) * 1000)

        if parsed is None:
            logger.warning(
                "ai verification failed provider=%s models=%d kind=%s duration_ms=%d",
                self._provider.name, len(self._models), failure, duration_ms,
            )
            return self._deterministic_or_raise(claim_text, report, failure, duration_ms)

        references = validate_references(parsed.evidence_references, evidence)
        metadata = AnalysisMetadata(
            mode=AnalysisMode.AI,
            provider=self._provider.name,
            model=model.name,
            duration_ms=duration_ms,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
        )
        verdict = aggregate(claim_text, report, parsed, references, metadata)
        logger.info(
            "ai verification provider=%s model=%s verdict=%s ai_verdict=%s confidence=%.2f "
            "references=%d findings=%d duration_ms=%d prompt_tokens=%d completion_tokens=%d",
            self._provider.name, model.name, verdict.verdict.value, parsed.verdict.value,
            verdict.confidence.value, len(references), len(report.findings), duration_ms,
            metadata.prompt_tokens, metadata.completion_tokens,
        )
        return verdict

    async def _try_model(
        self, model: Model, prompt: Prompt
    ) -> tuple[AiVerificationResponse | None, dict[str, int], str]:
        """One model, retrying malformed output. Returns (parsed, usage, failure kind)."""
        usage: dict[str, int] = {}
        failure = ""
        for attempt in range(1, self._malformed_retries + 2):
            try:
                result = await self._provider.complete_structured(model, prompt, RESPONSE_SCHEMA)
            except AiProviderError as e:
                return None, usage, e.kind
            except Exception as e:
                return None, usage, f"error:{type(e).__name__}"
            usage = result.usage
            try:
                return parse_ai_response(result.content), usage, ""
            except MalformedAiResponseError as e:
                failure = "malformed_output"
                logger.warning(
                    "ai output rejected provider=%s model=%s reason=%s attempt=%d",
                    self._provider.name, model.name, e, attempt,
                )
        return None, usage, failure

    def _build_prompt(
        self, claim_text: str, report: DeterministicReport, evidence: list[EvidencePassage]
    ) -> Prompt:
        budget = self._max_prompt_chars - len(USER_TEMPLATE) - len(SYSTEM_PROMPT) - len(claim_text)
        return Prompt(
            system=SYSTEM_PROMPT,
            template=USER_TEMPLATE,
            variables={
                "claim": sanitize(claim_text),
                "checks": format_checks(report.findings),
                "evidence": format_evidence(evidence, self._max_passages, max(budget, 0)),
            },
        )

    def _deterministic_or_raise(
        self, claim_text: str, report: DeterministicReport, failure: str, duration_ms: int
    ) -> EngineVerdict:
        decisive = report.decisive_verdict()
        if decisive is None:
            raise ReasoningUnavailableError(self._provider.name, failure or "error")
        rules = self._fallback.verdict_from_report(claim_text, report)
        return EngineVerdict(
            verdict=rules.verdict,
            confidence=rules.confidence,
            reasoning=f"{rules.reasoning} (deterministic result; AI reasoning unavailable)",
            source_grounded=rules.source_grounded,
            evidence_refs=rules.evidence_refs,
            evidence_references=rules.evidence_references,
            findings=rules.findings,
            claim_analysis=rules.claim_analysis,
            analysis=AnalysisMetadata(
                mode=AnalysisMode.DETERMINISTIC,
                provider=self._provider.name,
                model=self._model.name,
                duration_ms=duration_ms,
                failure=failure,
            ),
        )


def _merge_claim_analysis(claim_text: str, report: DeterministicReport, ai: AiVerificationResponse) -> ClaimAnalysis:
    det = report.claim_analysis
    strength = AssertionStrength(ai.claim_analysis.assertion_strength)
    if det.assertion_strength == AssertionStrength.ABSOLUTE:
        strength = AssertionStrength.ABSOLUTE
    entities = list(det.entities)
    for e in ai.claim_analysis.entities:
        if e.lower() not in {x.lower() for x in entities}:
            entities.append(e)
    return ClaimAnalysis(
        subject=ai.claim_analysis.subject or det.subject,
        proposition=ai.claim_analysis.proposition or claim_text.strip(),
        assertion_strength=strength,
        causal=det.causal or ai.claim_analysis.causal,
        quantitative=det.quantitative or ai.claim_analysis.quantitative,
        negated=det.negated,
        entities=tuple(entities),
        numbers=det.numbers,
        dates=det.dates,
    )


def aggregate(
    claim_text: str,
    report: DeterministicReport,
    ai: AiVerificationResponse,
    references: list[EvidenceReference],
    metadata: AnalysisMetadata,
) -> EngineVerdict:
    """Combine deterministic findings with validated AI reasoning; the backend decides the verdict."""
    verdict = ai.verdict
    confidence = ai.confidence
    why = ai.why_claim_does_not_match
    limitations = ai.source_limitations
    unsupported = ai.unsupported_parts
    notes: list[str] = []
    best = report.best

    if not references and best is not None and report.relevant:
        role = ReferenceRole.CONTRADICTS if verdict == Verdict.CONTRADICTED else ReferenceRole.SUPPORTS
        references = [
            EvidenceReference(
                evidence_id=best.ref,
                document_id=best.document_id,
                page=best.page,
                quote=best.text,
                role=role,
            )
        ]

    if not references and verdict != Verdict.INSUFFICIENT_EVIDENCE:
        verdict = Verdict.INSUFFICIENT_EVIDENCE
        confidence = min(confidence, 0.3)
        notes.append(
            "No cited passage could be traced to the supplied evidence, so the result is "
            "limited to insufficient evidence."
        )
        why = _join(
            why,
            "The reasoning did not cite any passage that exists in the supplied evidence.",
        )

    hard = [f for f in report.conflicts if f.kind in _HARD_CONFLICTS]
    negations = [f for f in report.conflicts if f.kind == FindingKind.NEGATION_CONFLICT]
    if hard and verdict in (Verdict.SUPPORTED, Verdict.PARTIALLY_SUPPORTED):
        descriptions = " ".join(f.description for f in hard)
        if report.relevance >= STRONG_RELEVANCE:
            verdict = Verdict.CONTRADICTED
            confidence = min(confidence, round(report.relevance * 0.85, 2))
            notes.append("Deterministic checks found a material conflict with the source figures.")
        else:
            verdict = Verdict.PARTIALLY_SUPPORTED
            confidence = min(confidence, round(report.relevance * 0.6, 2))
            notes.append("Deterministic checks found figures that differ from the claim.")
        why = _join(why, descriptions)
        references = [
            EvidenceReference(r.evidence_id, r.document_id, r.page, r.quote, ReferenceRole.CONTRADICTS)
            if verdict == Verdict.CONTRADICTED
            else r
            for r in references
        ]

    if negations and verdict == Verdict.SUPPORTED:
        confidence = min(confidence, 0.5)
        limitations = _join(
            limitations,
            "A deterministic negation check found opposite polarity between the claim and the "
            f"cited passage: {negations[0].description}",
        )
        notes.append("Deterministic negation check disagrees with the reasoning; confidence capped.")

    if report.qualifier_gaps and verdict == Verdict.SUPPORTED:
        verdict = Verdict.PARTIALLY_SUPPORTED
        confidence = min(confidence, 0.7)
        gap_text = " ".join(g.description for g in report.qualifier_gaps)
        why = _join(why, gap_text)
        unsupported = _join(unsupported, gap_text)
        limitations = _join(
            limitations,
            " ".join(
                dict.fromkeys(
                    "The source does not establish causation."
                    if g.claim_value == "causation"
                    else f"The source does not establish \"{g.claim_value}\"."
                    for g in report.qualifier_gaps
                    if g.claim_value
                )
            ),
        )
        notes.append("Deterministic qualifier check limits the result to partial support.")

    if verdict == Verdict.INSUFFICIENT_EVIDENCE and not report.relevant:
        why = why or (
            "The supplied source does not contain relevant evidence establishing or "
            "contradicting the claim."
        )

    conclusion = ai.conclusion or ai.source_grounded_statement
    reasoning = _join(ai.summary, " ".join(notes))
    if not why and verdict != Verdict.SUPPORTED:
        why = " ".join(f.description for f in ai.findings if f.kind != "supported_component")

    return EngineVerdict(
        verdict=verdict,
        confidence=Confidence(value=round(max(0.0, min(confidence, 1.0)), 2)),
        reasoning=reasoning or "No reasoning provided",
        source_grounded=SourceGroundedResult(
            source_grounded_statement=ai.source_grounded_statement,
            why_claim_does_not_match=why,
            unsupported_parts=unsupported,
            source_limitations=limitations,
            supported_parts=ai.supported_parts,
            conclusion=conclusion,
        ),
        evidence_refs=[r.evidence_id for r in references],
        evidence_references=references,
        findings=list(report.findings),
        claim_analysis=_merge_claim_analysis(claim_text, report, ai),
        analysis=metadata,
    )
