export const MAX_LISTING_IMAGES = 5;

export const MAX_LISTING_IMAGE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_LISTING_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedListingImageType = (typeof ALLOWED_LISTING_IMAGE_TYPES)[number];

export const ALLOWED_LISTING_IMAGE_EXTENSIONS: Record<AllowedListingImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};