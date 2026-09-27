"use client";

import { useState, useTransition } from "react";
import { logoutAction, revokeAllSessionsAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

export function AccountActions() {
  const [confirming, setConfirming] = useState(false);
  const [pendingLogout, startLogout] = useTransition();
  const [pendingRevoke, startRevoke] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">This session</h2>
        <p className="text-sm text-ink-secondary">Sign out on this device only.</p>
        <div>
          <Button variant="secondary" loading={pendingLogout} onClick={() => startLogout(() => logoutAction())}>
            {pendingLogout ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </section>
      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="text-base font-semibold text-ink">All sessions</h2>
        <p className="text-sm text-ink-secondary">Sign out everywhere, including this device. Use this if you think a session was left open somewhere else.</p>
        {confirming ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Confirm sign out everywhere">
            <Button variant="danger" loading={pendingRevoke} onClick={() => startRevoke(() => revokeAllSessionsAction())}>
              {pendingRevoke ? "Signing out everywhere…" : "Confirm: sign out everywhere"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pendingRevoke}>
              Cancel
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Sign out everywhere
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
