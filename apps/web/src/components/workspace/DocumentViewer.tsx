"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { DocumentPage } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";

interface Props {
  pages: DocumentPage[];
  initialPage: number;
  highlight?: string;
  basePath: string;
}

function findHighlight(text: string, needle: string): [number, number] | null {
  const hay = text.toLowerCase();
  const n = needle.trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return null;
  const normalised = hay.replace(/\s+/g, " ");
  // Try the full passage, then progressively shorter leading fragments.
  for (const len of [n.length, 200, 120, 60, 30]) {
    const frag = n.slice(0, len);
    if (frag.length < 12) break;
    const idx = normalised.indexOf(frag);
    if (idx >= 0) {
      // Map back to the original text by walking whitespace runs.
      let orig = 0;
      let norm = 0;
      while (norm < idx && orig < text.length) {
        if (/\s/.test(text[orig])) {
          while (orig < text.length && /\s/.test(text[orig])) orig++;
          norm++;
        } else {
          orig++;
          norm++;
        }
      }
      let end = orig;
      let count = 0;
      while (count < frag.length && end < text.length) {
        if (/\s/.test(text[end])) {
          while (end < text.length && /\s/.test(text[end])) end++;
          count++;
        } else {
          end++;
          count++;
        }
      }
      return [orig, end];
    }
  }
  return null;
}

export function DocumentViewer({ pages, initialPage, highlight, basePath }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(() => Math.min(Math.max(1, initialPage), Math.max(1, pages.length)));
  const markRef = useRef<HTMLElement>(null);
  const page = pages[current - 1];

  const segments = useMemo(() => {
    if (!page) return null;
    const range = highlight && current === initialPage ? findHighlight(page.text, highlight) : null;
    if (!range) return [{ text: page.text, mark: false }];
    return [
      { text: page.text.slice(0, range[0]), mark: false },
      { text: page.text.slice(range[0], range[1]), mark: true },
      { text: page.text.slice(range[1]), mark: false },
    ];
  }, [page, highlight, current, initialPage]);

  const highlightMissing = Boolean(highlight) && current === initialPage && segments?.every((s) => !s.mark);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [segments]);

  const go = (n: number) => {
    const next = Math.min(Math.max(1, n), pages.length);
    setCurrent(next);
    const q = new URLSearchParams();
    q.set("page", String(next));
    if (highlight && next === initialPage) q.set("q", highlight);
    router.replace(`${basePath}?${q.toString()}`, { scroll: false });
  };

  if (pages.length === 0) {
    return <p className="text-sm text-ink-secondary">No extracted text is available for this document.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
      <nav aria-label="Pages" className="lg:sticky lg:top-8 lg:self-start">
        <div className="flex items-center justify-between lg:flex-col lg:items-stretch lg:gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => go(current - 1)} disabled={current <= 1} aria-label="Previous page">
              <CaretLeft size={16} weight="bold" aria-hidden="true" />
            </Button>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <span className="sr-only">Page</span>
              <input
                type="number"
                min={1}
                max={pages.length}
                value={current}
                onChange={(e) => go(Number(e.currentTarget.value))}
                className="tabular h-9 w-16 rounded-control border border-line-strong bg-surface px-2 text-center text-sm text-ink"
                aria-label={`Page, of ${pages.length}`}
              />
              <span className="tabular">/ {pages.length}</span>
            </label>
            <Button variant="secondary" size="sm" onClick={() => go(current + 1)} disabled={current >= pages.length} aria-label="Next page">
              <CaretRight size={16} weight="bold" aria-hidden="true" />
            </Button>
          </div>
          <ol className="hidden max-h-[60vh] overflow-y-auto rounded-control border border-line lg:block">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => go(p.page_number)}
                  aria-current={p.page_number === current ? "page" : undefined}
                  className={`tabular flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                    p.page_number === current ? "bg-surface-muted font-medium text-ink" : "text-ink-secondary hover:bg-surface-muted/60"
                  }`}
                >
                  <span>Page {p.page_number}</span>
                  <span className="text-xs text-ink-tertiary">{p.char_length.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <article aria-label={`Page ${current}`} className="min-w-0 rounded-panel border border-line bg-surface p-5 sm:p-8">
        {highlightMissing ? (
          <p className="mb-4 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-secondary">
            The referenced passage was not found verbatim on this page. The evidence text may have been edited before it was attached.
          </p>
        ) : null}
        <p className="mb-4 font-mono text-xs text-ink-tertiary tabular">page {current} of {pages.length}</p>
        <div className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-ink">
          {segments?.map((s, i) =>
            s.mark ? (
              <mark key={i} ref={markRef} className="passage">
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </div>
      </article>
    </div>
  );
}
