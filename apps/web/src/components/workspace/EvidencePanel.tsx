"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CloudArrowUp, FileText, TextAa, Trash } from "@phosphor-icons/react";
import { clientRequest, uploadFile } from "@/lib/api/client";
import { toUserMessage } from "@/lib/api/errors";
import { addDocumentEvidenceAction, addPastedEvidenceAction, removeEvidenceAction, type ActionState } from "@/lib/actions/claims";
import type { Document, DocumentPages, Evidence } from "@/lib/api/types";
import { formatBytes, formatNumber, truncate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { ProcessingBadge } from "@/components/ui/Badge";

interface Props {
  claimId: string;
  evidence: Evidence[];
  documents: Document[];
  /** Map of document id to filename for the evidence list. */
  documentNames: Record<string, string>;
  initialDocumentId?: string;
  locked: boolean;
}

type Tab = "upload" | "paste" | "library";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; name: string; loaded: number; total: number }
  | { kind: "processing"; name: string }
  | { kind: "failed"; name: string; message: string }
  | { kind: "ready"; document: Document };

const ACCEPT = ".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv";
const MAX_BYTES = 50 * 1024 * 1024;

export function EvidencePanel({ claimId, evidence, documents, documentNames, initialDocumentId, locked }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialDocumentId ? "library" : "upload");
  const [picking, setPicking] = useState<Document | null>(() => documents.find((d) => d.id === initialDocumentId) ?? null);

  const tabs: { id: Tab; label: string; icon: typeof CloudArrowUp }[] = [
    { id: "upload", label: "Upload a document", icon: CloudArrowUp },
    { id: "paste", label: "Paste text", icon: TextAa },
    { id: "library", label: "From your documents", icon: FileText },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="evidence-list">
        <div className="flex items-baseline justify-between">
          <h2 id="evidence-list" className="text-base font-semibold text-ink">Evidence attached</h2>
          <span className="tabular text-sm text-ink-tertiary">{evidence.length}</span>
        </div>
        {evidence.length === 0 ? (
          <p className="mt-3 rounded-panel border border-dashed border-line-strong px-5 py-6 text-sm text-ink-secondary">
            No evidence attached yet. Upload a document, paste a passage, or pick from your library below.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {evidence.map((e, i) => (
              <EvidenceRow key={e.id} evidence={e} index={i} claimId={claimId} documentName={e.source_document_id ? documentNames[e.source_document_id] : undefined} locked={locked} />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="add-evidence" className="rounded-panel border border-line bg-surface">
        <div className="border-b border-line px-5 pt-4">
          <h2 id="add-evidence" className="text-base font-semibold text-ink">Add evidence</h2>
          <div role="tablist" aria-label="Evidence source" className="-mb-px mt-3 flex gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  id={`tab-${t.id}`}
                  onClick={() => {
                    setTab(t.id);
                    setPicking(null);
                  }}
                  className={`flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
                    active ? "border-ink font-medium text-ink" : "border-transparent text-ink-secondary hover:text-ink"
                  }`}
                >
                  <Icon size={16} aria-hidden="true" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5">
          {picking ? (
            <PassagePicker claimId={claimId} document={picking} onDone={() => { setPicking(null); router.refresh(); }} onCancel={() => setPicking(null)} />
          ) : tab === "upload" ? (
            <Uploader onReady={(d) => setPicking(d)} />
          ) : tab === "paste" ? (
            <PasteForm claimId={claimId} />
          ) : (
            <Library documents={documents} onPick={(d) => setPicking(d)} />
          )}
        </div>
      </section>
    </div>
  );
}

function EvidenceRow({ evidence, index, claimId, documentName, locked }: { evidence: Evidence; index: number; claimId: string; documentName?: string; locked: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  const remove = async () => {
    setRemoving(true);
    setError(null);
    const res = await removeEvidenceAction(evidence.id, claimId);
    setRemoving(false);
    setConfirm(false);
    if (res.error) setError(res.error);
    else router.refresh();
  };

  const q = new URLSearchParams();
  if (evidence.source_page) q.set("page", String(evidence.source_page));
  q.set("q", evidence.content.slice(0, 300));
  q.set("from", `/app/claims/${claimId}`);

  return (
    <li className="rounded-panel border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="tabular mt-0.5 font-mono text-xs text-ink-tertiary">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium text-ink">{documentName ?? "Document no longer available"}</span>
            {evidence.source_page ? <span className="font-mono text-xs text-ink-tertiary tabular">page {evidence.source_page}</span> : null}
            {evidence.source_section ? <span className="text-xs text-ink-tertiary">{evidence.source_section}</span> : null}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{truncate(evidence.content, 280)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {evidence.source_document_id && documentName ? (
              <Link href={`/app/documents/${evidence.source_document_id}?${q.toString()}`} className="text-ink underline underline-offset-4">
                View in document
              </Link>
            ) : null}
            {!locked ? (
              confirm ? (
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="danger" loading={removing} onClick={remove}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-ink-secondary hover:text-contradicted">
                  <Trash size={14} aria-hidden="true" /> Remove
                </button>
              )
            ) : null}
          </div>
          {error ? <div className="mt-2"><Notice>{error}</Notice></div> : null}
        </div>
      </div>
    </li>
  );
}

function Uploader({ onReady }: { onReady: (d: Document) => void }) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => () => abortRef.current?.(), []);

  const start = (file: File) => {
    if (file.size > MAX_BYTES) {
      setState({ kind: "failed", name: file.name, message: `That file is ${formatBytes(file.size)}. The limit is 50 MB.` });
      return;
    }
    setState({ kind: "uploading", name: file.name, loaded: 0, total: file.size });
    const { promise, abort } = uploadFile<Document>("/documents/upload", file, (p) => {
      setState((s) => (s.kind === "uploading" ? { ...s, loaded: p.loaded, total: p.total } : s));
      if (p.loaded >= p.total) setState({ kind: "processing", name: file.name });
    });
    abortRef.current = abort;
    promise
      .then((doc) => {
        // The backend processes synchronously; the response carries the real status.
        if (doc.processing_status === "processed") {
          setState({ kind: "ready", document: doc });
          router.refresh();
        } else if (doc.processing_status === "failed") {
          setState({ kind: "failed", name: file.name, message: "The file was received but its text could not be extracted. Try a different copy." });
        } else {
          setState({ kind: "processing", name: file.name });
          // Poll the real status rather than assuming success.
          poll(doc.id, file.name);
        }
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") {
          setState({ kind: "idle" });
          return;
        }
        setState({ kind: "failed", name: file.name, message: toUserMessage(e) });
      });
  };

  const poll = async (id: string, name: string, attempt = 0) => {
    try {
      const doc = await clientRequest<Document>(`/documents/${id}`);
      if (doc.processing_status === "processed") {
        setState({ kind: "ready", document: doc });
        router.refresh();
      } else if (doc.processing_status === "failed") {
        setState({ kind: "failed", name, message: "Processing failed for this file. Try a different copy." });
      } else if (attempt < 30) {
        window.setTimeout(() => poll(id, name, attempt + 1), 2000);
      } else {
        setState({ kind: "failed", name, message: "Processing is taking longer than expected. Check the Documents page later." });
      }
    } catch (e) {
      setState({ kind: "failed", name, message: toUserMessage(e) });
    }
  };

  if (state.kind === "uploading" || state.kind === "processing") {
    const pct = state.kind === "uploading" && state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 100;
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        <p className="truncate text-sm font-medium text-ink">{state.name}</p>
        <p className="text-sm text-ink-secondary">{state.kind === "uploading" ? `Uploading… ${pct}%` : "Processing… extracting pages and text"}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className={`h-full rounded-full bg-ink transition-[width] duration-200 ${state.kind === "processing" ? "animate-pulse" : ""}`} style={{ width: `${pct}%` }} />
        </div>
        {state.kind === "uploading" ? (
          <div>
            <Button size="sm" variant="ghost" onClick={() => abortRef.current?.()}>Cancel</Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (state.kind === "ready") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="info">
          <span className="font-medium text-ink">{state.document.filename}</span> is ready ({formatNumber(state.document.content_length)} characters extracted).
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onReady(state.document)}>Select the passage to use</Button>
          <Button variant="ghost" onClick={() => setState({ kind: "idle" })}>Upload another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.kind === "failed" ? (
        <Notice action={<Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>Choose another file</Button>}>
          Upload failed for <span className="font-medium">{state.name}</span>. {state.message}
        </Notice>
      ) : null}
      <label
        htmlFor="evidence-file"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) start(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-muted/60"
        }`}
      >
        <CloudArrowUp size={28} aria-hidden="true" className="text-ink-tertiary" />
        <span className="text-sm font-medium text-ink">Drop a PDF or text file here, or click to choose</span>
        <span className="text-xs text-ink-tertiary">PDF, TXT, MD or CSV, up to 50&nbsp;MB. Pages are extracted so you can cite them.</span>
        <input
          ref={inputRef}
          id="evidence-file"
          name="file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) start(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}

function PasteForm({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addPastedEvidenceAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [doneKey, setDoneKey] = useState(0);

  useEffect(() => {
    if (!pending && state && !state.error && !state.fieldError && doneKey > 0) {
      formRef.current?.reset();
    }
  }, [pending, state, doneKey]);

  return (
    <form ref={formRef} action={(fd) => { setDoneKey((k) => k + 1); action(fd); }} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="claim_id" value={claimId} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <Field id="paste-label" label="Where is this from?" hint="A short label, such as the paper title or the URL. Optional.">
        <Input id="paste-label" name="label" maxLength={255} placeholder="Recovery trial, 2024, section 3.2…" autoComplete="off" />
      </Field>
      <Field id="paste-content" label="Evidence passage" error={state.fieldError} hint="Paste the exact text. It is stored as its own source so the verdict can point back to it.">
        <Textarea id="paste-content" name="content" required minLength={20} maxLength={50000} rows={6} placeholder="Median time to recovery was 4.1 days shorter in the treatment arm…" aria-invalid={state.fieldError ? true : undefined} />
      </Field>
      <div>
        <Button type="submit" loading={pending}>{pending ? "Attaching…" : "Attach as evidence"}</Button>
      </div>
    </form>
  );
}

function Library({ documents, onPick }: { documents: Document[]; onPick: (d: Document) => void }) {
  const ready = documents.filter((d) => d.processing_status === "processed");
  if (documents.length === 0) {
    return <p className="text-sm text-ink-secondary">You have not uploaded any documents yet. Use the Upload tab to add one.</p>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {documents.map((d) => {
        const ok = d.processing_status === "processed";
        return (
          <li key={d.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{d.filename}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-tertiary">
                <span className="uppercase">{d.document_type}</span>
                <span className="tabular">{formatNumber(d.content_length)} characters</span>
                <ProcessingBadge status={d.processing_status} />
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled={!ok} onClick={() => onPick(d)}>
              Select passage
            </Button>
          </li>
        );
      })}
      {ready.length === 0 ? <li className="py-3 text-sm text-ink-secondary">None of your documents are ready to use yet.</li> : null}
    </ul>
  );
}

function PassagePicker({ claimId, document, onDone, onCancel }: { claimId: string; document: Document; onDone: () => void; onCancel: () => void }) {
  const [pages, setPages] = useState<DocumentPages | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [content, setContent] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(addDocumentEvidenceAction, {});
  const submittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    clientRequest<DocumentPages>(`/documents/${document.id}/pages`)
      .then((p) => {
        if (cancelled) return;
        setPages(p);
        const first = p.pages[0];
        if (first) setContent(first.text.slice(0, 50000));
      })
      .catch((e) => !cancelled && setLoadError(toUserMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  useEffect(() => {
    if (submittedRef.current && !pending && !state.error && !state.fieldError) {
      submittedRef.current = false;
      onDone();
    }
  }, [pending, state, onDone]);

  const choosePage = (n: number) => {
    if (!pages) return;
    const p = pages.pages.find((x) => x.page_number === n);
    if (!p) return;
    setPage(n);
    setContent(p.text.slice(0, 50000));
  };

  if (loadError) return <Notice action={<Button size="sm" variant="secondary" onClick={onCancel}>Back</Button>}>{loadError}</Notice>;
  if (!pages) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  return (
    <form action={(fd) => { submittedRef.current = true; action(fd); }} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="claim_id" value={claimId} />
      <input type="hidden" name="document_id" value={document.id} />
      <input type="hidden" name="page" value={pages.total_pages > 0 ? page : ""} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-ink">{document.filename}</p>
        <Link href={`/app/documents/${document.id}?page=${page}`} target="_blank" rel="noopener" className="text-sm text-ink-secondary underline underline-offset-4 hover:text-ink">
          Open full document
        </Link>
      </div>
      {state.error ? <Notice>{state.error}</Notice> : null}
      {pages.total_pages > 1 ? (
        <Field id="pick-page" label="Page" hint={`This document has ${pages.total_pages} pages. The page text is loaded below; trim it to the relevant passage.`}>
          <select
            id="pick-page"
            value={page}
            onChange={(e) => choosePage(Number(e.currentTarget.value))}
            className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink sm:w-48"
            style={{ backgroundColor: "var(--surface)", color: "var(--ink)" }}
          >
            {pages.pages.map((p) => (
              <option key={p.id} value={p.page_number}>
                Page {p.page_number}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field id="pick-content" label="Passage to use as evidence" error={state.fieldError} hint="Keep only the sentences that bear on the claim. The verdict will cite this text and page.">
        <Textarea id="pick-content" name="content" required minLength={20} maxLength={50000} rows={8} value={content} onChange={(e) => setContent(e.currentTarget.value)} aria-invalid={state.fieldError ? true : undefined} />
      </Field>
      <Field id="pick-section" label="Section" hint="Optional, such as “Results” or “Table 2”.">
        <Input id="pick-section" name="section" maxLength={255} autoComplete="off" placeholder="Results…" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>{pending ? "Attaching…" : "Attach as evidence"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
