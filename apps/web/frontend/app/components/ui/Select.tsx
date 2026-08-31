import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronRightIcon } from "./Icon";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, label, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "h-11 w-full appearance-none rounded-control border border-border bg-surface pl-3 pr-9 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronRightIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-ink-muted" />
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";
