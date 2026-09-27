import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut, CheckCircle, FileText, Scales, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { apiGetOrNull } from "@/lib/api/server";
import type { Document, EvidenceDetail, EvidenceReference, Finding, Verification } from "@/lib/api/types";
import { formatDateTime, truncate } from "@/lib/format";
import { verdictMeta } from "@/lib/verdict";
import { VerdictBadge } from "@/components/ui/Badge";
import { Confidence } from "@/components/ui/Confidence";
import { Notice } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Verification result" };

const FINDING_LABEL: Record<Finding["kind"], string> = {
  number_match: "Figure matches",
  number_mismatch: "Figure differs",
  date_match: "Date matches",
  date_mismatch: "Date differs",
  entity_mismatch: "Different entity",
  negation_conflict: "Negation conflict",
  qualifier_gap: "Stronger language than the source",
  exact_match: "Stated verbatim",
  low_relevance: "Evidence does not address the claim",
};

const ROLE_LABEL: Record<EvidenceReference["role"], string> = {
  supports: "Supports",
  contradicts: "Conflicts",
  context: "Context",
};

const ROLE_CLASS: Record<EvidenceReference["role"], string> = {
  supports: "border-supported/40 bg-supported-soft text-supported",
  contradicts: "border-contradicted/40 bg-contradicted-soft text-contradicted",
  context: "border-line bg-surface-muted text-ink-secondary",
};

function sourceHref(ref: EvidenceReference, evidence: EvidenceDetail | undefined, from: string): string | null {
  if (!ref.document_id) return null;
  const q = new URLSearchParams();
  if (ref.page) q.set("page", String(ref.page));
  const highlight = ref.quote || evidence?.content.slice(0, 300) || "";
  if (highlight) q.set("q", highlight.slice(0, 300));
  q.set("from", from);
  return `/app/documents/${ref.document_id}?${q.toString()}`;
}

export default async function VerificationPage({ params }: PageProps<"/app/verifications/[id]">) {
  const { id } = await params;
  const v = await apiGetOrNull<Verification>(`/verification/${id}`);
  if (!v) notFound();

  const docIds = Array.from(new Set(v.evidence_used.map((e) => e.source_document_id).filter((x): x is string => Boolean(x))));
  const docs = await Promise.all(docIds.map((d) => apiGetOrNull<Document>(`/documents/${d}`)));
  const docById = new Map<string, Document | null>(docIds.map((d, i) => [d, docs[i]]));
  const evidenceById = new Map(v.evidence_used.map((e) => [e.id, e]));
  const m = verdictMeta(v.verdict);
  const self = `/app/verifications/${v.id}`;
  const supported = v.verdict === "supported";
  const conflicts = v.findings.filter((f) => f.conflict);
  const checks = v.findings.filter((f) => !f.conflict);
  const referencedEvidence = new Set(v.evidence_references.map((r) => r.evidence_id));
  const unreferenced = v.evidence_used.filter((e) => !referencedEvidence.has(e.id));

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-sm text-ink-tertiary">Your claim</p>
        <h1 className="font-display mt-1 max-w-[40ch] text-2xl font-semibold leading-snug tracking-tight text-ink md:text-3xl">&ldquo;{v.claim_text}&rdquo;</h1>
        <p className="mt-3 text-sm text-ink-secondary">
          <Link href={`/app/claims/${v.claim_id}`} className="underline underline-offset-4 hover:text-ink">Open the claim</Link>
          <span className="mx-2 text-ink-tertiary">|</span>
          {v.completed_at ? `Completed ${formatDateTime(v.completed_at)}` : `Started ${formatDateTime(v.created_at)}`}
        </p>
        {v.claim_analysis ? (
          <ul className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="How ProofLens read the claim">
            <li className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-secondary">
              {v.claim_analysis.assertion_strength === "absolute" ? "Absolute language" : v.claim_analysis.assertion_strength === "hedged" ? "Hedged language" : "Direct statement"}
            </li>
            {v.claim_analysis.causal ? <li className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-secondary">Asserts causation</li> : null}
            {v.claim_analysis.negated ? <li className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-secondary">Negated</li> : null}
            {v.claim_analysis.numbers.map((n) => (
              <li key={`n-${n}`} className="tabular rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-ink-secondary">{n}</li>
            ))}
            {v.claim_analysis.dates.map((d) => (
              <li key={`d-${d}`} className="tabular rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-ink-secondary">{d}</li>
            ))}
            {v.claim_analysis.entities.slice(0, 6).map((e) => (
              <li key={`e-${e}`} className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-secondary">{e}</li>
            ))}
          </ul>
        ) : null}
      </header>

      {v.verdict === null ? (
        <Notice tone="info">This verification did not produce a verdict. Nothing was invented in its place. Return to the claim and try again.</Notice>
      ) : (
        <section aria-labelledby="verdict" className={`rounded-panel border ${m.ring} ${m.bg} p-6 md:p-8`}>
          <h2 id="verdict" className="sr-only">Verdict</h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <VerdictBadge verdict={v.verdict} size="lg" />
            <Confidence value={v.confidence} verdictText={m.text} />
          </div>
          <p className="mt-4 max-w-[64ch] text-base leading-relaxed text-ink">{v.reasoning || m.description}</p>
          <p className="mt-3 text-xs text-ink-tertiary">
            Confidence is how strongly the supplied evidence settles this claim, not the probability that the claim is true.
          </p>
        </section>
      )}

      <section aria-labelledby="what-source-says" className="rounded-panel border border-line bg-surface p-6 md:p-8">
        <h2 id="what-source-says" className="text-lg font-semibold text-ink">What the evidence says</h2>
        {v.source_grounded_statement ? (
          <blockquote className="mt-3 border-l-2 border-accent pl-4 text-base leading-relaxed text-ink">{v.source_grounded_statement}</blockquote>
        ) : v.verdict === "insufficient_evidence" ? (
          <p className="mt-3 text-base leading-relaxed text-ink-secondary">The supplied evidence does not address this claim, so there is no source statement to report.</p>
        ) : (
          <p className="mt-3 text-sm text-ink-secondary">No source grounded statement was produced for this verification.</p>
        )}
      </section>

      <section aria-labelledby="why" className="grid gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-7">
          <div>
            <h2 id="why" className="text-lg font-semibold text-ink">{supported ? "Why the claim is supported" : "Why the claim does not fully match"}</h2>
            {v.why_claim_does_not_match ? (
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink">{v.why_claim_does_not_match}</p>
            ) : supported && v.supported_parts ? (
              <p className="mt-3 text-base leading-relaxed text-ink">{v.supported_parts}</p>
            ) : supported ? (
              <p className="mt-3 text-base leading-relaxed text-ink">The evidence directly supports the essential proposition of the claim.</p>
            ) : (
              <p className="mt-3 text-sm text-ink-secondary">No explanation was returned for this verification.</p>
            )}

            {(v.supported_parts && !supported) || v.unsupported_parts ? (
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {v.supported_parts && !supported ? (
                  <div className="rounded-control border border-supported/30 bg-supported-soft/60 p-4">
                    <dt className="flex items-center gap-1.5 text-sm font-semibold text-supported">
                      <CheckCircle size={16} weight="bold" aria-hidden="true" /> Supported portion
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink">{v.supported_parts}</dd>
                  </div>
                ) : null}
                {v.unsupported_parts ? (
                  <div className="rounded-control border border-partial/30 bg-partial-soft/60 p-4">
                    <dt className="flex items-center gap-1.5 text-sm font-semibold text-partial">
                      <WarningCircle size={16} weight="bold" aria-hidden="true" /> Unsupported portion
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink">{v.unsupported_parts}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>

          {v.source_limitations ? (
            <div>
              <h2 className="text-lg font-semibold text-ink">What the evidence does not establish</h2>
              <p className="mt-3 text-base leading-relaxed text-ink">{v.source_limitations}</p>
            </div>
          ) : null}

          {v.conclusion ? (
            <div className="rounded-panel border border-line bg-surface-muted p-5">
              <h2 className="text-lg font-semibold text-ink">What you can conclude from this evidence</h2>
              <p className="mt-3 text-base leading-relaxed text-ink">{v.conclusion}</p>
            </div>
          ) : null}

          {v.findings.length > 0 ? (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <Scales size={20} aria-hidden="true" className="text-ink-tertiary" /> Deterministic checks
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">Figures, dates, entities, negation and qualifiers compared directly, independent of the model.</p>
              <ul className="mt-3 flex flex-col gap-2">
                {[...conflicts, ...checks].map((f, i) => (
                  <li key={`${f.kind}-${i}`} className={`rounded-control border p-3 text-sm ${f.conflict ? "border-contradicted/30 bg-contradicted-soft/50" : "border-line bg-surface"}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${f.conflict ? "text-contradicted" : "text-ink-tertiary"}`}>{FINDING_LABEL[f.kind] ?? f.kind}</p>
                    <p className="mt-1 leading-relaxed text-ink">{f.description}</p>
                    {f.claim_value && f.evidence_value ? (
                      <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-ink-tertiary">Claimed</dt>
                          <dd className="tabular mt-0.5 font-mono text-ink">{truncate(f.claim_value, 80)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-tertiary">Source</dt>
                          <dd className="tabular mt-0.5 font-mono text-ink">{truncate(f.evidence_value, 80)}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-ink-tertiary">
            {v.analysis?.mode === "ai"
              ? `Produced by deterministic checks and ${v.analysis.provider} (${v.analysis.model}) reasoning over the passages listed here only. Every reference was validated against the stored evidence before display.`
              : "Produced by deterministic checks over the passages listed here only. Model reasoning was not used for this result."}
          </p>
        </div>

        <div className="lg:col-span-5">
          <h2 className="text-lg font-semibold text-ink">Show me why</h2>
          <p className="mt-1 text-sm text-ink-secondary">The exact passages this conclusion rests on. Open the source to read them on the page they came from.</p>
          {v.evidence_used.length === 0 ? (
            <p className="mt-4 rounded-control bg-surface-muted px-4 py-3 text-sm text-ink-secondary">No evidence was attached when this verification ran.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-3">
              {v.evidence_references.map((ref, i) => {
                const evidence = evidenceById.get(ref.evidence_id);
                const doc = ref.document_id ? docById.get(ref.document_id) : null;
                const href = sourceHref(ref, evidence, self);
                return (
                  <li key={`${ref.evidence_id}-${i}`} className="rounded-panel border border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <FileText size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-tertiary" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium text-ink">{doc ? doc.filename : ref.document_id ? "Document no longer available" : "Pasted evidence"}</span>
                          {ref.page ? <span className="font-mono text-xs text-ink-tertiary tabular">page {ref.page}</span> : null}
                          {evidence?.source_section ? <span className="text-xs text-ink-tertiary">{evidence.source_section}</span> : null}
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_CLASS[ref.role]}`}>{ROLE_LABEL[ref.role]}</span>
                        </p>
                        <blockquote className={`mt-2 border-l-2 pl-3 text-sm leading-relaxed text-ink ${ref.role === "contradicts" ? "border-contradicted" : "border-supported"}`}>
                          {ref.quote ? `“${truncate(ref.quote, 400)}”` : evidence ? truncate(evidence.content, 320) : "Passage text unavailable."}
                        </blockquote>
                        {ref.quote && evidence && ref.quote.length < evidence.content.length ? (
                          <p className="mt-1.5 text-xs text-ink-tertiary">Quoted from the stored passage.</p>
                        ) : null}
                        {href && doc ? (
                          <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-4">
                            Open the source <ArrowSquareOut size={14} aria-hidden="true" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
              {unreferenced.map((e) => {
                const doc = e.source_document_id ? docById.get(e.source_document_id) : null;
                const q = new URLSearchParams();
                if (e.source_page) q.set("page", String(e.source_page));
                q.set("q", e.content.slice(0, 300));
                q.set("from", self);
                const href = e.source_document_id ? `/app/documents/${e.source_document_id}?${q.toString()}` : null;
                return (
                  <li key={e.id} className="rounded-panel border border-dashed border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <FileText size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-tertiary" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-medium text-ink">{doc ? doc.filename : e.source_document_id ? "Document no longer available" : "Pasted evidence"}</span>
                          {e.source_page ? <span className="font-mono text-xs text-ink-tertiary tabular">page {e.source_page}</span> : null}
                          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-tertiary">Considered, not cited</span>
                        </p>
                        <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-secondary">{truncate(e.content, 240)}</blockquote>
                        {href && doc ? (
                          <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-4">
                            Open the source <ArrowSquareOut size={14} aria-hidden="true" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <footer className="flex flex-wrap gap-3 border-t border-line pt-6">
        <LinkButton href={`/app/claims/${v.claim_id}`} variant="secondary">Back to the claim</LinkButton>
        <LinkButton href="/app/claims/new" variant="ghost">Verify another claim</LinkButton>
      </footer>
    </div>
  );
}
