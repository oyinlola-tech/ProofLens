import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/Button";
import { HeroStage } from "./HeroStage";
import { Photo } from "./Photo";

export function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <Photo
        src="/images/hero.jpg"
        alt="A printed research paper with one passage marked in amber highlighter."
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-canvas/85 via-canvas/60 to-canvas" />
      <div aria-hidden="true" className="aurora absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-36 sm:px-6 lg:px-10 lg:pb-24 lg:pt-48">
        <h1 className="rise font-display max-w-[21ch] text-[clamp(2.75rem,6vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-ink">
          Claims, tested against <span className="text-accent">the evidence.</span>
        </h1>
        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="rise max-w-[40ch] text-lg leading-relaxed text-ink-secondary sm:text-xl" style={{ "--delay": "120ms" } as React.CSSProperties}>
            Enter a claim, add the documents, and get a verdict that points back to the page it came from.
          </p>
          <div className="rise flex flex-col gap-3 sm:flex-row" style={{ "--delay": "200ms" } as React.CSSProperties}>
            <Link href={authed ? "/app/claims/new" : "/register"} className={buttonClass("accent", "lg", "rounded-full px-7")}>
              Start verifying <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
            <Link href="/show-me-why" className={buttonClass("secondary", "lg", "rounded-full border-line-strong bg-surface/60 px-7 text-ink backdrop-blur hover:bg-line")}>
              See how a verdict is traced
            </Link>
          </div>
        </div>
        <HeroStage />
      </div>
    </section>
  );
}
