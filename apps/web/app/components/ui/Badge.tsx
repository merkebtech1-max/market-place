import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-ink/5 text-ink-muted",
        primary: "bg-primary-soft text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        featured: "bg-featured-soft text-featured",
        urgent: "bg-urgent-soft text-urgent",
        reserved: "bg-reserved-soft text-reserved",
        swap: "bg-swap-soft text-swap",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
