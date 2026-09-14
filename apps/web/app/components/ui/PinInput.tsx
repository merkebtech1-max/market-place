"use client";

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/** Segmented numeric code entry — one box per digit, used for PINs and OTP codes. */
export function PinInput({
  name,
  length = 4,
  label,
  error,
  autoFocus,
}: {
  name: string;
  length?: number;
  label?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const baseId = useId();
  const value = digits.join("");

  function handleChange(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(length).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={`${baseId}-0`} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="flex justify-between gap-1.5 xs:gap-2" role="group" aria-label={label}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            id={`${baseId}-${i}`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              "h-11 w-full max-w-10 rounded-control border bg-surface text-center text-lg font-semibold text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 sm:h-12 sm:max-w-11",
              error ? "border-danger" : "border-border focus:border-primary"
            )}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
