"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clientRequest } from "@/lib/api/client";
import { isApiError, toUserMessage } from "@/lib/api/errors";
import type { ClaimStatus, Verification, VerificationSummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { VerdictBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Feedback";

interface Props {
  claimId: string;
  claimStatus: ClaimStatus;
  evidenceCount: number;
  readyCount: number;
  previous: VerificationSummary[];
}

type Phase =
  | { kind: "idle" }
  /** startedAt is null when the verification was started elsewhere (another tab or device). */
  | { kind: "running"; startedAt: number | null }
  | { kind: "error"; message: string; retryable: boolean };

export function VerifyPanel({ claimId, claimStatus, evidenceCount, readyCount, previous }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(claimStatus === "analyzing" ? { kind: "running", startedAt: null } : { kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (phase.kind !== "running" || phase.startedAt === null) return;
    const started = phase.startedAt;
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // A verification started elsewhere: poll the real claim status until it settles, then reload the page data.
  useEffect(() => {
    if (!(phase.kind === "running" && phase.startedAt === null)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const claim = await clientRequest<{ status: ClaimStatus }>(`/claims/${claimId}`);
        if (cancelled) return;
        if (claim.status !== "analyzing") {
          setPhase({ kind: "idle" });
          router.refresh();
          return;
        }
      } catch {
        // Keep polling; a transient failure should not mark the verification as failed.
      }
      if (!cancelled) timer = window.setTimeout(tick, 3000);
    };
    let timer = window.setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, claimId, router]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setPhase({ kind: "running", startedAt: Date.now() });
    try {
      const v = await clientRequest<Verification>("/verification", { method: "POST", body: { claim_id: claimId }, signal: ctrl.signal });
      router.push(`/app/verifications/${v.id}`);
      router.refresh();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (isApiError(e) && e.status === 409) {
        setPhase({ kind: "error", message: "A verification is already running for this claim. Refresh in a moment to see its result.", retryable: false });
        return;
      }
      if (isApiError(e) && e.kind === "unavailable") {
        setPhase({ kind: "error", message: "Verification unavailable. The reasoning service could not be reached, so no verdict was produced. Try again.", retryable: true });
        return;
      }
      if (isApiError(e) && e.kind === "network") {
        setPhase({
          kind: "error",
          message: "The connection dropped while waiting. ProofLens may still be processing this claim. Refresh to check before running it again.",
          retryable: true,
        });
        return;
      }
      setPhase({ kind: "error", message: toUserMessage(e), retryable: true });
    }
  };

  const canRun = evidenceCount > 0 && phase.kind !== "running";
  const latest = previous[0];

  return (
    <aside aria-labelledby="verify-heading" className="rounded-panel border border-line bg-surface p-5 lg:sticky lg:top-8">
      <h2 id="verify-heading" className="text-base font-semibold text-ink">Run verification</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-tertiary">Evidence attached</dt>
          <dd className="tabular text-lg font-semibold text-ink">{evidenceCount}</dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">Sources ready</dt>
          <dd className="tabular text-lg font-semibold text-ink">{readyCount}</dd>
        </div>
      </dl>

      {phase.kind === "running" ? (
        <div role="status" aria-live="polite" className="mt-4 rounded-control bg-surface-muted p-4">
          <p className="text-sm font-medium text-ink">Verifying{"…"}</p>
          <p className="mt-1 text-sm text-ink-secondary">
            Reading {evidenceCount} {evidenceCount === 1 ? "passage" : "passages"}, running deterministic checks, and reasoning over the evidence. This usually takes under a minute.
          </p>
          {phase.startedAt !== null ? (
            <p className="tabular mt-2 font-mono text-xs text-ink-tertiary">{elapsed}s elapsed</p>
          ) : (
            <p className="mt-2 text-xs text-ink-tertiary">Started from another session. This page will update when it finishes.</p>
          )}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-ink/60" />
          </div>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="mt-4">
          <Notice
            action={
              phase.retryable ? (
                <Button size="sm" variant="secondary" onClick={run}>
                  Retry
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
                  Refresh
                </Button>
              )
            }
          >
            {phase.message}
          </Notice>
        </div>
      ) : null}

      {phase.kind !== "running" ? (
        <Button className="mt-4 w-full" size="lg" onClick={run} disabled={!canRun}>
          {latest ? "Verify again" : "Verify this claim"}
        </Button>
      ) : null}
      {evidenceCount === 0 ? <p className="mt-2 text-xs text-ink-tertiary">Attach at least one piece of evidence first.</p> : null}

      {previous.length > 0 ? (
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Previous results</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {previous.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link href={`/app/verifications/${p.id}`} className="flex items-center justify-between gap-3 rounded-control px-2 py-1.5 text-sm hover:bg-surface-muted">
                  <VerdictBadge verdict={p.verdict} />
                  <span className="text-xs text-ink-tertiary">{formatDateTime(p.completed_at ?? p.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
