import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Base shimmer block. Compose to build skeletons that match final layout exactly (CLS < 0.1). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-control bg-ink/8", className)}
      {...props}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

export function ListingDetailSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-3">
        <Skeleton className="aspect-4/3 w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-16 shrink-0" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
