"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerAction, {});

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Create your account</h1>
      <p className="mt-2 text-sm text-ink-secondary">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>

      {state.error ? (
        <div className="mt-6">
          <Notice>{state.error}</Notice>
        </div>
      ) : null}

      <form action={action} className="mt-6 flex flex-col gap-5" noValidate>
        <Field id="email" label="Email" error={state.fieldErrors?.email} hint="We will send a 6-digit verification code to this address.">
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
            aria-describedby={state.fieldErrors?.email ? "email-error" : "email-hint"}
          />
        </Field>
        <Field id="password" label="Password" error={state.fieldErrors?.password} hint="8 to 128 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            placeholder="At least 8 characters"
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            aria-describedby={state.fieldErrors?.password ? "password-error" : "password-hint"}
          />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          {pending ? "Sending your code…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
