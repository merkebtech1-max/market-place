export type ListingCondition = "new" | "like_new" | "good" | "fair" | "for_parts";

export type ListingStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "reserved"
  | "sold"
  | "expired"
  | "removed";

export interface ListingImage {
  id: string;
  url: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

export interface ListingSeller {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  city: string;
  subcity: string;
  ratingAvg: number;
  ratingCount: number;
  responseRate: number;
  responseTime: string;
  memberSince: string;
  isVerified?: boolean;
  isPremium?: boolean;
}

export type PromotionType = "featured" | "urgent" | "homepage" | null;

export interface Listing {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  isNegotiable: boolean;
  acceptsSwap: boolean;
  condition: ListingCondition;
  status: ListingStatus;
  categoryId: string;
  categoryName: string;
  city: string;
  subcity: string;
  landmark?: string;
  images: ListingImage[];
  seller: ListingSeller;
  publishedAt: string;
  viewCount: number;
  saveCount: number;
  promotion: PromotionType;
  attributes?: Record<string, string>;
}

export interface SearchFilters {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  city?: string;
  subcity?: string;
  swap?: boolean;
  postedWithin?: "24h" | "7d" | "30d";
  sort?: "relevance" | "newest" | "price_asc" | "price_desc";
}
