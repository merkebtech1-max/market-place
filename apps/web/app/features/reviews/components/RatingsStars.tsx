import { StarIcon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/** Read-only star rating display — used on seller mini-profiles and listing cards. */
export function RatingStars({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="flex items-center" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon
            key={i}
            filled={i < Math.round(value)}
            className={cn(starSize, i < Math.round(value) ? "text-featured" : "text-ink/15")}
          />
        ))}
      </span>
      <span className="sr-only">{value.toFixed(1)} out of 5</span>
      <span className={cn("font-medium text-ink", size === "sm" ? "text-xs" : "text-sm")}>
        {value.toFixed(1)}
      </span>
      {typeof count === "number" && <span className="text-xs text-ink-muted">({count})</span>}
    </span>
  );
}
