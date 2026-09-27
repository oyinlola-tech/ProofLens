import type { Metadata } from "next";
import Link from "next/link";
import { apiRequest } from "@/lib/api/server";
import type { VerificationSummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { VerdictBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Panel";

export const metadata: Metadata = { title: "History" };

const PAGE = 25;

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const items = await apiRequest<VerificationSummary[]>(`/verification/?offset=${(page - 1) * PAGE}&limit=${PAGE}`, { redirectOnExpiry: true });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Verification history" description="Every verification you have run, newest first. Each one keeps the evidence snapshot it used." />
      {items.length === 0 && page === 1 ? (
        <EmptyState
          title="No verifications yet"
          body="Run your first verification and the verdict, confidence, and evidence will be kept here."
          action={<LinkButton href="/app/claims/new" size="sm">Start a verification</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((v) => (
            <li key={v.id}>
              <Link href={`/app/verifications/${v.id}`} className="grid gap-2 py-4 hover:bg-surface-muted/60 md:grid-cols-[1fr_auto_auto_auto] md:items-center md:gap-6">
                <span className="line-clamp-2 text-base text-ink">{v.claim_text}</span>
                <VerdictBadge verdict={v.verdict} />
                <span className="tabular text-xs text-ink-tertiary">{v.evidence_count} {v.evidence_count === 1 ? "source" : "sources"}</span>
                <span className="text-xs text-ink-tertiary">{formatDateTime(v.completed_at ?? v.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={`/app/history?page=${page - 1}`} className="text-ink-secondary hover:text-ink">Newer</Link> : <span />}
        {items.length === PAGE ? <Link href={`/app/history?page=${page + 1}`} className="text-ink-secondary hover:text-ink">Older</Link> : <span />}
      </nav>
    </div>
  );
}
