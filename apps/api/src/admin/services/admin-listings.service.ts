import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingCondition, ListingStatus, ReportTargetType, UserStatus } from '../../generated/prisma/enums.js';
import { ListListingsDto } from '../dto/list-listings.dto.js';
import { summarizeReportGroups, type ReportSummary } from './report-summary.js';

/** Seller info exposed on an admin listing row. */
export interface AdminListingSeller {
  id: string;
  displayName: string | null;
  avatarKey: string | null;
  status: UserStatus;
}

/** Primary image info — raw storageKey for now, URL resolution comes later. */
export interface AdminListingImage {
  storageKey: string;
  width: number | null;
  height: number | null;
}

/** Admin/moderator directory view of a listing. */
export interface AdminListingSummary {
  id: string;
  title: string;
  priceCents: number;
  isNegotiable: boolean;
  condition: ListingCondition;
  status: ListingStatus;
  createdAt: Date;
  publishedAt: Date | null;
  viewCount: number;
  saveCount: number;
  seller: AdminListingSeller;
  category: { id: string; nameEn: string; nameAm: string } | null;
  city: { id: string; nameEn: string; nameAm: string } | null;
  subcity: { id: string; nameEn: string; nameAm: string } | null;
  image: AdminListingImage | null;
}

export interface AdminListingsPage {
  data: AdminListingSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Admin detail view of a single listing. */
export interface AdminListingDetail {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  isNegotiable: boolean;
  condition: ListingCondition;
  status: ListingStatus;
  landmark: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  viewCount: number;
  saveCount: number;
  seller: {
    id: string;
    displayName: string | null;
    avatarKey: string | null;
    status: UserStatus;
    ratingAvg: string;
    ratingCount: number;
    createdAt: Date;
  };
  category: { id: string; nameEn: string; nameAm: string } | null;
  city: { id: string; nameEn: string; nameAm: string } | null;
  subcity: { id: string; nameEn: string; nameAm: string } | null;
  images: { storageKey: string; width: number | null; height: number | null; position: number }[];
  reportSummary: ReportSummary;
}

@Injectable()
export class AdminListingsService {
  private readonly logger = new Logger(AdminListingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listListings(query: ListListingsDto): Promise<AdminListingsPage> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    this.logger.log(
      `[START] Listing listings: search=${query.search ?? 'none'}, status=${query.status ?? 'ALL'}, categoryId=${query.categoryId ?? 'any'}, cityId=${query.cityId ?? 'any'}, subcityId=${query.subcityId ?? 'any'}, sort=${query.sort ?? 'NEWEST'}, page=${page}, limit=${limit}`,
    );

    const where = {
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.subcityId ? { subcityId: query.subcityId } : {}),
    };

    const orderBy =
      query.sort === 'OLDEST'
        ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    // Deliberately no seller/visibility filtering: admins see drafts,
    // pending-review, reserved, sold, expired, and removed listings,
    // including listings of deleted/suspended sellers.
    const [total, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          priceCents: true,
          isNegotiable: true,
          condition: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          viewCount: true,
          saveCount: true,
          seller: { select: { id: true, displayName: true, avatarKey: true, status: true } },
          category: { select: { id: true, nameEn: true, nameAm: true } },
          city: { select: { id: true, nameEn: true, nameAm: true } },
          subcity: { select: { id: true, nameEn: true, nameAm: true } },
          images: {
            select: { storageKey: true, width: true, height: true },
            orderBy: { position: 'asc' },
            take: 1,
          },
        },
      }),
    ]);

    const data: AdminListingSummary[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceCents: row.priceCents,
      isNegotiable: row.isNegotiable,
      condition: row.condition,
      status: row.status,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
      viewCount: row.viewCount,
      saveCount: row.saveCount,
      seller: row.seller,
      category: row.category,
      city: row.city,
      subcity: row.subcity,
      image: row.images[0] ?? null,
    }));

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`[SUCCESS] Listed ${data.length} listing(s), total=${total}`);

    return { data, pagination: { page, limit, total, totalPages } };
  }

  async getListingDetail(listingId: string): Promise<AdminListingDetail> {
    this.logger.log(`[START] Loading listing detail: listing=${listingId}`);

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        isNegotiable: true,
        condition: true,
        status: true,
        landmark: true,
        createdAt: true,
        publishedAt: true,
        viewCount: true,
        saveCount: true,
        seller: {
          select: {
            id: true,
            displayName: true,
            avatarKey: true,
            status: true,
            ratingAvg: true,
            ratingCount: true,
            createdAt: true,
          },
        },
        category: { select: { id: true, nameEn: true, nameAm: true } },
        city: { select: { id: true, nameEn: true, nameAm: true } },
        subcity: { select: { id: true, nameEn: true, nameAm: true } },
        images: {
          select: { storageKey: true, width: true, height: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }

    const reportGroups = await this.prisma.report.groupBy({
      by: ['status'],
      where: { targetType: ReportTargetType.LISTING, targetId: listing.id },
      _count: { _all: true },
    });

    this.logger.log(`[SUCCESS] Loaded listing detail: listing=${listingId}, status=${listing.status}`);

    return {
      ...listing,
      seller: { ...listing.seller, ratingAvg: listing.seller.ratingAvg.toString() },
      reportSummary: summarizeReportGroups(reportGroups),
    };
  }
}
