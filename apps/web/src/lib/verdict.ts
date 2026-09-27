import type { ClaimStatus, ProcessingStatus, Verdict } from "@/lib/api/types";

export interface VerdictMeta {
  label: string;
  short: string;
  description: string;
  /** Tailwind classes using the semantic tokens. */
  text: string;
  bg: string;
  ring: string;
}

export const VERDICTS: Record<Verdict, VerdictMeta> = {
  supported: {
    label: "Supported",
    short: "Supported",
    description: "The evidence directly supports the essential proposition in the claim.",
    text: "text-supported",
    bg: "bg-supported-soft",
    ring: "border-supported/40",
  },
  partially_supported: {
    label: "Partially supported",
    short: "Partial",
    description:
      "Part of the claim is supported, but the evidence does not establish all of it, or the claim asserts more than the evidence shows.",
    text: "text-partial",
    bg: "bg-partial-soft",
    ring: "border-partial/40",
  },
  contradicted: {
    label: "Contradicted",
    short: "Contradicted",
    description: "The evidence materially conflicts with the claim.",
    text: "text-contradicted",
    bg: "bg-contradicted-soft",
    ring: "border-contradicted/40",
  },
  insufficient_evidence: {
    label: "Insufficient evidence",
    short: "Insufficient",
    description: "The evidence does not contain enough relevant information to establish or contradict the claim.",
    text: "text-insufficient",
    bg: "bg-insufficient-soft",
    ring: "border-insufficient/40",
  },
};

export function verdictMeta(v: Verdict | null | undefined): VerdictMeta {
  if (v && v in VERDICTS) return VERDICTS[v];
  return {
    label: "No verdict",
    short: "Pending",
    description: "This verification has not produced a verdict.",
    text: "text-ink-secondary",
    bg: "bg-surface-muted",
    ring: "border-line",
  };
}

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: "neutral" | "active" | "good" | "bad" | "warn" }> = {
  pending: { label: "Ready to verify", tone: "neutral" },
  analyzing: { label: "Verifying", tone: "active" },
  verified: { label: "Supported", tone: "good" },
  rejected: { label: "Contradicted", tone: "bad" },
  unverified: { label: "Insufficient evidence", tone: "warn" },
  failed: { label: "Verification failed", tone: "bad" },
};

export const PROCESSING_STATUS: Record<ProcessingStatus, { label: string; tone: "neutral" | "active" | "good" | "bad" }> = {
  uploaded: { label: "Uploaded", tone: "neutral" },
  processing: { label: "Processing", tone: "active" },
  processed: { label: "Ready", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
};
