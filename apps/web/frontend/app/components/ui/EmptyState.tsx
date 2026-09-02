import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center",
        className
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
        >
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {body && <p className="mx-auto max-w-sm text-sm text-ink-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}
