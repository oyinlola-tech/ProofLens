"use client";

import { useActionState, useState } from "react";
import { createClaimAction, type ActionState } from "@/lib/actions/claims";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";

export function ClaimComposer({ documentId, compact = false }: { documentId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createClaimAction, {});
  const [length, setLength] = useState(0);

  return (
    <form action={action} className="flex flex-col gap-4">
      {documentId ? <input type="hidden" name="document_id" value={documentId} /> : null}
      {state.error ? <Notice>{state.error}</Notice> : null}
      <Field
        id="claim-text"
        label="What do you want to verify?"
        hint="Write the proposition as a plain statement. The evidence will be judged against exactly this wording."
        error={state.fieldError}
      >
        <Textarea
          id="claim-text"
          name="text"
          required
          minLength={10}
          maxLength={10000}
          rows={compact ? 3 : 5}
          placeholder="This study shows the new policy reduced unemployment by 20% within a year…"
          onChange={(e) => setLength(e.currentTarget.value.length)}
          aria-invalid={state.fieldError ? true : undefined}
          aria-describedby={state.fieldError ? "claim-text-error" : "claim-text-hint"}
          className="text-lg"
        />
      </Field>
      <div className="flex items-center justify-between gap-4">
        <span className="tabular text-xs text-ink-tertiary">{length.toLocaleString()} / 10,000</span>
        <Button type="submit" loading={pending}>
          {pending ? "Creating claim…" : "Continue to evidence"}
        </Button>
      </div>
    </form>
  );
}
