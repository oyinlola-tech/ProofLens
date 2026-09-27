import Link from "next/link";
import { Wordmark } from "./Wordmark";

const columns = [
  { heading: "Product", links: [{ href: "/#how-it-works", label: "How it works" }, { href: "/#verdicts", label: "Verdicts" }, { href: "/#show-me-why", label: "Show me why" }] },
  { heading: "Workspace", links: [{ href: "/app", label: "Dashboard" }, { href: "/app/claims", label: "Claims" }, { href: "/app/documents", label: "Documents" }, { href: "/app/history", label: "History" }] },
  { heading: "Account", links: [{ href: "/login", label: "Log in" }, { href: "/register", label: "Create account" }, { href: "/app/account", label: "Sessions" }] },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-12">
          <div className="col-span-2 lg:col-span-6">
            <Link href="/" className="inline-flex text-ink" aria-label="ProofLens home">
              <Wordmark />
            </Link>
            <p className="font-display mt-8 max-w-[18ch] text-3xl font-semibold leading-tight tracking-tight text-ink md:text-4xl">
              The document stays the authority.
            </p>
            <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-ink-secondary">
              Evidence-grounded claim verification for people who need to check, not to be told.
            </p>
          </div>
          {columns.map((c) => (
            <nav key={c.heading} aria-label={c.heading} className="lg:col-span-2">
              <p className="text-sm font-semibold text-ink">{c.heading}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-ink-secondary transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-line py-6 text-xs text-ink-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} ProofLens. Verdicts describe the evidence you supply, not the world.</p>
          <p>
            Built by{" "}
            <a href="http://portfolio.oyinlola.site/" target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4 transition-colors hover:text-accent">
              Oluwayemi Oyinlola
            </a>
          </p>
        </div>
      </div>
      <p
        translate="no"
        aria-hidden="true"
        className="font-display pointer-events-none -mb-[0.22em] select-none whitespace-nowrap text-center text-[clamp(5rem,19.5vw,19rem)] font-semibold leading-none tracking-[-0.05em] text-ink"
      >
        ProofLens
      </p>
    </footer>
  );
}
