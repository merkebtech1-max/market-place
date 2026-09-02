"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/** AlertTriangle, inlined to avoid pulling in an icon package for one glyph. */
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ErrorState({
  title,
  body,
  retryLabel = "Try again",
  onRetry,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  retryLabel?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-danger/20 bg-danger-soft px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-danger">
        <AlertIcon />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {body && <p className="mx-auto max-w-sm text-sm text-ink-muted">{body}</p>}
      </div>
      {onRetry && (
        <Button variant="danger" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function OfflineBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
      {message}
    </div>
  );
}
