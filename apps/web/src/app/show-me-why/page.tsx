import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/Button";
import { MarketingShell, isAuthed } from "@/components/marketing/Shell";
import { Photo } from "@/components/marketing/Photo";
import { ProductShot } from "@/components/marketing/ProductShot";
import { Stepper } from "@/components/marketing/Stepper";

export const metadata: Metadata = { title: "Show me why", description: "How every verdict links back to the document, the page, and the passage." };

const guarantees = [
  { t: "The model never invents a reference.", b: "Document IDs, page numbers, evidence IDs, and quotes in the model output are checked against stored evidence. Anything that does not resolve is rejected before you see it." },
  { t: "Documents are treated as untrusted input.", b: "A PDF that says “ignore previous instructions” is just a PDF that says that. Document text and system instructions never mix." },
  { t: "The evidence is frozen with the verdict.", b: "Each verification keeps a snapshot of the exact passages it used. Deleting evidence that a verdict depends on is refused." },
  { t: "If reasoning fails, nothing is faked.", b: "When the reasoning service is unavailable, you get a clear unavailable state and a retry. Never a made-up verdict." },
];

export default async function ShowMeWhyPage() {
  const authed = await isAuthed();
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <Photo src="/images/why.jpg" alt="" priority sizes="100vw" className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/60 to-canvas" />
        <div className="relative mx-auto max-w-[1400px] px-4 pb-20 pt-36 sm:px-6 lg:px-10 lg:pb-28 lg:pt-48">
          <p className="rise text-sm font-medium uppercase tracking-[0.14em] text-accent">Show me why</p>
          <h1 className="rise font-display mt-4 max-w-[18ch] text-[clamp(2.5rem,5.5vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink" style={{ "--delay": "80ms" } as React.CSSProperties}>
            You never have to take the model&rsquo;s word for it.
          </h1>
          <p className="rise mt-6 max-w-[48ch] text-lg leading-relaxed text-ink-secondary sm:text-xl" style={{ "--delay": "160ms" } as React.CSSProperties}>
            Every verdict is one click from the passage it rests on. This page shows the chain, and what ProofLens does to keep it honest.
          </p>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-10 lg:py-32">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl">The chain, end to end.</h2>
              <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-ink-secondary">
                From the verification record down to the highlighted sentence. Each step is a real object in the ProofLens API, not a label.
              </p>
            </div>
          </div>
          <div className="lg:col-span-7">
            <Stepper />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <ProductShot src="/images/product/viewer.png" darkSrc="/images/product/viewer-dark.png" alt="The document viewer open on the cited page with the passage highlighted." caption="The document viewer, opened from a verdict: the page ProofLens cited, with the passage it used highlighted." priority className="reveal mx-auto max-w-5xl" />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <h2 className="font-display max-w-[18ch] text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl">What keeps the chain honest.</h2>
          <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-2">
            {guarantees.map((g, i) => (
              <div key={g.t} className="reveal border-t border-line-strong pt-6" style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
                <span className="font-mono text-xs text-accent tabular">0{i + 1}</span>
                <h3 className="font-display mt-4 text-2xl font-semibold text-ink">{g.t}</h3>
                <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-ink-secondary">{g.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1400px] flex-col items-start gap-8 border-t border-line px-4 py-24 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-32">
        <h2 className="font-display max-w-[18ch] text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl">See it on your own paper.</h2>
        <Link href={authed ? "/app/claims/new" : "/register"} className={buttonClass("accent", "lg", "rounded-full px-8")}>
          Start verifying <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </Link>
      </section>
    </MarketingShell>
  );
}
