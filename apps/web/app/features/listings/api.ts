import type { Category } from "@/features/catalog/types";
import type { Listing, ListingCondition, SearchFilters } from "./types";
import { apiRequest } from "@/lib/api";
import { authenticatedApiRequest } from "@/lib/auth";

type ApiImage = {
  id?: string;
  storageKey: string;
  width: number | null;
  height: number | null;
};

type ApiCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string;
  children?: ApiCategory[];
};

type ApiLocation = {
  id: string;
  nameEn: string;
  nameAm: string;
  type?: string;
  children?: ApiLocation[];
};

type ApiSeller = {
  id: string;
  displayName: string;
  avatarKey: string | null;
  ratingAvg: string | number;
  ratingCount: number;
};

export type ApiListingCard = {
  id: string;
  title: string;
  priceCents: number;
  condition: string;
  isNegotiable: boolean;
  publishedAt: string;
  thumbnail: ApiImage | null;
  category: ApiCategory;
  city: ApiLocation;
  subcity: ApiLocation | null;
  seller: ApiSeller;
  isSaved: boolean;
};

type ApiListingDetail = ApiListingCard & {
  description: string;
  status: string;
  landmark?: string | null;
  images: ApiImage[];
  viewCount: number;
  saveCount: number;
};

type ListingPage = {
  data: ApiListingCard[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const categoryVisuals: Record<string, Pick<Category, "icon" | "imageUrl">> = {
  "phones-tablets": { icon: "📱", imageUrl: "/phone/Screenshot 2026-09-06 222848.png" },
  electronics: { icon: "🖥️", imageUrl: "/elecronics/Screenshot 2026-09-06 222355.png" },
  vehicles: { icon: "🚗", imageUrl: "/vehicle/Screenshot 2026-09-06 153515.png" },
  furniture: { icon: "🛋️", imageUrl: "/Ferniture/Screenshot 2026-09-06 223820.png" },
  fashion: { icon: "👗", imageUrl: "/cloth and shhse/Screenshot 2026-09-06 221648.png" },
  "kids-baby": { icon: "🧸", imageUrl: "/kids/Screenshot 2026-09-06 223530.png" },
};

function assetUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return "/image/logo.jpg";
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://") || storageKey.startsWith("/")) {
    return storageKey;
  }
  const base = process.env.NEXT_PUBLIC_STORAGE_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/${storageKey}` : "/image/logo.jpg";
}

function condition(value: string): ListingCondition {
  return value.toLowerCase() as ListingCondition;
}

function seller(value: ApiSeller, city: string, subcity: string) {
  return {
    id: value.id,
    handle: value.id,
    displayName: value.displayName,
    avatarUrl: value.avatarKey ? assetUrl(value.avatarKey) : undefined,
    city,
    subcity,
    ratingAvg: Number(value.ratingAvg),
    ratingCount: value.ratingCount,
    responseRate: 0,
    responseTime: "",
    memberSince: "",
  };
}

export function cardToListing(value: ApiListingCard): Listing {
  const city = value.city.nameEn;
  const subcity = value.subcity?.nameEn ?? city;
  return {
    id: value.id,
    title: value.title,
    description: "",
    priceCents: value.priceCents,
    isNegotiable: value.isNegotiable,
    acceptsSwap: false,
    condition: condition(value.condition),
    status: "active",
    categoryId: value.category.id,
    categoryName: value.category.nameEn,
    city,
    subcity,
    images: value.thumbnail
      ? [{ id: value.thumbnail.id ?? value.thumbnail.storageKey, url: assetUrl(value.thumbnail.storageKey), width: value.thumbnail.width ?? 1200, height: value.thumbnail.height ?? 900 }]
      : [],
    seller: seller(value.seller, city, subcity),
    publishedAt: value.publishedAt,
    viewCount: 0,
    saveCount: 0,
    promotion: null,
    isSaved: value.isSaved,
  };
}

function detailToListing(value: ApiListingDetail): Listing {
  const mapped = cardToListing(value);
  return {
    ...mapped,
    description: value.description,
    status: value.status.toLowerCase() as Listing["status"],
    landmark: value.landmark ?? undefined,
    images: value.images.map((image) => ({
      id: image.id ?? image.storageKey,
      url: assetUrl(image.storageKey),
      width: image.width ?? 1200,
      height: image.height ?? 900,
    })),
    viewCount: value.viewCount,
    saveCount: value.saveCount,
  };
}

function queryFromFilters(filters: SearchFilters = {}): URLSearchParams {
  const query = new URLSearchParams({ limit: "50" });
  if (filters.q) query.set("search", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.city) query.set("city", filters.city);
  if (filters.subcity) query.set("subcity", filters.subcity);
  if (filters.condition) query.set("condition", filters.condition.toUpperCase());
  if (filters.minPrice !== undefined) query.set("minPrice", String(Math.round(filters.minPrice * 100)));
  if (filters.maxPrice !== undefined) query.set("maxPrice", String(Math.round(filters.maxPrice * 100)));
  const sorts: Record<string, string> = { newest: "newest", price_asc: "price_low", price_desc: "price_high" };
  const sort = filters.sort ? sorts[filters.sort] : undefined;
  if (sort) query.set("sort", sort);
  return query;
}

export async function getListings(filters: SearchFilters = {}) {
  const result = await apiRequest<ListingPage>(`/listings?${queryFromFilters(filters)}`, { cache: "no-store" });
  return { listings: result.data.map(cardToListing), meta: result.meta };
}

export async function getListing(id: string) {
  const result = await apiRequest<{ success: true; listing: ApiListingDetail }>(`/listings/${id}`, { cache: "no-store" });
  return detailToListing(result.listing);
}

export async function getSavedListings() {
  const result = await authenticatedApiRequest<ListingPage>("/listings/saved?limit=50");
  return result.data.map(cardToListing);
}

export async function saveListing(id: string) {
  await authenticatedApiRequest(`/listings/${id}/save`, { method: "POST" });
}

export async function unsaveListing(id: string) {
  await authenticatedApiRequest(`/listings/${id}/save`, { method: "DELETE" });
}

export async function getCategories(): Promise<Category[]> {
  const result = await apiRequest<{ success: true; categories: ApiCategory[] }>("/categories", { next: { revalidate: 300 } });
  return result.categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    nameEn: category.nameEn,
    nameAm: category.nameAm,
    icon: categoryVisuals[category.slug]?.icon ?? "📦",
    imageUrl: categoryVisuals[category.slug]?.imageUrl ?? "/image/logo.jpg",
    listingCount: 0,
  }));
}

export async function getLocationTree() {
  const result = await apiRequest<{ success: true; locations: ApiLocation[] }>("/locations", {
    cache: "no-store",
  });
  return result.locations;
}

type CreateListingInput = {
  title: string;
  description: string;
  condition: string;
  priceCents: number;
  isNegotiable: boolean;
  attributes: Record<string, unknown>;
  categoryId: string;
  cityId: string;
  subcityId?: string;
  landmark?: string;
};

export async function createListingDraft(input: CreateListingInput) {
  return authenticatedApiRequest<{ success: true; listingId: string; status: string }>("/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateListingDraft(id: string, input: CreateListingInput) {
  return authenticatedApiRequest(`/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function uploadListingImage(id: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return authenticatedApiRequest(`/listings/${id}/images`, { method: "POST", body });
}

export async function publishListing(id: string) {
  return authenticatedApiRequest(`/listings/${id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}
