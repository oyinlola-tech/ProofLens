import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/Button";
import { Wordmark } from "@/components/marketing/Wordmark";
import { Photo } from "@/components/marketing/Photo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-canvas text-ink">
      <Photo src="/images/empty.jpg" alt="" priority sizes="100vw" className="absolute inset-0 h-full w-full" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/80 to-canvas/20" />
      <div className="relative flex items-center justify-between px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/" className="inline-flex text-ink" aria-label="ProofLens home">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </div>
      <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 py-16 sm:px-6 lg:px-10">
        <p className="rise font-mono text-sm uppercase tracking-[0.2em] text-accent">Verdict: insufficient evidence</p>
        <h1 className="rise font-display mt-5 max-w-[14ch] text-[clamp(3rem,9vw,8.5rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-ink" style={{ "--delay": "80ms" } as React.CSSProperties}>
          This page does not exist.
        </h1>
        <p className="rise mt-8 max-w-[44ch] text-lg text-ink-secondary md:text-xl" style={{ "--delay": "160ms" } as React.CSSProperties}>
          The link may be old, or the item may belong to another account. We looked. There was nothing to cite.
        </p>
        <div className="rise mt-10 flex flex-col gap-3 sm:flex-row" style={{ "--delay": "240ms" } as React.CSSProperties}>
          <Link href="/app" className={buttonClass("accent", "lg", "rounded-full px-7")}>
            Go to the workspace <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
          <Link href="/" className={buttonClass("secondary", "lg", "rounded-full border-line-strong bg-surface/60 px-7 text-ink backdrop-blur hover:bg-line")}>Back to home</Link>
        </div>
        <p className="rise mt-16 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-tertiary" style={{ "--delay": "320ms" } as React.CSSProperties}>Error 404</p>
      </div>
    </main>
  );
}
