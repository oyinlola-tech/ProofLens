import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/Button";
import { VERDICTS } from "@/lib/verdict";
import type { Verdict } from "@/lib/api/types";
import { Photo } from "./Photo";
import { ProductShot } from "./ProductShot";

export function Principles() {
  const items = [
    { k: "Four verdicts", v: "Supported, partially supported, contradicted, or insufficient evidence. Never “true”." },
    { k: "Page-level citations", v: "Every verdict names the document and the page, and highlights the passage it rests on." },
    { k: "Checks before reasoning", v: "Numbers, dates, and negations are compared deterministically before any model runs." },
  ];
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 divide-y divide-line px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
        {items.map((it, i) => (
          <div key={it.k} className="reveal py-10 md:px-8 md:first:pl-0 md:last:pr-0 lg:py-14" style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
            <p className="font-display text-2xl font-semibold tracking-tight text-ink lg:text-3xl">{it.k}</p>
            <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-ink-secondary">{it.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Bento() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
        <h2 className="reveal font-display max-w-[18ch] text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl lg:text-6xl">
          Built for people who need to check, not to be told.
        </h2>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]" style={{ gridAutoFlow: "dense" }}>
          <div className="reveal relative min-h-[360px] overflow-hidden rounded-panel border border-line md:col-span-4 md:row-span-2">
            <Photo src="/images/desk.jpg" alt="Printed studies with highlighter marks spread across a desk under a lamp." className="absolute inset-0 h-full w-full" sizes="(max-width: 768px) 100vw, 66vw" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-transparent" />
            <div className="relative flex h-full flex-col justify-end p-7 lg:p-9">
              <p className="font-display max-w-[20ch] text-3xl font-semibold leading-tight tracking-tight text-ink lg:text-4xl">Bring the whole pile. Each source stays its own source.</p>
              <p className="mt-3 max-w-[48ch] text-base text-ink-secondary">Upload PDFs, paste passages, reuse documents across claims. The verdict cites each one individually.</p>
            </div>
          </div>
          <div className="reveal flex flex-col justify-between rounded-panel border border-partial/40 bg-partial-soft p-7 md:col-span-2" style={{ "--delay": "80ms" } as React.CSSProperties}>
            <p className="font-display text-6xl font-semibold leading-none tracking-tight text-partial tabular">7</p>
            <div>
              <p className="font-display mt-6 text-xl font-semibold text-ink">The page, not the paper.</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Citations resolve to a page number and a highlighted passage, so checking takes seconds.</p>
            </div>
          </div>
          <div className="reveal relative min-h-[260px] overflow-hidden rounded-panel border border-line md:col-span-2" style={{ "--delay": "140ms" } as React.CSSProperties}>
            <Photo src="/images/lens.jpg" alt="A magnifying lens resting on a page of small printed text." className="absolute inset-0 h-full w-full" sizes="(max-width: 768px) 100vw, 33vw" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-canvas/90 to-transparent" />
            <div className="relative flex h-full flex-col justify-end p-7">
              <p className="font-display text-xl font-semibold text-ink">Deterministic first.</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">10,000 versus 1,200 is a mismatch a model does not get to argue with.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SeeItWork() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <h2 className="reveal font-display text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl">This is the actual product.</h2>
              <p className="reveal mt-6 max-w-[40ch] text-lg leading-relaxed text-ink-secondary">
                No mock-ups. These are screenshots of the ProofLens workspace running against the real API: a claim, its evidence, the verdict, and the source page.
              </p>
              <Link href="/how-it-works" className="reveal mt-8 inline-flex items-center gap-2 text-base font-medium text-ink underline underline-offset-4">
                Walk through the whole flow <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-10 lg:col-span-8">
            <ProductShot src="/images/product/result.png" darkSrc="/images/product/result-dark.png" alt="The verification result page showing a verdict, confidence, the explanation, and the evidence used." caption="The result: verdict, confidence, explanation, and every passage the verdict rests on." className="reveal" />
            <div className="grid gap-10 md:grid-cols-2">
              <ProductShot src="/images/product/claim.png" darkSrc="/images/product/claim-dark.png" alt="The claim workspace with two attached evidence passages and the verify action." caption="The claim workspace, with two sources attached." className="reveal" />
              <ProductShot src="/images/product/viewer.png" darkSrc="/images/product/viewer-dark.png" alt="The document viewer open on the cited page with the passage highlighted." caption="Show me why: the cited page, with the passage highlighted." className="reveal" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const order: Verdict[] = ["supported", "partially_supported", "contradicted", "insufficient_evidence"];

export function VerdictTeaser() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="reveal font-display max-w-[16ch] text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl lg:text-6xl">Four verdicts. None of them is &ldquo;true&rdquo;.</h2>
          <Link href="/verdicts" className={buttonClass("secondary", "md", "reveal rounded-full")}>
            What each verdict means <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {order.map((v, i) => {
            const m = VERDICTS[v];
            return (
              <Link key={v} href={`/verdicts#${v}`} className={`reveal group rounded-panel border ${m.ring} ${m.bg} p-5 transition-transform hover:-translate-y-0.5 lg:p-7`} style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
                <p className={`font-display text-xl font-semibold leading-tight tracking-tight md:text-2xl lg:text-3xl ${m.text}`}>{m.label}</p>
                <p className="mt-4 hidden text-sm leading-relaxed text-ink md:block">{m.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta({ authed }: { authed: boolean }) {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <Photo src="/images/archive.jpg" alt="Shelves of labelled archive boxes." className="absolute inset-0 h-full w-full" sizes="100vw" />
      <div aria-hidden="true" className="absolute inset-0 bg-canvas/70" />
      <div aria-hidden="true" className="aurora absolute inset-0" />
      <div className="relative mx-auto flex max-w-[1400px] flex-col items-start gap-10 px-4 py-28 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-40">
        <h2 className="reveal font-display max-w-[16ch] text-4xl font-semibold leading-[0.98] tracking-[-0.03em] text-ink md:text-6xl lg:text-7xl">Bring a claim and the paper it came from.</h2>
        <Link href={authed ? "/app/claims/new" : "/register"} className={buttonClass("accent", "lg", "reveal rounded-full px-8")}>
          Start verifying <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
