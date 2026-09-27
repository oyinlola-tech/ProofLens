"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiRequest } from "@/lib/api/server";
import { toUserMessage } from "@/lib/api/errors";
import type { Claim, Document, Evidence } from "@/lib/api/types";

export interface ActionState {
  error?: string;
  fieldError?: string;
}

const CLAIM_MIN = 10;
const CLAIM_MAX = 10_000;

export async function createClaimAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get("text") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();
  if (text.length < CLAIM_MIN) return { fieldError: "Write a complete claim, at least a short sentence." };
  if (text.length > CLAIM_MAX) return { fieldError: `Keep the claim under ${CLAIM_MAX.toLocaleString()} characters.` };

  let claim: Claim;
  try {
    claim = await apiRequest<Claim>("/claims/", { method: "POST", body: { text } });
  } catch (e) {
    return { error: toUserMessage(e) };
  }
  revalidatePath("/app");
  revalidatePath("/app/claims");
  redirect(documentId ? `/app/claims/${claim.id}?document=${encodeURIComponent(documentId)}` : `/app/claims/${claim.id}`);
}

export async function addPastedEvidenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const claimId = String(formData.get("claim_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || "Pasted text";
  if (!claimId) return { error: "Missing claim." };
  if (content.length < 20) return { fieldError: "Paste at least a sentence or two of evidence." };
  if (content.length > 50_000) return { fieldError: "Evidence passages are limited to 50,000 characters." };

  try {
    // Pasted text is stored as a text document first so the evidence keeps a source reference.
    const doc = await apiRequest<Document>("/documents/", {
      method: "POST",
      body: { filename: label.slice(0, 255), content, document_type: "text" },
    });
    await apiRequest<Evidence>("/evidence/", {
      method: "POST",
      body: { claim_id: claimId, content, document_id: doc.id },
    });
  } catch (e) {
    return { error: toUserMessage(e) };
  }
  revalidatePath(`/app/claims/${claimId}`);
  revalidatePath("/app/documents");
  return {};
}

export async function addDocumentEvidenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const claimId = String(formData.get("claim_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const pageRaw = String(formData.get("page") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : null;

  if (!claimId || !documentId) return { error: "Missing claim or document." };
  if (content.length < 20) return { fieldError: "Select at least a sentence or two from the document." };
  if (content.length > 50_000) return { fieldError: "Evidence passages are limited to 50,000 characters." };
  if (page !== null && (!Number.isInteger(page) || page < 1)) return { fieldError: "Page must be a positive number." };

  try {
    await apiRequest<Evidence>("/evidence/", {
      method: "POST",
      body: {
        claim_id: claimId,
        content,
        document_id: documentId,
        page,
        section: section ? section.slice(0, 255) : null,
      },
    });
  } catch (e) {
    return { error: toUserMessage(e) };
  }
  revalidatePath(`/app/claims/${claimId}`);
  return {};
}

export async function removeEvidenceAction(evidenceId: string, claimId: string): Promise<ActionState> {
  try {
    await apiRequest(`/evidence/${evidenceId}`, { method: "DELETE" });
  } catch (e) {
    return { error: toUserMessage(e) };
  }
  revalidatePath(`/app/claims/${claimId}`);
  return {};
}
