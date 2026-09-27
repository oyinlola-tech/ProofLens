import type { Metadata } from "next";
import { apiRequest } from "@/lib/api/server";
import type { MeResponse } from "@/lib/api/types";
import { PageHeader } from "@/components/ui/Panel";
import { AccountActions } from "./AccountActions";
import { ThemeSelect } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await apiRequest<MeResponse>("/auth/me", { redirectOnExpiry: true });
  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <PageHeader title="Account" description="Your sign-in details and session controls." />
      <dl className="grid gap-4 border-y border-line py-5 sm:grid-cols-[10rem_1fr]">
        <dt className="text-sm text-ink-tertiary">Email</dt>
        <dd className="text-base text-ink">{me.email}</dd>
        <dt className="text-sm text-ink-tertiary">Account ID</dt>
        <dd className="font-mono text-sm text-ink-secondary" translate="no">{me.user_id}</dd>
      </dl>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Appearance</h2>
        <p className="text-sm text-ink-secondary">Follow the system setting, or pick light or dark.</p>
        <ThemeSelect />
      </section>
      <AccountActions />
      <p className="text-xs text-ink-tertiary">
        Sessions expire after 24 hours. Up to 5 sessions can be active at once; the oldest is signed out automatically. Password changes and a
        per-device session list are not available yet.
      </p>
    </div>
  );
}
