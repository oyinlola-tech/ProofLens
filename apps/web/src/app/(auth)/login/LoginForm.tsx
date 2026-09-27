"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";

const REASONS: Record<string, string> = {
  expired: "Your session expired. Log in again to continue.",
  revoked: "All sessions were signed out. Log in again to continue.",
};

export function LoginForm({ next, reason }: { next: string; reason?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, {});

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Log in</h1>
      <p className="mt-2 text-sm text-ink-secondary">
        New here?{" "}
        <Link href={`/register${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {reason && REASONS[reason] && !state.error ? <Notice tone="info">{REASONS[reason]}</Notice> : null}
        {state.error ? <Notice>{state.error}</Notice> : null}
        {state.needsConfirmation ? (
          <Notice tone="info">
            <p>Confirm your email address before logging in.</p>
            <Link href={`/verify-email?email=${encodeURIComponent(state.values?.email ?? "")}`} className="mt-2 inline-block font-medium text-ink underline underline-offset-4">
              Enter your verification code
            </Link>
          </Notice>
        ) : null}
      </div>

      <form action={action} className="mt-6 flex flex-col gap-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field id="email" label="Email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            defaultValue={state.values?.email ?? ""}
            placeholder="you@example.org"
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          />
        </Field>
        <Field id="password" label="Password" error={state.fieldErrors?.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="At least 8 characters"
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
