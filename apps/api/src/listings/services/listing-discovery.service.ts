import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingQueryDto, ListingSort } from '../dto/listing-query.dto.js';
import { ListingCondition, ListingStatus, UserStatus } from '../../generated/prisma/enums.js';
import { ListingSearchService, PaginatedListings } from './listing-search.service.js';
import { ListingFeedService } from './listing-feed.service.js';
import { LISTING_CARD_SELECT, ListingCardRow, toListingCard } from './listing-card.mapper.js';

@Injectable()
export class ListingDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: ListingSearchService,
    private readonly feed: ListingFeedService,
  ) {}

  async getListings(query: ListingQueryDto, feedIdentity?: string, currentUserId?: string): Promise<PaginatedListings> {
    const { page, limit, minPrice, maxPrice, condition, negotiable, search, category, city, subcity, sort } = query;
    const now = new Date();
    const normalizedSearch = search?.trim();

    const orderBy = (() => {
      switch (sort) {
        case ListingSort.OLDEST:
          return [
            { publishedAt: 'asc' as const },
            { id: 'asc' as const },
          ];

        case ListingSort.PRICE_LOW:
          return [
            { priceCents: 'asc' as const },
            { publishedAt: 'desc' as const },
            { id: 'asc' as const },
          ];

        case ListingSort.PRICE_HIGH:
          return [
            { priceCents: 'desc' as const },
            { publishedAt: 'desc' as const },
            { id: 'desc' as const },
          ];

        case ListingSort.NEWEST:
        default:
          return [
            { publishedAt: 'desc' as const },
            { id: 'desc' as const },
          ];
      }
    })();

    // Resolve category slug → ids
    let categoryIds: string[] | undefined;
    if (category) {
      const ids = await this.search.getCategoryIds(category);
      if (!ids) throw new BadRequestException(`Category "${category}" not found.`);
      categoryIds = ids;
    }

    // Resolve city/subcity names → ids
    const { cityId, subcityId } = await this.search.resolveLocationIds(city, subcity);

    if (normalizedSearch && normalizedSearch.length >= 2) {
      return this.search.searchListings(normalizedSearch, {
        page, limit, now, categoryIds, cityId, subcityId, minPrice, maxPrice, condition, negotiable, sort,
      }, currentUserId);
    }

    // Stage 6: deterministic feed variety — only for the pure discovery feed
    // (no search, no explicit sort). `sort=newest` is an explicit sort like any
    // other, so it never gets variety. The identity is resolved by the controller:
    // logged-in user.id, or a client-retained anonymous feed seed.
    const isDefaultFeed = sort === undefined;
    if (isDefaultFeed && feedIdentity) {
      return this.getFeedListings({
        page, limit, now, identity: feedIdentity, currentUserId,
        categoryIds, cityId, subcityId, minPrice, maxPrice, condition, negotiable,
      });
    }

    const where = {
      status: ListingStatus.ACTIVE,
      expiresAt: { gt: now },
      seller: { status: UserStatus.ACTIVE },
      ...(categoryIds && { categoryId: { in: categoryIds } }),
      ...(cityId && { cityId }),
      ...(subcityId && { subcityId }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? { priceCents: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) } }
        : {}),
      ...(condition && { condition }),
      ...(negotiable !== undefined && { isNegotiable: negotiable }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        select: LISTING_CARD_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const savedIds = await this.getSavedSet(currentUserId, rows.map((row) => row.id));
    const data = rows.map((row) => toListingCard(row, savedIds.has(row.id)));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * One batch query for the whole page: returns the set of listingIds the current
   * user has saved. Anonymous requests (no userId) skip the query entirely.
   */
  private async getSavedSet(userId: string | undefined, listingIds: string[]): Promise<Set<string>> {
    if (!userId || listingIds.length === 0) return new Set<string>();
    const saved = await this.prisma.savedListing.findMany({
      where: { userId, listingId: { in: listingIds } },
      select: { listingId: true },
    });
    return new Set(saved.map((row) => row.listingId));
  }

  /**
   * Deterministic, seeded ordering for the default feed. Resolves the page from a
   * raw query (recency window -> seeded score -> id), then loads the card rows via
   * Prisma and re-orders them back to the raw query's id order.
   */
  private async getFeedListings(args: {
    page: number;
    limit: number;
    now: Date;
    identity: string;
    currentUserId?: string;
    categoryIds?: string[];
    cityId?: string;
    subcityId?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: ListingCondition;
    negotiable?: boolean;
  }): Promise<PaginatedListings> {
    const { page, limit, now, identity, currentUserId, categoryIds, cityId, subcityId, minPrice, maxPrice, condition, negotiable } = args;
    const seed = this.feed.buildFeedSeed(identity, now);
    const offset = (page - 1) * limit;

    const params: unknown[] = [now];
    const filterClauses: string[] = [];
    if (categoryIds) {
      params.push(categoryIds);
      filterClauses.push(`l."categoryId" = ANY(CAST($${params.length} AS text[]))`);
    }
    if (cityId) {
      params.push(cityId);
      filterClauses.push(`l."cityId" = CAST($${params.length} AS text)`);
    }
    if (subcityId) {
      params.push(subcityId);
      filterClauses.push(`l."subcityId" = CAST($${params.length} AS text)`);
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
    const orderBySql = this.feed.buildFeedOrderBy(seed, now);

    params.push(limit, offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const rows = await this.prisma.$queryRawUnsafe<{ id: string; total: string }[]>(`
      SELECT l.id, COUNT(*) OVER() AS total
      FROM "Listing" l
      JOIN "User" u ON u.id = l."sellerId"
      WHERE l.status = CAST('ACTIVE' AS "ListingStatus")
        AND l."expiresAt" > $1
        AND u.status = CAST('ACTIVE' AS "UserStatus")
        ${extraWhere}
      ORDER BY ${orderBySql}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `, ...params);

    const total = rows.length > 0 ? parseInt(rows[0].total, 10) : 0;

    if (rows.length === 0) {
      return { data: [], meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    const idOrder = rows.map((row) => row.id);
    const fetched = await this.prisma.listing.findMany({
      where: { id: { in: idOrder } },
      select: LISTING_CARD_SELECT,
    });

    const savedIds = await this.getSavedSet(currentUserId, fetched.map((row) => row.id));
    const byId = new Map(fetched.map((row) => [row.id, row]));
    const data = idOrder
      .map((id) => byId.get(id))
      .filter((row): row is ListingCardRow => row !== undefined)
      .map((row) => toListingCard(row, savedIds.has(row.id)));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
