export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string;
  /** Emoji glyph — zero-byte, script-neutral icon for the category grid. */
  icon: string;
  listingCount: number;
}
