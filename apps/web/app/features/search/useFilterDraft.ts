"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { SearchFilters } from "@/features/listings/types";
import { countActiveFilters, filtersToSearchParams, parseFilters } from "./utils";

/**
 * Local draft over the URL-encoded filter state (SRS §3.3 FR-D2: "Filter
 * state lives in the URL and is shareable"). Edits stay local until
 * `apply()` pushes them, so typing a price range doesn't navigate on every
 * keystroke; `sort` and `q` are applied immediately by their own controls
 * and are preserved here on apply/clear.
 *
 * The draft is reset whenever the URL's filter params change from outside
 * (sort select, "clear all", browser back/forward) by comparing against the
 * last-seen params key during render — React's documented alternative to
 * calling setState from inside a useEffect for this case.
 */
export function useFilterDraft() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();

  const current = parseFilters(Object.fromEntries(searchParams.entries()));
  const [draft, setDraft] = useState<SearchFilters>(current);
  const [syncedKey, setSyncedKey] = useState(paramsKey);

  if (paramsKey !== syncedKey) {
    setSyncedKey(paramsKey);
    setDraft(current);
  }

  function patch(p: Partial<SearchFilters>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function apply() {
    router.push(`${pathname}?${filtersToSearchParams(draft).toString()}`);
  }

  function clear() {
    const cleared: SearchFilters = { q: current.q, sort: current.sort };
    setDraft(cleared);
    router.push(`${pathname}?${filtersToSearchParams(cleared).toString()}`);
  }

  return { draft, patch, apply, clear, activeCount: countActiveFilters(draft) };
}
