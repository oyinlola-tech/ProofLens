import { formatPercent } from "@/lib/format";

/** Confidence as a number plus a thin inline bar. No filled background track. */
export function Confidence({ value, verdictText = "text-ink" }: { value: number | null; verdictText?: string }) {
  if (value === null || Number.isNaN(value)) {
    return <span className="text-sm text-ink-tertiary">Confidence unavailable</span>;
  }
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-3">
      <span className={`tabular text-2xl font-semibold ${verdictText}`}>{formatPercent(pct)}</span>
      <span className="text-sm text-ink-secondary">confidence</span>
      <span
        role="img"
        aria-label={`${formatPercent(pct)} confidence`}
        className="relative ml-1 hidden h-1 w-28 overflow-hidden rounded-full bg-line sm:block"
      >
        <span className={`absolute inset-y-0 left-0 rounded-full bg-current ${verdictText}`} style={{ width: `${pct * 100}%` }} />
      </span>
    </div>
  );
}
