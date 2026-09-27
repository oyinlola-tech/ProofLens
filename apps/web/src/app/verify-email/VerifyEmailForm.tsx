"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { resendVerificationAction, verifyOtpAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { OtpInput } from "@/components/ui/OtpInput";

const CODE_LENGTH = 6;

function useCountdown(initial: number, restartKey: number | string | undefined) {
  const [remaining, setRemaining] = useState(initial);
  useEffect(() => {
    setRemaining(initial);
  }, [initial, restartKey]);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  return remaining;
}

export function VerifyEmailForm({ email: emailParam, sent, cooldown }: { email?: string; sent?: boolean; cooldown?: number }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(verifyOtpAction, {});
  const [resend, resendAction, resending] = useActionState<AuthFormState, FormData>(resendVerificationAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  const email = state.values?.email ?? resend.values?.email ?? emailParam ?? "";
  const [editingEmail, setEditingEmail] = useState(!email);

  const waitSeconds = resend.retryAfter ?? resend.cooldown ?? (sent ? cooldown ?? 0 : 0);
  const waitKey = resend.sentAt ?? resend.retryAfter ?? (sent ? "initial" : undefined);
  const remaining = useCountdown(waitSeconds, waitKey);

  const needsNewCode = state.code === "OTP_EXPIRED" || state.code === "OTP_ATTEMPTS_EXCEEDED";
  const resetKey = `${resend.sentAt ?? 0}-${state.code ?? ""}-${state.attemptsRemaining ?? ""}`;

  return (
    <div>
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <EnvelopeSimple size={24} weight="bold" aria-hidden="true" />
      </span>
      <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-ink md:text-3xl">Confirm your email</h1>
      <p className="mt-2 text-base text-ink-secondary">
        {sent || resend.sent ? (
          <>
            We sent a {CODE_LENGTH}-digit code to <span className="font-medium text-ink">{email}</span>. Enter it below to finish creating your account.
          </>
        ) : (
          <>Enter the {CODE_LENGTH}-digit code from your ProofLens verification email.</>
        )}
      </p>

      {state.error ? (
        <div className="mt-6" aria-live="polite">
          <Notice>{state.error}</Notice>
        </div>
      ) : null}

      <form ref={formRef} action={action} className="mt-6 flex flex-col gap-5">
        {editingEmail ? (
          <Field id="email" label="Email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required placeholder="you@example.org" defaultValue={email} />
          </Field>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3.5 py-2.5 text-sm">
            <span className="min-w-0 truncate text-ink">{email}</span>
            <button type="button" onClick={() => setEditingEmail(true)} className="shrink-0 text-ink-secondary underline underline-offset-4 hover:text-ink">
              Change
            </button>
            <input type="hidden" name="email" value={email} />
          </div>
        )}
        <Field id="otp" label="Verification code" error={state.fieldErrors?.otp} hint={needsNewCode ? "Request a new code below, then enter it here." : "The code expires 10 minutes after it was sent."}>
          <OtpInput name="otp" length={CODE_LENGTH} disabled={pending || needsNewCode} invalid={state.code === "OTP_INVALID"} resetKey={resetKey} onComplete={() => formRef.current?.requestSubmit()} />
        </Field>
        <Button type="submit" size="lg" loading={pending} disabled={needsNewCode} className="w-full">
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      <div className="mt-10 border-t border-line pt-6">
        <p className="text-sm font-medium text-ink">Didn&rsquo;t get the code?</p>
        <p className="mt-1 text-sm text-ink-secondary">Check your spam folder. Requesting a new code cancels the previous one.</p>
        <form action={resendAction} className="mt-3 flex flex-col gap-3" noValidate>
          <input type="hidden" name="email" value={email} />
          {resend.error && remaining <= 0 ? <Notice>{resend.error}</Notice> : null}
          {resend.sent && remaining > 0 ? (
            <p className="text-sm text-ink" role="status">A new code is on its way if this address has a pending verification.</p>
          ) : null}
          <Button type="submit" variant="secondary" loading={resending} disabled={remaining > 0 || !email} className="w-fit">
            {remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink-secondary">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-ink underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
