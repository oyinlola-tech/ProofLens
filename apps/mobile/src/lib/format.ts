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

// "verified" covers both supported and partially supported on the backend, so it is
// labelled neutrally here. Screens show the real verdict wherever one is known.
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "Needs a check", analyzing: "Checking", verified: "Checked", rejected: "Contradicted", unverified: "Insufficient evidence", failed: "Check failed",
};
export const PROCESSING_LABEL: Record<ProcessingStatus, string> = { uploaded: "Uploaded", processing: "Processing", processed: "Ready", failed: "Failed" };

/** "Just now", "12 min ago", "3 h ago", "Yesterday", then a plain date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((now - then) / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return formatDate(iso);
}

export function greeting(hour: number = new Date().getHours()): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const DOCUMENT_TYPE_LABEL: Record<string, string> = { pdf: "PDF", text: "Text", html: "HTML", unknown: "File" };

/** Removes Markdown emphasis markers that a model may leave in prose, keeping the words. */
export function plain(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[^\w*])\*([^*\s][^*\n]*?)\*(?=[^\w*]|$)/g, "$1$2")
    .replace(/(^|[^\w`])`([^`\n]+)`/g, "$1$2");
}
