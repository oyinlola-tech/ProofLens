"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, FileText, House, List, ListChecks, Plus, User, X } from "@phosphor-icons/react";
import { Wordmark } from "@/components/marketing/Wordmark";
import { buttonClass } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const items = [
  { href: "/app", label: "Dashboard", icon: House, exact: true },
  { href: "/app/claims", label: "Claims", icon: ListChecks },
  { href: "/app/documents", label: "Documents", icon: FileText },
  { href: "/app/history", label: "History", icon: Clock },
  { href: "/app/account", label: "Account", icon: User },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
        const Icon = it.icon;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-control px-3 text-sm transition-colors ${
                active ? "bg-surface-muted font-medium text-ink" : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/app" className="text-ink" aria-label="Dashboard">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-control text-ink"
          aria-expanded={open}
          aria-controls="workspace-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} weight="bold" aria-hidden="true" /> : <List size={22} weight="bold" aria-hidden="true" />}
        </button>
        </div>
      </header>

      {open ? (
        <div id="workspace-menu" className="fixed inset-x-0 top-14 z-30 flex flex-col gap-4 overflow-y-auto border-b border-line bg-canvas px-4 pb-6 pt-4 lg:hidden" style={{ overscrollBehavior: "contain" }}>
          <Link href="/app/claims/new" onClick={close} className={buttonClass("accent", "lg", "w-full")}>
            <Plus size={18} weight="bold" aria-hidden="true" /> New verification
          </Link>
          <NavList onNavigate={close} />
          <p className="truncate border-t border-line pt-4 text-xs text-ink-tertiary">{email}</p>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-[100dvh]">
        <Link href="/app" className="px-2 text-ink" aria-label="Dashboard">
          <Wordmark />
        </Link>
        <Link href="/app/claims/new" className={buttonClass("accent", "md", "mt-6 w-full")}>
          <Plus size={18} weight="bold" aria-hidden="true" /> New verification
        </Link>
        <nav aria-label="Workspace" className="mt-6">
          <NavList />
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
          <p className="min-w-0 truncate px-2 text-xs text-ink-tertiary" title={email}>
            {email}
          </p>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
