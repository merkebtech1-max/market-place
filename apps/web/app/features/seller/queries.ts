import type { ListingCondition, ListingStatus } from "@/features/listings/types";
import { authenticatedApiRequest } from "@/lib/auth";
import type { SellerCounts, SellerListing, SellerTab } from "./types";

type ApiSellerListing = {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  condition: string;
  priceCents: number;
  isNegotiable: boolean;
  attributes: Record<string, unknown> | null;
  landmark: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  viewCount: number;
  saveCount: number;
  category: { id: string; nameEn: string };
  city: { nameEn: string };
  subcity: { nameEn: string } | null;
  images: Array<{ id: string; storageKey: string; width: number | null; height: number | null }>;
};

function imageUrl(storageKey: string): string {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://") || storageKey.startsWith("/")) {
    return storageKey;
  }
  const base = process.env.NEXT_PUBLIC_STORAGE_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/${storageKey}` : "/image/logo.jpg";
}

function toSellerListing(value: ApiSellerListing): SellerListing {
  const city = value.city.nameEn;
  const subcity = value.subcity?.nameEn ?? city;
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    priceCents: value.priceCents,
    isNegotiable: value.isNegotiable,
    acceptsSwap: value.attributes?.acceptsSwap === true,
    condition: value.condition.toLowerCase() as ListingCondition,
    status: value.status.toLowerCase() as ListingStatus,
    categoryId: value.categoryId,
    categoryName: value.category.nameEn,
    city,
    subcity,
    landmark: value.landmark ?? undefined,
    images: value.images.map((image) => ({
      id: image.id,
      url: imageUrl(image.storageKey),
      width: image.width ?? 1200,
      height: image.height ?? 900,
    })),
    seller: {
      id: value.sellerId,
      handle: value.sellerId,
      displayName: "",
      city,
      subcity,
      ratingAvg: 0,
      ratingCount: 0,
      responseRate: 0,
      responseTime: "",
      memberSince: "",
    },
    publishedAt: value.publishedAt ?? value.createdAt,
    viewCount: value.viewCount,
    saveCount: value.saveCount,
    promotion: null,
  };
}

async function loadAll(): Promise<SellerListing[]> {
  const response = await authenticatedApiRequest<{ success: true; listings: ApiSellerListing[] }>(
    "/listings/my",
    { cache: "no-store" }
  );
  return response.listings.map(toSellerListing);
}

const tabOf = (status: ListingStatus): SellerTab | null =>
  status === "draft" || status === "active" || status === "reserved" || status === "sold" ? status : null;

export async function getMyListings(tab: SellerTab = "all") {
  const all = await loadAll();
  const counts: SellerCounts = { all: 0, draft: 0, active: 0, reserved: 0, sold: 0 };
  for (const listing of all) {
    const key = tabOf(listing.status);
    if (key) {
      counts[key] += 1;
      counts.all += 1;
    }
  }
  const items = all.filter((listing) =>
    tab === "all" ? tabOf(listing.status) !== null : listing.status === tab
  );
  return { items, counts };
}

export async function getMyListing(id: string) {
  return (await loadAll()).find((listing) => listing.id === id) ?? null;
}
