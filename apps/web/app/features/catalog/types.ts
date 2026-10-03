export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string;
  /** Emoji fallback if the photo is missing. */
  icon: string;
  /** Photo from `public/` used as the category tile. */
  imageUrl: string;
  listingCount: number;
}
