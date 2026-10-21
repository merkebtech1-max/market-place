import { listings } from "@/lib/mock-data";
import type { ListingStatus } from "@/features/listings/types";
import type { SellerCounts, SellerListing, SellerTab } from "./types";

/**
 * Mock backend seam — swap for `GET /me/listings?status=` (server-side
 * filtering, integer ETB cents) once the API exists. The in-memory store lets
 * edits and "mark sold" persist across client navigations in the meantime.
 */
const STATUS_SEED: ListingStatus[] = ["active", "active", "reserved", "draft", "sold", "active", "draft"];

let store: SellerListing[] | null = null;

export function ownListings(): SellerListing[] {
  store ??= listings.slice(0, STATUS_SEED.length).map((l, i) => ({ ...l, status: STATUS_SEED[i] ?? "active" }));
  return store;
}

export function replaceListing(next: SellerListing) {
  store = ownListings().map((l) => (l.id === next.id ? next : l));
}

const tabOf = (status: ListingStatus): SellerTab | null =>
  status === "draft" || status === "active" || status === "reserved" || status === "sold" ? status : null;

export async function getMyListings(tab: SellerTab = "all") {
  const all = ownListings();
  const counts: SellerCounts = { all: 0, draft: 0, active: 0, reserved: 0, sold: 0 };
  for (const l of all) {
    const k = tabOf(l.status);
    if (k) {
      counts[k] += 1;
      counts.all += 1;
    }
  }
  const items = all.filter((l) => (tab === "all" ? tabOf(l.status) !== null : l.status === tab));
  return { items, counts };
}

export async function getMyListing(id: string) {
  return ownListings().find((l) => l.id === id) ?? null;
}
