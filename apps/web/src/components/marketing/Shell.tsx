import type { ReactNode } from "react";
import { readSessionToken } from "@/lib/auth/session";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

export async function MarketingShell({ children }: { children: ReactNode }) {
  const authed = Boolean(await readSessionToken());
  return (
    <div className="grain relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-canvas text-ink">
      <Nav authed={authed} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export async function isAuthed(): Promise<boolean> {
  return Boolean(await readSessionToken());
}
