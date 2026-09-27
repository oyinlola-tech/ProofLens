import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/Button";
import { MarketingShell, isAuthed } from "@/components/marketing/Shell";
import { Photo } from "@/components/marketing/Photo";
import { VerdictBadge } from "@/components/ui/Badge";
import { VERDICTS } from "@/lib/verdict";
import type { Verdict } from "@/lib/api/types";

export const metadata: Metadata = { title: "Verdicts", description: "What Supported, Partially supported, Contradicted, and Insufficient evidence each mean." };

const examples: Record<Verdict, { claim: string; evidence: string; why: string }> = {
  supported: {
    claim: "The trial enrolled 1,200 participants across 14 sites.",
    evidence: "We enrolled 1,200 participants across 14 sites to evaluate the treatment against standard care.",
    why: "Every element of the claim appears in the passage: the count, the number of sites, and the purpose. Nothing in the claim goes beyond it.",
  },
  partially_supported: {
    claim: "The trial proves the treatment causes faster recovery.",
    evidence: "Median time to recovery was 4.1 days shorter in the treatment arm. The trial was not powered to establish causation.",
    why: "Faster recovery in the treatment arm is supported. “Proves” and “causes” are not: the passage says the opposite about causation.",
  },
  contradicted: {
    claim: "The study involved 10,000 participants.",
    evidence: "The study involved 1,200 participants.",
    why: "A deterministic number check finds 10,000 in the claim and 1,200 in the evidence for the same quantity. The evidence conflicts with the claim.",
  },
  insufficient_evidence: {
    claim: "The treatment reduces readmission within 30 days.",
    evidence: "Median time to recovery was 4.1 days shorter in the treatment arm. Adverse events were balanced across arms.",
    why: "The passage is about recovery time and adverse events. It says nothing about readmission, so it can neither support nor contradict the claim.",
  },
};

const order: Verdict[] = ["supported", "partially_supported", "contradicted", "insufficient_evidence"];

export default async function VerdictsPage() {
  const authed = await isAuthed();
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <Photo src="/images/evidence.jpg" alt="" priority sizes="100vw" className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/60 to-canvas" />
        <div className="relative mx-auto max-w-[1400px] px-4 pb-20 pt-36 sm:px-6 lg:px-10 lg:pb-28 lg:pt-48">
          <p className="rise text-sm font-medium uppercase tracking-[0.14em] text-accent">Verdicts</p>
          <h1 className="rise font-display mt-4 max-w-[18ch] text-[clamp(2.5rem,5.5vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink" style={{ "--delay": "80ms" } as React.CSSProperties}>
            A verdict is about the evidence, not the world.
          </h1>
          <p className="rise mt-6 max-w-[48ch] text-lg leading-relaxed text-ink-secondary sm:text-xl" style={{ "--delay": "160ms" } as React.CSSProperties}>
            ProofLens never says a claim is true. It says whether the passages you supplied support it, and how confidently. Here is what each of the four outcomes means, with an example you can reproduce.
          </p>
        </div>
      </section>

      <div className="border-t border-line">
        {order.map((v, i) => {
          const m = VERDICTS[v];
          const ex = examples[v];
          return (
            <section key={v} id={v} className={`border-b border-line ${i % 2 === 1 ? "bg-surface" : ""}`}>
              <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:py-28">
                <div className="lg:col-span-5">
                  <VerdictBadge verdict={v} size="lg" />
                  <h2 className={`font-display mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.02em] md:text-5xl ${m.text}`}>{m.label}</h2>
                  <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink">{m.description}</p>
                </div>
                <div className={`rounded-panel border ${m.ring} ${m.bg} p-6 lg:col-span-7 lg:p-9`}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">Example claim</p>
                  <p className="font-display mt-2 text-xl font-semibold leading-snug text-ink md:text-2xl">&ldquo;{ex.claim}&rdquo;</p>
                  <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">Evidence passage</p>
                  <blockquote className="mt-2 border-l-2 border-current pl-4 text-base leading-relaxed text-ink-secondary">{ex.evidence}</blockquote>
                  <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">Why</p>
                  <p className="mt-2 max-w-[60ch] text-base leading-relaxed text-ink">{ex.why}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-display max-w-[20ch] text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl">Confidence is a measure of the evidence, too.</h2>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-ink-secondary">
              The percentage next to a verdict reflects how directly and completely the supplied passages bear on the claim. Thin or tangential evidence lowers it even when the verdict is clear. It is not a probability that the claim is true.
            </p>
          </div>
          <div className="flex items-end lg:col-span-5 lg:justify-end">
            <Link href={authed ? "/app/claims/new" : "/register"} className={buttonClass("accent", "lg", "rounded-full px-8")}>
              Try it on your own claim <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
