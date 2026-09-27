import type { ClaimStatus, ProcessingStatus, Verdict } from "./types";
import type { Theme } from "./theme";

const dt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const d = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const pct = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 });

export const formatDateTime = (iso: string) => dt.format(new Date(iso));
export const formatDate = (iso: string) => d.format(new Date(iso));
export const formatPercent = (v: number) => pct.format(v);
export const formatNumber = (v: number) => new Intl.NumberFormat().format(v);
export function truncate(text: string, max = 140): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "Supported",
  partially_supported: "Partially supported",
  contradicted: "Contradicted",
  insufficient_evidence: "Insufficient evidence",
};

export const VERDICT_DESCRIPTION: Record<Verdict, string> = {
  supported: "The evidence directly supports the essential proposition in the claim.",
  partially_supported: "Part of the claim is supported, but the evidence does not establish all of it.",
  contradicted: "The evidence materially conflicts with the claim.",
  insufficient_evidence: "The evidence does not contain enough relevant information to establish or contradict the claim.",
};

export function verdictColors(t: Theme, v: Verdict | null): { fg: string; bg: string } {
  switch (v) {
    case "supported": return { fg: t.supported, bg: t.supportedSoft };
    case "partially_supported": return { fg: t.partial, bg: t.partialSoft };
    case "contradicted": return { fg: t.contradicted, bg: t.contradictedSoft };
    case "insufficient_evidence": return { fg: t.insufficient, bg: t.insufficientSoft };
    default: return { fg: t.inkSecondary, bg: t.surfaceMuted };
  }
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "Ready to verify", analyzing: "Verifying", verified: "Supported", rejected: "Contradicted", unverified: "Insufficient evidence", failed: "Verification failed",
};
export const PROCESSING_LABEL: Record<ProcessingStatus, string> = { uploaded: "Uploaded", processing: "Processing", processed: "Ready", failed: "Failed" };
