import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { apiRequest } from "@/lib/api/server";
import type { Claim, Document, VerificationSummary } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/format";
import { ClaimStatusBadge, ProcessingBadge, VerdictBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { ClaimComposer } from "@/components/workspace/ClaimComposer";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const welcome = sp.welcome === "1";
  const [claims, verifications, documents] = await Promise.all([
    apiRequest<Claim[]>("/claims/?limit=6", { redirectOnExpiry: true }),
    apiRequest<VerificationSummary[]>("/verification/?limit=5", { redirectOnExpiry: true }),
    apiRequest<Document[]>("/documents/?limit=5", { redirectOnExpiry: true }),
  ]);
  const inProgress = claims.filter((c) => c.status === "analyzing");
  const ready = claims.filter((c) => c.status === "pending");

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">{welcome ? "Welcome to ProofLens" : "Start a verification"}</h1>
          <p className="mt-1.5 text-sm text-ink-secondary md:text-base">Enter the claim first. Evidence comes next.</p>
        </div>
        <ClaimComposer compact />
      </section>

      {inProgress.length > 0 ? (
        <section aria-labelledby="in-progress">
          <h2 id="in-progress" className="text-base font-semibold text-ink">Verifying now</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {inProgress.map((c) => (
              <li key={c.id}>
                <Link href={`/app/claims/${c.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-surface-muted/60">
                  <span className="min-w-0 truncate text-sm text-ink">{truncate(c.text, 120)}</span>
                  <ClaimStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="recent-results" className="min-w-0">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-results" className="text-base font-semibold text-ink">Recent results</h2>
            <Link href="/app/history" className="text-sm text-ink-secondary hover:text-ink">All history</Link>
          </div>
          {verifications.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No results yet" body="Your first verdict will appear here with a link back to its evidence." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {verifications.map((v) => (
                <li key={v.id}>
                  <Link href={`/app/verifications/${v.id}`} className="flex flex-col gap-1.5 py-3 hover:bg-surface-muted/60">
                    <span className="line-clamp-2 text-sm text-ink">{v.claim_text}</span>
                    <span className="flex items-center gap-3 text-xs text-ink-tertiary">
                      <VerdictBadge verdict={v.verdict} />
                      <span className="tabular">{v.evidence_count} {v.evidence_count === 1 ? "source" : "sources"}</span>
                      <span>{formatDate(v.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ready-claims" className="min-w-0">
          <div className="flex items-baseline justify-between">
            <h2 id="ready-claims" className="text-base font-semibold text-ink">Claims to finish</h2>
            <Link href="/app/claims" className="text-sm text-ink-secondary hover:text-ink">All claims</Link>
          </div>
          {ready.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Nothing waiting" body="Claims you have created but not yet verified will show up here so you can pick them back up." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {ready.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/claims/${c.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-surface-muted/60">
                    <span className="min-w-0 line-clamp-2 text-sm text-ink">{c.text}</span>
                    <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-ink-tertiary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recent-docs">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-docs" className="text-base font-semibold text-ink">Recent documents</h2>
          <Link href="/app/documents" className="text-sm text-ink-secondary hover:text-ink">All documents</Link>
        </div>
        {documents.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No documents uploaded"
              body="Upload a PDF from a claim's evidence step. Processed documents can be reused across claims."
              action={<LinkButton href="/app/claims/new" variant="secondary" size="sm">New verification</LinkButton>}
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {documents.map((d) => (
              <li key={d.id}>
                <Link href={`/app/documents/${d.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-surface-muted/60">
                  <span className="min-w-0 truncate text-sm text-ink">{d.filename}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-ink-tertiary">
                    <span className="uppercase">{d.document_type}</span>
                    <ProcessingBadge status={d.processing_status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
