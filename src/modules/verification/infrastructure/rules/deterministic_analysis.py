from __future__ import annotations

import re
from dataclasses import dataclass, field

from modules.verification.domain.services.verification_engine import EvidencePassage
from modules.verification.domain.value_objects.claim_analysis import (
    AssertionStrength,
    ClaimAnalysis,
)
from modules.verification.domain.value_objects.deterministic_finding import (
    DeterministicFinding,
    FindingKind,
)
from modules.verification.domain.value_objects.verdict import Verdict

STRONG_RELEVANCE = 0.7
MIN_RELEVANCE = 0.4

_TOKEN = re.compile(r"\d+(?:[.,]\d+)*%?|[a-z]+(?:'[a-z]+)?")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_YEAR = re.compile(r"^(?:1[89]|20)\d{2}$")
_ISO_DATE = re.compile(r"\b(?:1[89]|20)\d{2}-\d{2}-\d{2}\b")
_ENTITY = re.compile(r"\b[A-Z][A-Za-z0-9'-]*(?:\s+[A-Z][A-Za-z0-9'-]*)*")

_NEGATIONS = frozenset({
    "not", "no", "never", "none", "neither", "nor", "false", "untrue", "incorrect",
    "deny", "denies", "denied", "refute", "refutes", "refuted", "disproved", "disproves",
    "isn't", "aren't", "wasn't", "weren't", "doesn't", "don't", "didn't",
    "cannot", "can't", "won't", "hasn't", "haven't", "hadn't", "shouldn't",
})

_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into",
    "and", "or", "but", "if", "then", "that", "this", "these", "those", "it", "its",
    "has", "have", "had", "do", "does", "did", "will", "would", "can", "could",
    "should", "may", "might", "very", "indeed", "also", "which", "who", "what",
    "than", "there", "their", "they", "them", "between", "among", "during", "per",
})

_ENTITY_STARTERS = _STOPWORDS | frozenset({
    "according", "however", "although", "because", "while", "when", "after", "before",
    "our", "we", "he", "she", "i", "you", "his", "her", "each", "some", "many", "most",
})

_CAUSAL = re.compile(
    r"\b(?:cause[sd]?|causing|leads? to|led to|results? in|resulted in|due to|because of|"
    r"responsible for|triggers?|triggered)\b"
)
_ASSOCIATIVE = re.compile(
    r"\b(?:associated|association|correlat\w*|linked|links?|relationship|observed|"
    r"observational|coincided|accompanied)\b"
)
_HEDGES = re.compile(
    r"\b(?:may|might|could|suggest\w*|possibl\w+|likely|unlikely|estimat\w+|appear\w*|"
    r"potentially|approximately|roughly|preliminary|tentative\w*)\b"
)
_ABSOLUTES = re.compile(
    r"\b(?:always|never|permanently|eliminat\w+|guarantee\w*|completely|entirely|"
    r"definitely|certainly|prove[sdn]?|proven|universally|invariably)\b"
)
_QUALIFIER_WORDS = frozenset({
    "cause", "causes", "caused", "causing", "proves", "prove", "proved", "proven", "leads",
    "led", "results", "resulted", "due", "because", "responsible", "triggers", "triggered",
    "associated", "association", "correlated", "correlation", "correlates", "linked", "link",
    "links", "relationship", "observed", "observational", "suggests", "suggest", "suggested",
    "possible", "possibly", "likely", "unlikely", "estimated", "estimates", "estimate",
    "appears", "appear", "appeared", "potentially", "approximately", "roughly", "always",
    "never", "permanently", "eliminated", "eliminates", "guaranteed", "guarantees",
    "completely", "entirely", "definitely", "certainly", "universally", "invariably",
    "found", "reports", "reported", "states", "stated", "shows", "showed", "says", "said",
})


@dataclass(frozen=True)
class SentenceMatch:
    text: str
    ref: str
    tokens: tuple[str, ...]
    coverage: float
    document_id: str | None = None
    page: int | None = None


@dataclass
class DeterministicReport:
    claim_analysis: ClaimAnalysis
    claim_content: frozenset[str]
    findings: list[DeterministicFinding] = field(default_factory=list)
    best: SentenceMatch | None = None
    relevance: float = 0.0
    exact_match: bool = False
    missing_terms: tuple[str, ...] = ()

    @property
    def conflicts(self) -> list[DeterministicFinding]:
        return [f for f in self.findings if f.conflict]

    @property
    def qualifier_gaps(self) -> list[DeterministicFinding]:
        return [f for f in self.findings if f.kind == FindingKind.QUALIFIER_GAP]

    @property
    def relevant(self) -> bool:
        return self.best is not None and self.relevance >= MIN_RELEVANCE

    def decisive_verdict(self) -> Verdict | None:
        """A verdict deterministic analysis may issue alone when reasoning is unavailable."""
        if self.exact_match:
            return Verdict.SUPPORTED
        if self.conflicts and self.relevance >= STRONG_RELEVANCE:
            return Verdict.CONTRADICTED
        return None


def tokens(text: str) -> list[str]:
    raw = _TOKEN.findall(text.lower().replace("’", "'"))
    out: list[str] = []
    for tok in raw:
        if tok == "percent" and out and out[-1][0].isdigit() and not out[-1].endswith("%"):
            out[-1] = out[-1] + "%"
            continue
        out.append(tok)
    return out


def normalize(text: str) -> str:
    return " ".join(tokens(text))


def content_terms(toks: list[str] | tuple[str, ...]) -> set[str]:
    """Topical terms only: figures and dates are compared separately as findings."""
    return {
        t for t in toks
        if not t[0].isdigit()
        and t not in _STOPWORDS
        and t not in _NEGATIONS
        and t not in _QUALIFIER_WORDS
    }


def is_negated(toks: list[str] | tuple[str, ...]) -> bool:
    return any(t in _NEGATIONS for t in toks)


def _number_core(token: str) -> str:
    return token.replace(",", "").rstrip("%")


def numbers(toks: list[str] | tuple[str, ...]) -> list[str]:
    seen: list[str] = []
    for t in toks:
        if t[0].isdigit() and not _YEAR.match(t) and t not in seen:
            seen.append(t)
    return seen


def dates(text: str, toks: list[str] | tuple[str, ...]) -> list[str]:
    found: list[str] = []
    for t in toks:
        if _YEAR.match(t) and t not in found:
            found.append(t)
    for m in _ISO_DATE.findall(text):
        if m not in found:
            found.append(m)
    return found


def entities(text: str) -> list[str]:
    found: list[str] = []
    for match in _ENTITY.finditer(text):
        words = match.group(0).split()
        while words and words[0].lower() in _ENTITY_STARTERS:
            words.pop(0)
        if not words:
            continue
        if len(words) == 1 and (len(words[0]) < 2 or words[0].lower() in _QUALIFIER_WORDS):
            continue
        name = " ".join(words)
        if name not in found:
            found.append(name)
    return found


def analyze_claim(text: str) -> ClaimAnalysis:
    toks = tokens(text)
    lowered = text.lower()
    if _ABSOLUTES.search(lowered):
        strength = AssertionStrength.ABSOLUTE
    elif _HEDGES.search(lowered):
        strength = AssertionStrength.HEDGED
    else:
        strength = AssertionStrength.MODERATE
    ents = entities(text)
    nums = numbers(toks)
    return ClaimAnalysis(
        subject=ents[0] if ents else "",
        proposition=text.strip(),
        assertion_strength=strength,
        causal=bool(_CAUSAL.search(lowered)),
        quantitative=bool(nums),
        negated=is_negated(toks),
        entities=tuple(ents),
        numbers=tuple(nums),
        dates=tuple(dates(text, toks)),
    )


def _best_sentence(claim_content: set[str], evidence: list[EvidencePassage]) -> SentenceMatch | None:
    best: SentenceMatch | None = None
    for passage in evidence:
        for sentence in _SENTENCE_SPLIT.split(passage.content):
            sentence = sentence.strip()
            if not sentence:
                continue
            toks = tuple(tokens(sentence))
            coverage = len(claim_content & content_terms(toks)) / len(claim_content)
            if best is None or coverage > best.coverage:
                best = SentenceMatch(
                    text=sentence,
                    ref=passage.ref,
                    tokens=toks,
                    coverage=coverage,
                    document_id=passage.document_id,
                    page=passage.page,
                )
    return best


def _quote(values: list[str]) -> str:
    return ", ".join(values)


def analyze(claim_text: str, evidence: list[EvidencePassage]) -> DeterministicReport:
    claim_analysis = analyze_claim(claim_text)
    claim_tokens = tokens(claim_text)
    claim_content = content_terms(claim_tokens)
    report = DeterministicReport(claim_analysis=claim_analysis, claim_content=frozenset(claim_content))
    if not evidence or not claim_content:
        return report

    best = _best_sentence(claim_content, evidence)
    if best is None:
        return report
    report.best = best
    report.relevance = best.coverage
    report.missing_terms = tuple(sorted(claim_content - content_terms(best.tokens)))

    if best.coverage < MIN_RELEVANCE:
        report.findings.append(
            DeterministicFinding(
                kind=FindingKind.LOW_RELEVANCE,
                description="The supplied evidence does not address the claim's key terms: "
                + _quote(list(report.missing_terms)),
                claim_value=_quote(sorted(claim_content)),
                evidence_ref=best.ref,
            )
        )
        return report

    all_text = " ".join(p.content for p in evidence)
    all_tokens = tokens(all_text)
    findings = report.findings

    claim_nums = numbers(claim_tokens)
    evidence_nums_all = {_number_core(n) for n in numbers(all_tokens)}
    sentence_nums = numbers(best.tokens)
    for n in claim_nums:
        if _number_core(n) in evidence_nums_all:
            findings.append(
                DeterministicFinding(
                    kind=FindingKind.NUMBER_MATCH,
                    description=f"The source reports the same figure as the claim ({n}).",
                    claim_value=n,
                    evidence_value=n,
                    evidence_ref=best.ref,
                )
            )
        else:
            others = [s for s in sentence_nums if _number_core(s) not in {_number_core(c) for c in claim_nums}]
            if others:
                findings.append(
                    DeterministicFinding(
                        kind=FindingKind.NUMBER_MISMATCH,
                        description=f"The claim states {n}, while the source reports {_quote(others)}.",
                        claim_value=n,
                        evidence_value=_quote(others),
                        evidence_ref=best.ref,
                        conflict=True,
                    )
                )

    claim_dates = dates(claim_text, claim_tokens)
    evidence_dates_all = set(dates(all_text, all_tokens))
    sentence_dates = dates(best.text, best.tokens)
    for d in claim_dates:
        if d in evidence_dates_all:
            findings.append(
                DeterministicFinding(
                    kind=FindingKind.DATE_MATCH,
                    description=f"The source refers to the same date as the claim ({d}).",
                    claim_value=d,
                    evidence_value=d,
                    evidence_ref=best.ref,
                )
            )
        else:
            others = [s for s in sentence_dates if s not in claim_dates]
            if others:
                findings.append(
                    DeterministicFinding(
                        kind=FindingKind.DATE_MISMATCH,
                        description=f"The claim refers to {d}, while the source refers to {_quote(others)}.",
                        claim_value=d,
                        evidence_value=_quote(others),
                        evidence_ref=best.ref,
                        conflict=True,
                    )
                )

    lowered_all = all_text.lower()
    claim_entities = list(claim_analysis.entities)
    missing_entities = [e for e in claim_entities if e.lower() not in lowered_all]
    if missing_entities:
        sentence_entities = [
            e for e in entities(best.text) if e.lower() not in claim_text.lower()
        ]
        non_entity_content = claim_content - {
            t for e in claim_entities for t in tokens(e)
        }
        non_entity_coverage = (
            len(non_entity_content & content_terms(best.tokens)) / len(non_entity_content)
            if non_entity_content
            else 0.0
        )
        if sentence_entities and non_entity_coverage >= STRONG_RELEVANCE:
            findings.append(
                DeterministicFinding(
                    kind=FindingKind.ENTITY_MISMATCH,
                    description=(
                        f"The claim refers to {_quote(missing_entities)}, while the source "
                        f"refers to {_quote(sentence_entities)}."
                    ),
                    claim_value=_quote(missing_entities),
                    evidence_value=_quote(sentence_entities),
                    evidence_ref=best.ref,
                    conflict=True,
                )
            )

    if is_negated(claim_tokens) != is_negated(best.tokens):
        description = (
            f"The source negates the claim: it states \"{best.text}\""
            if is_negated(best.tokens)
            else f"The claim negates what the source states: \"{best.text}\""
        )
        findings.append(
            DeterministicFinding(
                kind=FindingKind.NEGATION_CONFLICT,
                description=description,
                claim_value=claim_text.strip(),
                evidence_value=best.text,
                evidence_ref=best.ref,
                conflict=True,
            )
        )

    sentence_lower = best.text.lower()
    if claim_analysis.causal and not _CAUSAL.search(sentence_lower):
        if _ASSOCIATIVE.search(sentence_lower) or _HEDGES.search(sentence_lower):
            findings.append(
                DeterministicFinding(
                    kind=FindingKind.QUALIFIER_GAP,
                    description=(
                        "The claim asserts causation, while the source describes an "
                        "association or a qualified observation without establishing cause."
                    ),
                    claim_value="causation",
                    evidence_value=_first_match(_ASSOCIATIVE, sentence_lower)
                    or _first_match(_HEDGES, sentence_lower),
                    evidence_ref=best.ref,
                )
            )
    if claim_analysis.assertion_strength == AssertionStrength.ABSOLUTE:
        claim_absolute = _first_match(_ABSOLUTES, claim_text.lower())
        if claim_absolute and claim_absolute not in sentence_lower:
            findings.append(
                DeterministicFinding(
                    kind=FindingKind.QUALIFIER_GAP,
                    description=(
                        f"The claim uses absolute language (\"{claim_absolute}\") that the "
                        "source does not use."
                    ),
                    claim_value=claim_absolute,
                    evidence_value=_first_match(_HEDGES, sentence_lower)
                    or _quote(sentence_nums),
                    evidence_ref=best.ref,
                )
            )
    if (
        claim_analysis.assertion_strength == AssertionStrength.MODERATE
        and not claim_analysis.causal
        and _HEDGES.search(sentence_lower)
        and not _HEDGES.search(claim_text.lower())
    ):
        findings.append(
            DeterministicFinding(
                kind=FindingKind.QUALIFIER_GAP,
                description=(
                    "The claim states the point as settled, while the source qualifies it "
                    f"(\"{_first_match(_HEDGES, sentence_lower)}\")."
                ),
                claim_value="unqualified statement",
                evidence_value=_first_match(_HEDGES, sentence_lower),
                evidence_ref=best.ref,
            )
        )

    if not report.conflicts and best.coverage == 1.0 and normalize(claim_text) in normalize(best.text):
        report.exact_match = True
        findings.append(
            DeterministicFinding(
                kind=FindingKind.EXACT_MATCH,
                description="The source explicitly states the same fact as the claim.",
                claim_value=claim_text.strip(),
                evidence_value=best.text,
                evidence_ref=best.ref,
            )
        )

    findings.sort(key=lambda f: (not f.conflict, f.kind != FindingKind.QUALIFIER_GAP))
    return report


def _first_match(pattern: re.Pattern[str], text: str) -> str:
    m = pattern.search(text)
    return m.group(0) if m else ""
