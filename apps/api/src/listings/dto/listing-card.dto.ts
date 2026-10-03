import { ListingCondition } from '../../generated/prisma/enums.js';

export class ListingCardThumbnail {
  storageKey: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  position: number;
}

export class ListingCardCategory {
  id: string;
  nameEn: string;
  nameAm: string;
  slug: string;
}

export class ListingCardLocation {
  id: string;
  nameEn: string;
  nameAm: string;
}

export class ListingCardSeller {
  id: string;
  displayName: string;
  avatarKey: string | null;
  ratingAvg: string;
  ratingCount: number;
}

export class ListingCard {
  id: string;
  title: string;
  priceCents: number;
  condition: ListingCondition;
  isNegotiable: boolean;
  publishedAt: Date;
  thumbnail: ListingCardThumbnail | null;
  category: ListingCardCategory;
  city: ListingCardLocation;
  subcity: ListingCardLocation | null;
  seller: ListingCardSeller;
  isSaved: boolean;
}
