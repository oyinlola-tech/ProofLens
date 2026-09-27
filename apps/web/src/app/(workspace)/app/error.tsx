"use client";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message =
    error.name === "ApiError" && (error as Error & { userMessage?: string }).userMessage
      ? (error as Error & { userMessage: string }).userMessage
      : "Something went wrong loading this page.";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">This page could not be loaded</h1>
      <Notice>{message}</Notice>
      <div>
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
