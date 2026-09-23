import { Prisma } from '../../generated/prisma/client.js';
import { ListingCard } from '../dto/listing-card.dto.js';

export const LISTING_CARD_SELECT = {
  id: true,
  title: true,
  priceCents: true,
  condition: true,
  isNegotiable: true,
  publishedAt: true,
  images: {
    select: { storageKey: true, width: true, height: true, blurhash: true, position: true },
    orderBy: { position: 'asc' },
    take: 1,
  },
  category: { select: { id: true, nameEn: true, nameAm: true, slug: true } },
  city: { select: { id: true, nameEn: true, nameAm: true } },
  subcity: { select: { id: true, nameEn: true, nameAm: true } },
  seller: { select: { id: true, displayName: true, avatarKey: true, ratingAvg: true, ratingCount: true } },
} satisfies Prisma.ListingSelect;

export type ListingCardRow = Prisma.ListingGetPayload<{ select: typeof LISTING_CARD_SELECT }>;

export function toListingCard(row: ListingCardRow, isSaved: boolean): ListingCard {
  return {
    id: row.id,
    title: row.title,
    priceCents: row.priceCents,
    condition: row.condition,
    isNegotiable: row.isNegotiable,
    publishedAt: row.publishedAt!,
    thumbnail: row.images[0] ?? null,
    category: row.category,
    city: row.city,
    subcity: row.subcity,
    seller: { ...row.seller, ratingAvg: row.seller.ratingAvg.toString() },
    isSaved,
  };
}