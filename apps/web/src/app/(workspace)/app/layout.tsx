import { redirect } from "next/navigation";
import { readSessionToken } from "@/lib/auth/session";
import { apiRequest } from "@/lib/api/server";
import type { MeResponse } from "@/lib/api/types";
import { Sidebar } from "@/components/workspace/Sidebar";

export default async function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  const token = await readSessionToken();
  if (!token) redirect("/login");
  // Confirms the token is still valid; an expired or revoked token redirects to login.
  const me = await apiRequest<MeResponse>("/auth/me", { redirectOnExpiry: true });

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <Sidebar email={me.email} />
      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
