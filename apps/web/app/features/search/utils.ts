import type { Listing, ListingCondition, SearchFilters } from "@/features/listings/types";
import { categories } from "@/lib/mock-data";

const CONDITIONS: ListingCondition[] = ["new", "like_new", "good", "fair", "for_parts"];
const POSTED_WITHIN = ["24h", "7d", "30d"] as const;
const SORTS = ["relevance", "newest", "price_asc", "price_desc"] as const;

/** Read filter state out of the URL — the URL is the source of truth (SRS §3.3 FR-D2). */
export function parseFilters(searchParams: Record<string, string | string[] | undefined>): SearchFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const condition = get("condition");
  const postedWithin = get("postedWithin");
  const sort = get("sort");
  const minPrice = get("minPrice");
  const maxPrice = get("maxPrice");

  return {
    q: get("q") || undefined,
    category: get("category") || undefined,
    city: get("city") || undefined,
    condition: condition && CONDITIONS.includes(condition as ListingCondition) ? (condition as ListingCondition) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    swap: get("swap") === "1",
    postedWithin: postedWithin && (POSTED_WITHIN as readonly string[]).includes(postedWithin)
      ? (postedWithin as SearchFilters["postedWithin"])
      : undefined,
    sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as SearchFilters["sort"]) : "relevance",
  };
}

export function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.minPrice) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.swap) params.set("swap", "1");
  if (filters.postedWithin) params.set("postedWithin", filters.postedWithin);
  if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
  return params;
}

export function countActiveFilters(filters: SearchFilters): number {
  return [
    filters.category,
    filters.city,
    filters.condition,
    filters.minPrice,
    filters.maxPrice,
    filters.swap,
    filters.postedWithin,
  ].filter(Boolean).length;
}

const withinMs: Record<NonNullable<SearchFilters["postedWithin"]>, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Mock-data equivalent of `GET /listings` (SRS §10) — filter + sort in memory. */
export function applyFilters(listings: Listing[], filters: SearchFilters): Listing[] {
  const q = filters.q?.trim().toLowerCase();
  const categoryId = filters.category
    ? categories.find((c) => c.slug === filters.category)?.id
    : undefined;

  let results = listings.filter((l) => {
    if (l.status !== "active" && l.status !== "reserved") return false;
    if (q && !`${l.title} ${l.description}`.toLowerCase().includes(q)) return false;
    if (categoryId && l.categoryId !== categoryId) return false;
    if (filters.city && l.city !== filters.city) return false;
    if (filters.condition && l.condition !== filters.condition) return false;
    if (filters.minPrice && l.priceCents < filters.minPrice * 100) return false;
    if (filters.maxPrice && l.priceCents > filters.maxPrice * 100) return false;
    if (filters.swap && !l.acceptsSwap) return false;
    if (filters.postedWithin) {
      const age = Date.now() - new Date(l.publishedAt).getTime();
      if (age > withinMs[filters.postedWithin]) return false;
    }
    return true;
  });

  switch (filters.sort) {
    case "newest":
      results = results.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
      break;
    case "price_asc":
      results = results.sort((a, b) => a.priceCents - b.priceCents);
      break;
    case "price_desc":
      results = results.sort((a, b) => b.priceCents - a.priceCents);
      break;
    default:
      // "relevance": promoted first (bounded, SRS §11), then freshest.
      results = results.sort((a, b) => {
        const promoScore = (l: Listing) => (l.promotion ? 1 : 0);
        return promoScore(b) - promoScore(a) || +new Date(b.publishedAt) - +new Date(a.publishedAt);
      });
  }

  return results;
}
