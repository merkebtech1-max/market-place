import { type ElementType, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

/** Fluid, mobile-first content wrapper — the single source of page gutters. */
export function Container({ as: Tag = "div", className, ...props }: ContainerProps) {
  return <Tag className={cn("mx-auto w-full min-w-0 max-w-7xl px-3 xs:px-4 sm:px-6", className)} {...props} />;
}
