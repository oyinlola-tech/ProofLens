import type { Metadata } from "next";
import Link from "next/link";
import { apiRequest } from "@/lib/api/server";
import type { Claim } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { ClaimStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Panel";

export const metadata: Metadata = { title: "Claims" };

const PAGE = 20;

export default async function ClaimsPage({ searchParams }: PageProps<"/app/claims">) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const claims = await apiRequest<Claim[]>(`/claims/?offset=${(page - 1) * PAGE}&limit=${PAGE}`, { redirectOnExpiry: true });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Claims"
        description="Every claim you have created, newest first. Open one to manage its evidence and verifications."
        actions={<LinkButton href="/app/claims/new" size="sm">New verification</LinkButton>}
      />
      {claims.length === 0 && page === 1 ? (
        <EmptyState
          title="No claims yet"
          body="A claim is the statement you want tested against evidence. Create one to begin."
          action={<LinkButton href="/app/claims/new" size="sm">Create your first claim</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {claims.map((c) => (
            <li key={c.id}>
              <Link href={`/app/claims/${c.id}`} className="grid gap-2 py-4 hover:bg-surface-muted/60 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                <span className="line-clamp-2 text-base text-ink">{c.text}</span>
                <ClaimStatusBadge status={c.status} />
                <span className="text-xs text-ink-tertiary">{formatDate(c.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={`/app/claims?page=${page - 1}`} className="text-ink-secondary hover:text-ink">Newer</Link> : <span />}
        {claims.length === PAGE ? <Link href={`/app/claims?page=${page + 1}`} className="text-ink-secondary hover:text-ink">Older</Link> : <span />}
      </nav>
    </div>
  );
}
