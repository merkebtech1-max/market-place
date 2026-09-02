import Image from "next/image";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: 28,
  md: 40,
  lg: 56,
} as const;

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const px = sizeMap[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ width: px, height: px }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary",
        size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
