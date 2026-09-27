"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { Wordmark } from "./Wordmark";
import { buttonClass } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/verdicts", label: "Verdicts" },
  { href: "/show-me-why", label: "Show me why" },
];

/** Floating pill navigation with theme toggle. */
export function Nav({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4 sm:top-5">
      <nav aria-label="Primary" className="pointer-events-auto flex h-14 w-full max-w-4xl items-center justify-between rounded-full border border-line bg-surface/75 pl-5 pr-2 shadow-card backdrop-blur-xl">
        <Link href="/" className="flex items-center text-ink" aria-label="ProofLens home">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={active ? "page" : undefined} className={`rounded-full px-3.5 py-2 text-sm transition-colors hover:bg-line hover:text-ink ${active ? "bg-line text-ink" : "text-ink-secondary"}`}>
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <div className="hidden items-center gap-1 md:flex">
            {authed ? (
              <Link href="/app" className={buttonClass("accent", "sm", "rounded-full px-5")}>Open workspace</Link>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "sm", "rounded-full text-ink")}>Log in</Link>
                <Link href="/register" className={buttonClass("accent", "sm", "rounded-full px-5")}>Start verifying</Link>
              </>
            )}
          </div>
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-full text-ink md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={22} weight="bold" aria-hidden="true" /> : <List size={22} weight="bold" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-menu" className="pointer-events-auto fixed inset-x-4 top-22 rounded-panel border border-line bg-surface p-4 shadow-card md:hidden" style={{ overscrollBehavior: "contain" }}>
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-control px-3 py-3 text-lg text-ink">{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2">
            {authed ? (
              <Link href="/app" className={buttonClass("accent", "lg", "w-full")}>Open workspace</Link>
            ) : (
              <>
                <Link href="/register" className={buttonClass("accent", "lg", "w-full")}>Start verifying</Link>
                <Link href="/login" className={buttonClass("secondary", "lg", "w-full")}>Log in</Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
