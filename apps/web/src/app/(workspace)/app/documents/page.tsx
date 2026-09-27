import type { Metadata } from "next";
import Link from "next/link";
import { apiRequest } from "@/lib/api/server";
import type { Document } from "@/lib/api/types";
import { formatDate, formatNumber } from "@/lib/format";
import { ProcessingBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Panel";

export const metadata: Metadata = { title: "Documents" };

const PAGE = 20;

export default async function DocumentsPage({ searchParams }: PageProps<"/app/documents">) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const documents = await apiRequest<Document[]>(`/documents/?offset=${(page - 1) * PAGE}&limit=${PAGE}`, { redirectOnExpiry: true });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Documents"
        description="Uploaded files and pasted passages. Processed documents can be attached as evidence to any claim."
        actions={<LinkButton href="/app/claims/new" size="sm">New verification</LinkButton>}
      />
      {documents.length === 0 && page === 1 ? (
        <EmptyState
          title="No documents uploaded"
          body="Documents are added from a claim's evidence step. Upload a PDF or paste a passage there."
          action={<LinkButton href="/app/claims/new" size="sm">Start a verification</LinkButton>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-y border-line text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-tertiary">
                <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                <th scope="col" className="py-2 pr-4 font-medium">Type</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Characters</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-surface-muted/60">
                  <td className="max-w-[24rem] py-3 pr-4">
                    <Link href={`/app/documents/${d.id}`} className="block truncate font-medium text-ink">{d.filename}</Link>
                  </td>
                  <td className="py-3 pr-4 uppercase text-ink-secondary">{d.document_type}</td>
                  <td className="tabular py-3 pr-4 text-right text-ink-secondary">{formatNumber(d.content_length)}</td>
                  <td className="py-3 pr-4"><ProcessingBadge status={d.processing_status} /></td>
                  <td className="py-3 text-ink-secondary">{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={`/app/documents?page=${page - 1}`} className="text-ink-secondary hover:text-ink">Newer</Link> : <span />}
        {documents.length === PAGE ? <Link href={`/app/documents?page=${page + 1}`} className="text-ink-secondary hover:text-ink">Older</Link> : <span />}
      </nav>
    </div>
  );
}
