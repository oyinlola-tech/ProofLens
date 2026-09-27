import Link from "next/link";
import { Wordmark } from "@/components/marketing/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-12">
      <aside className="hidden border-r border-line bg-surface px-10 py-8 lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="inline-flex w-fit text-ink" aria-label="ProofLens home">
          <Wordmark />
        </Link>
        <div>
          <p className="max-w-[20ch] text-3xl font-semibold leading-tight tracking-tight text-ink">Claim in. Verdict out. Source open.</p>
          <p className="mt-4 max-w-[36ch] text-base text-ink-secondary">Your claims, documents, and verifications stay private to your account.</p>
        </div>
        <p className="text-xs text-ink-tertiary">Verdicts describe the evidence you supply, not the world.</p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-6 sm:px-6 lg:col-span-7 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex w-fit text-ink lg:hidden" aria-label="ProofLens home">
            <Wordmark />
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
