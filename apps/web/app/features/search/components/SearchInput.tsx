"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SearchIcon } from "@/components/ui/Icon";
import { useTranslations } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * The single search entry point (SRS §3.3 FR-D1), displayed in the Header.
 * Deliberately does not read useSearchParams: it always
 * starts a fresh query, so it never forces the pages that host it (every
 * route, via the Header) out of static rendering.
 */
export function SearchInput({
  autoFocus,
  className,
  defaultValue,
}: {
  autoFocus?: boolean;
  className?: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [query, setQuery] = useState(defaultValue ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "flex h-11 items-stretch overflow-hidden rounded-control border border-border bg-surface transition-colors focus-within:border-primary",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <input
          type="search"
          name="q"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("header.searchPlaceholder")}
          aria-label={t("nav.search")}
          className="h-full w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="tap-target flex shrink-0 items-center gap-1.5 bg-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:px-4"
      >
        <SearchIcon className="h-4 w-4 sm:hidden" />
        <span className="hidden sm:inline">{t("nav.search")}</span>
      </button>
    </form>
  );
}
