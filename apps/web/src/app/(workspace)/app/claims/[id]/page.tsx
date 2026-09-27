import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNull, apiRequest } from "@/lib/api/server";
import type { Claim, Document, Evidence, VerificationSummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { ClaimStatusBadge } from "@/components/ui/Badge";
import { EvidencePanel } from "@/components/workspace/EvidencePanel";
import { VerifyPanel } from "@/components/workspace/VerifyPanel";

export const metadata: Metadata = { title: "Claim" };

export default async function ClaimPage({ params, searchParams }: PageProps<"/app/claims/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const claim = await apiGetOrNull<Claim>(`/claims/${id}`);
  if (!claim) notFound();

  const [evidence, documents, verifications] = await Promise.all([
    apiRequest<Evidence[]>(`/evidence/?claim_id=${claim.id}`, { redirectOnExpiry: true }),
    apiRequest<Document[]>("/documents/?limit=100", { redirectOnExpiry: true }),
    apiRequest<VerificationSummary[]>(`/verification/?claim_id=${claim.id}&limit=10`, { redirectOnExpiry: true }),
  ]);

  const documentNames: Record<string, string> = {};
  for (const d of documents) documentNames[d.id] = d.filename;
  // Evidence may reference documents beyond the first 100; resolve the rest individually.
  const missing = Array.from(new Set(evidence.map((e) => e.source_document_id).filter((x): x is string => Boolean(x) && !(x! in documentNames))));
  const extra = await Promise.all(missing.map((d) => apiGetOrNull<Document>(`/documents/${d}`)));
  extra.forEach((d, i) => { if (d) documentNames[missing[i]] = d.filename; });

  const readyCount = evidence.filter((e) => {
    if (!e.source_document_id) return true;
    const d = documents.find((x) => x.id === e.source_document_id);
    return !d || d.processing_status === "processed";
  }).length;
  const initialDocumentId = typeof sp.document === "string" ? sp.document : undefined;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="flex items-center gap-3 text-sm text-ink-tertiary">
          <span>Claim</span>
          <ClaimStatusBadge status={claim.status} />
          <span>{formatDateTime(claim.created_at)}</span>
        </p>
        <h1 className="font-display mt-2 max-w-[44ch] text-2xl font-semibold leading-snug tracking-tight text-ink md:text-3xl">&ldquo;{claim.text}&rdquo;</h1>
        <p className="mt-2 text-sm text-ink-secondary">The evidence below will be judged against exactly this wording. To change the claim, create a new one.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <EvidencePanel
            claimId={claim.id}
            evidence={evidence}
            documents={documents}
            documentNames={documentNames}
            initialDocumentId={initialDocumentId}
            locked={claim.status === "analyzing"}
          />
        </div>
        <div className="lg:col-span-4">
          <VerifyPanel claimId={claim.id} claimStatus={claim.status} evidenceCount={evidence.length} readyCount={readyCount} previous={verifications} />
        </div>
      </div>
    </div>
  );
}
