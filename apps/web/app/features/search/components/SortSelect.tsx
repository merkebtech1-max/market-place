"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/il8n/LanguageProvider";
import type { SearchFilters } from "@/features/listings/types";

const sorts: NonNullable<SearchFilters["sort"]>[] = ["relevance", "newest", "price_asc", "price_desc"];
const labelKey: Record<NonNullable<SearchFilters["sort"]>, string> = {
  relevance: "search.sortRelevance",
  newest: "search.sortNewest",
  price_asc: "search.sortPriceAsc",
  price_desc: "search.sortPriceDesc",
};

export function SortSelect() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("sort") as SearchFilters["sort"]) ?? "relevance";

  function handleChange(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "relevance") params.delete("sort");
    else params.set("sort", sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      aria-label={t("common.sort")}
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      wrapperClassName="w-full sm:w-56"
    >
      {sorts.map((s) => (
        <option key={s} value={s}>
          {t(labelKey[s])}
        </option>
      ))}
    </Select>
  );
}
