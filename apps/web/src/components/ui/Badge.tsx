import type { ReactNode } from "react";
import type { ClaimStatus, ProcessingStatus, Verdict } from "@/lib/api/types";
import { CLAIM_STATUS, PROCESSING_STATUS, verdictMeta } from "@/lib/verdict";

const tones = {
  neutral: "bg-surface-muted text-ink-secondary",
  active: "bg-accent-soft text-accent",
  good: "bg-supported-soft text-supported",
  bad: "bg-contradicted-soft text-contradicted",
  warn: "bg-partial-soft text-partial",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict | null; size?: "sm" | "lg" }) {
  const m = verdictMeta(verdict);
  const cls = size === "lg" ? "h-9 px-4 text-sm font-semibold" : "h-6 px-2.5 text-xs font-medium";
  return <span className={`inline-flex items-center rounded-full ${m.bg} ${m.text} ${cls}`}>{m.label}</span>;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const s = CLAIM_STATUS[status] ?? CLAIM_STATUS.pending;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  const s = PROCESSING_STATUS[status] ?? PROCESSING_STATUS.uploaded;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
