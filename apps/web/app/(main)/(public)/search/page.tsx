import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { FilterSidebar } from "@/features/search/components/FilterSidebar";
import { FilterSheet } from "@/features/search/components/FilterSheet";
import { SortSelect } from "@/features/search/components/SortSelect";
import { SearchResults } from "@/features/search/components/SearchResults";
import { parseFilters } from "@/features/search/utils";
import { getListings } from "@/features/listings/api";
import { T } from "@/il8n/T";

export const metadata: Metadata = { title: "Search — Merkeb Market" };

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ToolbarFallback() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="h-9 w-24 animate-pulse rounded-control bg-ink/8 md:hidden" />
      <div className="ml-auto h-11 w-full max-w-56 animate-pulse rounded-control bg-ink/8" />
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const { listings: results, meta } = await getListings(filters).catch(() => ({
    listings: [],
    meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
  }));

  return (
    <Container className="py-4 sm:py-6">
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ink sm:text-xl">
          {filters.q ? (
            <T k="search.resultsFor" vars={{ query: filters.q }} />
          ) : (
            <T k="search.noQueryTitle" />
          )}
        </h1>
        <p className="text-sm text-ink-muted">
          {meta.total} <T k="common.results" />
        </p>
      </div>

      <div className="flex min-w-0 items-start gap-4 md:gap-6">
        <Suspense fallback={<div className="hidden w-72 shrink-0 md:block" />}>
          <FilterSidebar />
        </Suspense>

        <div className="min-w-0 flex-1 space-y-4">
          <Suspense fallback={<ToolbarFallback />}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <FilterSheet />
              <SortSelect />
            </div>
          </Suspense>

          <SearchResults listings={results} />
        </div>
      </div>
    </Container>
  );
}
