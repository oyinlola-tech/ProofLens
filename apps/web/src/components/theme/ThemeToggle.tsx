"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex size-10 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-line hover:text-ink ${className}`}
    >
      {resolved === "dark" ? <Sun size={18} weight="bold" aria-hidden="true" /> : <Moon size={18} weight="bold" aria-hidden="true" />}
    </button>
  );
}

/** Three-way control for the account page. */
export function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const options: { value: "system" | "light" | "dark"; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-full border border-line-strong p-1">
      {options.map((o) => {
        const on = preference === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPreference(o.value)}
            className={`h-9 rounded-full px-4 text-sm transition-colors ${on ? "bg-ink text-canvas" : "text-ink-secondary hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
