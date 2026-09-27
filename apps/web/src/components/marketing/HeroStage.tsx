import { VerdictBadge } from "@/components/ui/Badge";

/**
 * The hero visual: a real page from a real document card, the passage the verdict rests on,
 * and the verdict card it produced, joined by the provenance line. Labelled as an example.
 */
export function HeroStage() {
  return (
    <figure className="relative mx-auto mt-16 w-full max-w-[1100px] lg:mt-20">
      <figcaption className="sr-only">Example: a document page with the cited passage highlighted, connected to the verdict it produced.</figcaption>

      {/* Document page */}
      <div className="rise relative z-10 mr-auto w-full max-w-[660px] rounded-[4px] bg-paper p-7 text-paper-ink shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:p-10 lg:p-12" style={{ "--delay": "250ms" } as React.CSSProperties}>
        <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-paper-ink/50">
          <span>recovery-trial-2024.pdf</span>
          <span className="tabular">page 7 of 31</span>
        </div>
        <p className="font-display mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">3.2 Primary endpoint</p>
        <p className="mt-5 max-w-[60ch] text-[15px] leading-7 text-paper-ink/85 sm:text-base sm:leading-8">
          Median time to recovery was{" "}
          <mark className="rounded-[3px] bg-[#ffd48a] px-1 py-0.5 text-paper-ink shadow-[0_0_0_3px_#ffd48a]">4.1 days shorter in the treatment arm</mark>{" "}
          (95% CI 2.6 to 5.7). The trial was not powered to establish causation, and the observed association may reflect differences in
          baseline severity between sites.
        </p>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-7 text-paper-ink/45 sm:text-base sm:leading-8">
          Adverse events were balanced across arms. Readmission within 30 days did not differ. Sensitivity analyses excluding the two
          largest sites gave similar estimates.
        </p>
      </div>

      {/* Provenance line from the passage to the verdict card */}
      <svg aria-hidden="true" viewBox="0 0 1100 520" className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full lg:block" preserveAspectRatio="none">
        <path d="M 596 214 C 660 214, 640 322, 690 322" fill="none" stroke="var(--accent)" strokeWidth="2" pathLength={1} className="draw-line" />
        <circle cx="596" cy="214" r="5" fill="var(--accent)" />
      </svg>

      {/* Verdict card */}
      <div className="rise float relative z-30 -mt-10 ml-auto w-full max-w-[420px] rounded-panel border border-line bg-surface-raised/90 p-6 shadow-card backdrop-blur-xl sm:-mt-16 lg:absolute lg:right-0 lg:top-[250px] lg:mt-0" style={{ "--delay": "700ms" } as React.CSSProperties}>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">Claim</p>
        <p className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink">&ldquo;The trial proves the treatment causes faster recovery.&rdquo;</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <VerdictBadge verdict="partially_supported" size="lg" />
          <span className="font-display text-3xl font-semibold text-partial tabular">72%</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
          Faster recovery is supported by page 7. Causation is not: the trial says so itself.
        </p>
      </div>
    </figure>
  );
}
