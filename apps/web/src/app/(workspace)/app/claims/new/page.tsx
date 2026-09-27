import type { Metadata } from "next";
import { ClaimComposer } from "@/components/workspace/ClaimComposer";
import { PageHeader } from "@/components/ui/Panel";

export const metadata: Metadata = { title: "New verification" };

export default async function NewClaimPage({ searchParams }: PageProps<"/app/claims/new">) {
  const sp = await searchParams;
  const documentId = typeof sp.document === "string" ? sp.document : undefined;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="New verification"
        description="Start with the claim. You will add evidence in the next step, then run the verification."
      />
      <ClaimComposer documentId={documentId} />
      <ol className="grid gap-3 border-t border-line pt-6 text-sm text-ink-secondary sm:grid-cols-3">
        <li><span className="font-medium text-ink">1. Claim.</span> The statement under test.</li>
        <li><span className="font-medium text-ink">2. Evidence.</span> PDFs or pasted passages.</li>
        <li><span className="font-medium text-ink">3. Verdict.</span> With the source page open.</li>
      </ol>
    </div>
  );
}
