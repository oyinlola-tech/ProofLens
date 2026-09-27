"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const steps = [
  { label: "Verification", detail: "Partially supported, 72% confidence" },
  { label: "Evidence used", detail: "1 passage, snapshot kept with the verdict" },
  { label: "Source reference", detail: "recovery-trial-2024.pdf, page 7, Results" },
  { label: "Document", detail: "31 pages, extracted text preserved per page" },
  { label: "Page", detail: "Page 7 opens with the citation in view" },
  { label: "Passage", detail: "“4.1 days shorter in the treatment arm”, highlighted" },
];

/** Provenance chain that advances on its own so the storytelling reads without scrolling. Pauses on hover, static under reduced motion. */
export function Stepper() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const t = window.setInterval(() => setActive((a) => (a + 1) % steps.length), 2200);
    return () => window.clearInterval(t);
  }, [reduce, paused]);

  return (
    <ol
      className="relative rounded-panel border border-line bg-surface p-2 shadow-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {steps.map((s, i) => {
        const on = i === active;
        return (
          <li key={s.label} className="relative">
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-current={on ? "step" : undefined}
              className="relative z-10 flex w-full items-center gap-4 rounded-control px-4 py-3.5 text-left"
            >
              <span className={`font-mono text-xs tabular ${on ? "text-accent" : "text-ink-tertiary"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className={`font-display text-lg font-semibold ${on ? "text-ink" : "text-ink-secondary"}`}>{s.label}</span>
                <span className={`truncate text-sm ${on ? "text-ink-secondary" : "text-ink-tertiary"}`}>{s.detail}</span>
              </span>
            </button>
            {on ? (
              <motion.span
                layoutId="stepper-active"
                aria-hidden="true"
                className="absolute inset-0 rounded-control bg-accent-soft"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
