import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, wrapperClassName, label, hint, error, prefix, suffix, id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex h-11 items-center gap-2 rounded-control border bg-surface px-3 transition-colors",
            "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            error ? "border-danger" : "border-border"
          )}
        >
          {prefix && <span className="shrink-0 text-sm text-ink-muted">{prefix}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={cn(hintId, errorId) || undefined}
            className={cn(
              "h-full w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none",
              className
            )}
            {...props}
          />
          {suffix && <span className="shrink-0 text-sm text-ink-muted">{suffix}</span>}
        </div>
        {hint && !error && (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
