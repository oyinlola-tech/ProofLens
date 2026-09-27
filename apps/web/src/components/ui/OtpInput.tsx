"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

interface Props {
  name: string;
  length: number;
  disabled?: boolean;
  invalid?: boolean;
  /** Changing this value clears the boxes (a fresh code was requested). */
  resetKey?: number | string;
  onComplete?: () => void;
}

/** Segmented one-time-code input: one box per digit, paste-aware, submits a single hidden value. */
export function OtpInput({ name, length, disabled, invalid, resetKey, onComplete }: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const completedRef = useRef("");

  useEffect(() => {
    setDigits(Array.from({ length }, () => ""));
    completedRef.current = "";
    refs.current[0]?.focus();
  }, [resetKey, length]);

  const value = digits.join("");

  useEffect(() => {
    if (value.length === length && value !== completedRef.current) {
      completedRef.current = value;
      onComplete?.();
    }
  }, [value, length, onComplete]);

  const update = (index: number, next: string) => {
    const clean = next.replace(/\D/g, "");
    setDigits((prev) => {
      const copy = [...prev];
      if (!clean) {
        copy[index] = "";
        return copy;
      }
      for (let i = 0; i < clean.length && index + i < length; i++) copy[index + i] = clean[i];
      return copy;
    });
    const target = Math.min(index + Math.max(clean.length, 1), length - 1);
    if (clean) refs.current[target]?.focus();
  };

  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      setDigits((prev) => {
        const copy = [...prev];
        copy[index - 1] = "";
        return copy;
      });
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (index: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    e.preventDefault();
    update(index, text);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2" role="group" aria-label={`${length}-digit verification code`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={length}
            value={d}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            onChange={(e) => update(i, e.currentTarget.value)}
            onKeyDown={onKeyDown(i)}
            onPaste={onPaste(i)}
            onFocus={(e) => e.currentTarget.select()}
            className={`tabular h-14 w-full min-w-0 rounded-control border bg-surface text-center font-mono text-2xl font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60 ${
              invalid ? "border-contradicted" : "border-line-strong"
            }`}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
