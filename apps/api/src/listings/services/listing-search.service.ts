import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingCondition, LocationType } from '../../generated/prisma/enums.js';
import { ListingCard } from '../dto/listing-card.dto.js';
import { ListingSort } from '../dto/listing-query.dto.js';

export interface SearchFilters {
  page: number;
  limit: number;
  now: Date;
  categoryIds?: string[];
  cityId?: string;
  subcityId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  negotiable?: boolean;
  sort?: ListingSort;
}

export interface PaginatedListings {
  data: ListingCard[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class ListingSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves a category slug to its ID and all active descendant IDs. */
  async getCategoryIds(slug: string): Promise<string[] | null> {
    const root = await this.prisma.category.findFirst({ where: { slug, isActive: true } });
    if (!root) return null;

    const all = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, parentId: true },
    });

    const childrenByParent = new Map<string, string[]>();
    for (const c of all) {
      if (!c.parentId) continue;
      const siblings = childrenByParent.get(c.parentId);
      if (siblings) siblings.push(c.id);
      else childrenByParent.set(c.parentId, [c.id]);
    }

    const ids: string[] = [root.id];
    const queue = [root.id];
    while (queue.length) {
      const children = childrenByParent.get(queue.shift()!);
      if (!children) continue;
      for (const childId of children) {
        ids.push(childId);
        queue.push(childId);
      }
    }
    return ids;
  }

  /** Resolves city and subcity name strings to their IDs. */
  async resolveLocationIds(
    city?: string,
    subcity?: string,
  ): Promise<{ cityId?: string; subcityId?: string }> {
    let cityId: string | undefined;
    if (city) {
      const cityRecord = await this.prisma.location.findFirst({
        where: { nameEn: { equals: city, mode: 'insensitive' } },
      });
      if (!cityRecord) throw new BadRequestException(`City "${city}" not found.`);
      cityId = cityRecord.id;
    }

    let subcityId: string | undefined;
    if (subcity) {
      const subcityRecord = await this.prisma.location.findFirst({
        where: {
          nameEn: { equals: subcity, mode: 'insensitive' },
          type: LocationType.SUBCITY,
          ...(cityId && { parentId: cityId }),
        },
      });
      if (!subcityRecord) throw new BadRequestException(`Subcity "${subcity}" not found${city ? ` under city "${city}"` : ''}.`);
      subcityId = subcityRecord.id;
    }

    return { cityId, subcityId };
  }

  async searchListings(search: string, opts: SearchFilters): Promise<PaginatedListings> {
    const { page, limit, now, categoryIds, cityId, subcityId, minPrice, maxPrice, condition, negotiable, sort } = opts;
    const SIMILARITY_THRESHOLD = 0.20;
    const offset = (page - 1) * limit;

    const filterClauses: string[] = [];
    const params: unknown[] = [search, now, SIMILARITY_THRESHOLD];

    if (categoryIds) {
      params.push(categoryIds);
      filterClauses.push(`l."categoryId" = ANY(CAST($${params.length} AS uuid[]))`);
    }
    if (cityId) {
      params.push(cityId);
      filterClauses.push(`l."cityId" = CAST($${params.length} AS uuid)`);
    }
    if (subcityId) {
      params.push(subcityId);
      filterClauses.push(`l."subcityId" = CAST($${params.length} AS uuid)`);
    }
    if (minPrice !== undefined) {
      params.push(minPrice);
      filterClauses.push(`l."priceCents" >= $${params.length}`);
    }
    if (maxPrice !== undefined) {
      params.push(maxPrice);
      filterClauses.push(`l."priceCents" <= $${params.length}`);
    }
    if (condition) {
      params.push(condition);
      filterClauses.push(`l.condition = CAST($${params.length} AS "ListingCondition")`);
    }
    if (negotiable !== undefined) {
      params.push(negotiable);
      filterClauses.push(`l."isNegotiable" = $${params.length}`);
    }

    const extraWhere = filterClauses.length ? `AND ${filterClauses.join(' AND ')}` : '';

    const sortFragment = (() => {
      switch (sort) {
        case ListingSort.OLDEST:
          return 'l."publishedAt" ASC, l.id ASC';
        case ListingSort.PRICE_LOW:
          return 'l."priceCents" ASC, l."publishedAt" DESC, l.id ASC';
        case ListingSort.PRICE_HIGH:
          return 'l."priceCents" DESC, l."publishedAt" DESC, l.id DESC';
        case ListingSort.NEWEST:
        default:
          return 'l."publishedAt" DESC, l.id DESC';
      }
    })();

    params.push(limit, offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    type SearchRow = {
      id: string; title: string; priceCents: number;
      condition: string; isNegotiable: boolean; publishedAt: Date;
      categoryId: string; categoryNameEn: string; categoryNameAm: string; categorySlug: string;
      cityId: string; cityNameEn: string; cityNameAm: string;
      subcityId: string | null; subcityNameEn: string | null; subcityNameAm: string | null;
      sellerId: string; sellerDisplayName: string; sellerAvatarKey: string | null;
      sellerRatingAvg: string; sellerRatingCount: number;
      imageStorageKey: string | null; imageWidth: number | null; imageHeight: number | null;
      imageBlurhash: string | null; imagePosition: number | null;
      total: string;
    };

    const rows = await this.prisma.$queryRawUnsafe<SearchRow[]>(`
      SELECT
        l.id, l.title, l."priceCents", l.condition, l."isNegotiable", l."publishedAt",
        cat.id AS "categoryId", cat."nameEn" AS "categoryNameEn",
        cat."nameAm" AS "categoryNameAm", cat.slug AS "categorySlug",
        city.id AS "cityId", city."nameEn" AS "cityNameEn", city."nameAm" AS "cityNameAm",
        sub.id AS "subcityId", sub."nameEn" AS "subcityNameEn", sub."nameAm" AS "subcityNameAm",
        u.id AS "sellerId", u."displayName" AS "sellerDisplayName",
        u."avatarKey" AS "sellerAvatarKey", u."ratingAvg" AS "sellerRatingAvg",
        u."ratingCount" AS "sellerRatingCount",
        img."storageKey" AS "imageStorageKey", img.width AS "imageWidth",
        img.height AS "imageHeight", img.blurhash AS "imageBlurhash",
        img.position AS "imagePosition",
        COUNT(*) OVER() AS total
      FROM "Listing" l
      JOIN "User" u ON u.id = l."sellerId"
      JOIN "Category" cat ON cat.id = l."categoryId"
      JOIN "Location" city ON city.id = l."cityId"
      LEFT JOIN "Location" sub ON sub.id = l."subcityId"
      LEFT JOIN LATERAL (
        SELECT "storageKey", width, height, blurhash, position
        FROM "ListingImage"
        WHERE "listingId" = l.id
        ORDER BY position ASC
        LIMIT 1
      ) img ON true
      WHERE l.status = CAST('ACTIVE' AS "ListingStatus")
        AND l."expiresAt" > $2
        AND u.status = CAST('ACTIVE' AS "UserStatus")
        AND word_similarity(
              unaccent(lower($1)),
              unaccent(lower(l.title || ' ' || l.description))
            ) >= $3
        ${extraWhere}
      ORDER BY
        word_similarity(
          unaccent(lower($1)),
          unaccent(lower(l.title || ' ' || l.description))
        ) DESC,
        ${sortFragment}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `, ...params);

    const total = rows.length > 0 ? parseInt(rows[0].total, 10) : 0;

    const data: ListingCard[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceCents: Number(row.priceCents),
      condition: row.condition as ListingCard['condition'],
      isNegotiable: row.isNegotiable,
      publishedAt: row.publishedAt,
      thumbnail: row.imageStorageKey
        ? { storageKey: row.imageStorageKey, width: row.imageWidth, height: row.imageHeight, blurhash: row.imageBlurhash, position: row.imagePosition! }
        : null,
      category: { id: row.categoryId, nameEn: row.categoryNameEn, nameAm: row.categoryNameAm, slug: row.categorySlug },
      city: { id: row.cityId, nameEn: row.cityNameEn, nameAm: row.cityNameAm },
      subcity: row.subcityId ? { id: row.subcityId, nameEn: row.subcityNameEn!, nameAm: row.subcityNameAm! } : null,
      seller: {
        id: row.sellerId, displayName: row.sellerDisplayName, avatarKey: row.sellerAvatarKey,
        ratingAvg: String(row.sellerRatingAvg), ratingCount: Number(row.sellerRatingCount),
      },
    }));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
