"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icon";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "sheet" anchors to the bottom on every width — used for mobile filter sheets. */
  variant?: "modal" | "sheet";
  className?: string;
}

/**
 * Built on the native <dialog> element: free focus trap, Esc-to-close and
 * backdrop, no extra runtime weight against the JS budget (SRS §4).
 */
export function Dialog({ open, onOpenChange, title, children, footer, variant = "modal", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        "m-0 max-h-none w-full max-w-full bg-transparent p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-[1px]",
        variant === "sheet"
          ? "fixed inset-x-0 bottom-0 top-auto"
          : "fixed inset-0 flex items-center justify-center p-4"
      )}
    >
      <div
        className={cn(
          "flex max-h-[85vh] w-full flex-col overflow-hidden bg-surface shadow-elevation-2",
          variant === "sheet" ? "rounded-t-sheet" : "max-w-md rounded-card",
          className
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="tap-target -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:text-ink"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </dialog>
  );
}
