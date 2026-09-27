import type { ReactNode } from "react";
import { WarningCircle, Info } from "@phosphor-icons/react/dist/ssr";

export function Notice({ tone = "error", children, action }: { tone?: "error" | "info"; children: ReactNode; action?: ReactNode }) {
  const cls = tone === "error" ? "border-contradicted/30 bg-contradicted-soft text-contradicted" : "border-line bg-surface-muted text-ink-secondary";
  const Icon = tone === "error" ? WarningCircle : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-control border px-4 py-3 text-sm ${cls}`}>
      <Icon size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong px-6 py-10">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-[48ch] text-sm text-ink-secondary">{body}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
