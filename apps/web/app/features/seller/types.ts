import type { Listing } from "@/features/listings/types";

/** Dashboard tabs (SRS FR-S dashboard): everything a seller manages, by lifecycle state. */
export const SELLER_TABS = ["all", "draft", "active", "reserved", "sold"] as const;
export type SellerTab = (typeof SELLER_TABS)[number];

export type SellerCounts = Record<SellerTab, number>;

export interface ListingEdit {
  title: string;
  description: string;
  /** Integer ETB cents. */
  priceCents: number;
  isNegotiable: boolean;
  acceptsSwap: boolean;
}

export type SellerListing = Listing;

export class SellerListingError extends Error {
  constructor(public code: "not_found" | "bad_transition" | "invalid") {
    super(code);
  }
}
