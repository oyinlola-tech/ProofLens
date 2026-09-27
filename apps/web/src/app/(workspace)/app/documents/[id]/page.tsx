import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { apiGetOrNull, apiRequest } from "@/lib/api/server";
import type { Document, DocumentPages } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ProcessingBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { DocumentViewer } from "@/components/workspace/DocumentViewer";

export async function generateMetadata({ params }: PageProps<"/app/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  const doc = await apiGetOrNull<Document>(`/documents/${id}`);
  return { title: doc ? doc.filename : "Document" };
}

export default async function DocumentPage({ params, searchParams }: PageProps<"/app/documents/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const doc = await apiGetOrNull<Document>(`/documents/${id}`);
  if (!doc) notFound();

  const pages = doc.processing_status === "processed"
    ? await apiRequest<DocumentPages>(`/documents/${id}/pages`, { redirectOnExpiry: true })
    : null;
  const initialPage = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const highlight = typeof sp.q === "string" ? sp.q : undefined;
  const back = typeof sp.from === "string" && sp.from.startsWith("/app") ? sp.from : null;

  return (
    <div className="flex flex-col gap-6">
      {back ? (
        <Link href={back} className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Back to the verification
        </Link>
      ) : null}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-semibold tracking-tight text-ink md:text-3xl">{doc.filename}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-secondary">
            <span className="uppercase">{doc.document_type}</span>
            <span className="tabular">{formatNumber(doc.content_length)} characters</span>
            {pages ? <span className="tabular">{pages.total_pages} {pages.total_pages === 1 ? "page" : "pages"}</span> : null}
            <span>{formatDateTime(doc.created_at)}</span>
            <ProcessingBadge status={doc.processing_status} />
          </p>
        </div>
        <LinkButton href={`/app/claims/new?document=${doc.id}`} variant="secondary" size="sm">
          Use in a new verification
        </LinkButton>
      </header>

      {doc.processing_status === "failed" ? (
        <Notice>Processing failed for this document, so its text could not be extracted. Upload a different copy to use it as evidence.</Notice>
      ) : doc.processing_status !== "processed" ? (
        <Notice tone="info">This document is still being processed. Refresh in a moment.</Notice>
      ) : (
        <DocumentViewer pages={pages?.pages ?? []} initialPage={initialPage} highlight={highlight} basePath={`/app/documents/${doc.id}`} />
      )}
    </div>
  );
}
