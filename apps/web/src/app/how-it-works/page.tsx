import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/Button";
import { MarketingShell, isAuthed } from "@/components/marketing/Shell";
import { Photo } from "@/components/marketing/Photo";
import { ProductShot } from "@/components/marketing/ProductShot";

export const metadata: Metadata = { title: "How it works", description: "The four steps from a claim to a verdict you can trace back to the page." };

const steps = [
  {
    title: "Write the claim",
    lede: "The proposition you want tested, in plain words.",
    body: "A claim is a single statement. “The study proves the treatment causes faster recovery” is a claim. So is “the policy cut unemployment by 20%”. The evidence is judged against exactly this wording, so the phrasing is yours to control.",
    image: { src: "/images/claim.jpg", alt: "An open notebook with a single handwritten line and a pen." },
    shot: { src: "/images/product/new-claim.png", alt: "The new verification form with the claim text area." },
  },
  {
    title: "Add the evidence",
    lede: "PDFs, text files, or passages you paste in.",
    body: "Each document is processed page by page so the extracted text keeps its page boundaries. You choose the passage that bears on the claim, and it is stored with its document, page, and section. Pasted text becomes its own source so it can be cited too.",
    image: { src: "/images/evidence.jpg", alt: "A stack of printed reports with paper index tabs." },
    shot: { src: "/images/product/claim.png", darkSrc: "/images/product/claim-dark.png", alt: "The claim workspace with attached evidence and the upload panel." },
  },
  {
    title: "Run the verification",
    lede: "Deterministic checks first, then reasoning over your passages only.",
    body: "Numbers, dates, negations, and entities in the claim are compared against the evidence before any model is involved. The model then reasons only over the passages you supplied, and its references are validated against stored evidence before the verdict is saved with a snapshot of what it used.",
    image: { src: "/images/lens.jpg", alt: "A magnifying lens on a page of printed text." },
    shot: { src: "/images/product/result.png", darkSrc: "/images/product/result-dark.png", alt: "The result page with verdict, confidence, and explanation." },
  },
  {
    title: "Inspect the source",
    lede: "Every verdict has a Show me why.",
    body: "Each cited passage links to the document viewer, open on the right page with the passage highlighted. You can read around it, move through the document, and come back to the result. The document stays the authority.",
    image: { src: "/images/archive.jpg", alt: "Shelves of labelled archive boxes." },
    shot: { src: "/images/product/viewer.png", darkSrc: "/images/product/viewer-dark.png", alt: "The document viewer with the cited passage highlighted." },
  },
];

export default async function HowItWorksPage() {
  const authed = await isAuthed();
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <Photo src="/images/desk.jpg" alt="" priority sizes="100vw" className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/60 to-canvas" />
        <div className="relative mx-auto max-w-[1400px] px-4 pb-20 pt-36 sm:px-6 lg:px-10 lg:pb-28 lg:pt-48">
          <p className="rise text-sm font-medium uppercase tracking-[0.14em] text-accent">How it works</p>
          <h1 className="rise font-display mt-4 max-w-[18ch] text-[clamp(2.5rem,5.5vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink" style={{ "--delay": "80ms" } as React.CSSProperties}>
            From a sentence to a verdict you can open.
          </h1>
          <p className="rise mt-6 max-w-[44ch] text-lg leading-relaxed text-ink-secondary sm:text-xl" style={{ "--delay": "160ms" } as React.CSSProperties}>
            Four steps. The first two are yours. The third is ProofLens. The fourth is where you check its work.
          </p>
        </div>
      </section>

      <ol className="border-t border-line">
        {steps.map((s, i) => (
          <li key={s.title} className="border-b border-line">
            <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:py-28">
              <div className="lg:col-span-5">
                <span className="font-display block text-7xl font-semibold leading-none tracking-tight text-accent tabular lg:text-8xl">0{i + 1}</span>
                <h2 className="font-display mt-8 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{s.title}</h2>
                <p className="mt-3 text-lg text-ink">{s.lede}</p>
                <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-ink-secondary">{s.body}</p>
                <Photo src={s.image.src} alt={s.image.alt} className="mt-10 aspect-[4/3] w-full rounded-panel border border-line lg:max-w-md" sizes="(max-width: 1024px) 100vw, 40vw" />
              </div>
              <div className="lg:col-span-7">
                <ProductShot src={s.shot.src} darkSrc={"darkSrc" in s.shot ? s.shot.darkSrc : undefined} alt={s.shot.alt} className="reveal lg:sticky lg:top-32" />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-4 py-24 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-32">
        <h2 className="font-display max-w-[18ch] text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-ink md:text-5xl">Ready when the paper is.</h2>
        <Link href={authed ? "/app/claims/new" : "/register"} className={buttonClass("accent", "lg", "rounded-full px-8")}>
          Start verifying <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </Link>
      </section>
    </MarketingShell>
  );
}
