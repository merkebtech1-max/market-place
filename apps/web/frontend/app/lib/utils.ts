import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer cent amount as Ethiopian Birr, e.g. 450000 -> "4,500 ETB". */
export function formatETB(cents: number, locale: "en" | "am" = "en") {
  const birr = Math.round(cents / 100);
  const formatted = new Intl.NumberFormat(locale === "am" ? "am-ET" : "en-ET").format(birr);
  return locale === "am" ? `${formatted} ብር` : `ETB ${formatted}`;
}

/** Relative time, e.g. "2h ago" / "ከ2 ሰዓት በፊት", falling back to a short date past 7 days. */
export function formatRelativeTime(date: string | Date, locale: "en" | "am" = "en") {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "am" ? "am-ET" : "en", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  for (const [unit, secondsInUnit] of units) {
    if (seconds >= secondsInUnit) {
      return rtf.format(-Math.floor(seconds / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "minute");
}

/** Build the canonical detail path for a listing, e.g. /l/[id]/[slug]. */
export function listingHref(id: string, title: string) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `/l/${id}/${slug || "item"}`;
}

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
