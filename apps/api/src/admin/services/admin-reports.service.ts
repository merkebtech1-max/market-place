import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingCondition, ListingStatus, ReportStatus, ReportTargetType, UserStatus } from '../../generated/prisma/enums.js';
import { ListReportsDto } from '../dto/list-reports.dto.js';
import { buildReportSummaryMap, emptyReportSummary, type ReportSummary } from './report-summary.js';

export type { ReportSummary };

type ListingTargetRow = {
  id: string; title: string; status: ListingStatus; priceCents: number; condition: ListingCondition; createdAt: Date;
  seller: { id: string; displayName: string };
};

type UserTargetRow = { id: string; displayName: string; status: UserStatus };

type MessageTargetRow = {
  id: string; body: string;
  sender: { id: string; displayName: string };
  thread: { id: string; listingId: string };
};

export interface ListingTargetContext {
  listing: ListingTargetRow;
  reportSummary: ReportSummary;
}

export interface UserTargetContext {
  user: UserTargetRow;
  reportSummary: ReportSummary;
}

export interface MessageTargetContext {
  message: { id: string; body: string; sender: { id: string; displayName: string } };
  thread: { id: string; listingId: string };
}

export type ReportTargetContext = ListingTargetContext | UserTargetContext | MessageTargetContext;

/** Rich listing context for the moderation detail view. */
export interface ListingDetailContext {
  listing: {
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
    category: { id: string; nameEn: string; nameAm: string } | null;
    city: { id: string; nameEn: string; nameAm: string } | null;
    subcity: { id: string; nameEn: string; nameAm: string } | null;
    // TODO(media): when the storage/media service exists, replace the raw
    // `storageKey` below with a resolved `url` — admin responses should not
    // expose internal storage identifiers.
    images: { id: string; storageKey: string; width: number | null; height: number | null; position: number }[];
  };
  seller: {
    id: string;
    displayName: string;
    avatarKey: string | null;
    status: UserStatus;
    ratingAvg: string;
    ratingCount: number;
    createdAt: Date;
    listingCount: number;
  } | null;
  reportSummary: ReportSummary;
}

/** Rich user profile + activity context for the moderation detail view. */
export interface UserDetailContext {
  user: {
    id: string;
    displayName: string;
    avatarKey: string | null;
    bio: string | null;
    status: UserStatus;
    role: string;
    ratingAvg: string;
    ratingCount: number;
    createdAt: Date;
  };
  activity: {
    activeListings: number;
    soldListings: number;
    removedListings: number;
    totalListings: number;
  };
  reportSummary: ReportSummary;
}

/** Reported message plus surrounding conversation for context. */
export interface MessageDetailContext {
  message: {
    id: string;
    body: string;
    type: string;
    wasRedacted: boolean;
    createdAt: Date;
    sender: { id: string; displayName: string; avatarKey: string | null };
  };
  thread: {
    id: string;
    listingId: string;
    listingTitle: string | null;
    createdAt: Date;
    buyer: { id: string; displayName: string };
    sellerUser: { id: string; displayName: string };
  } | null;
  conversation: {
    id: string;
    body: string;
    type: string;
    createdAt: Date;
    sender: { id: string; displayName: string };
  }[];
}

export type ReportDetailTargetContext = ListingDetailContext | UserDetailContext | MessageDetailContext;

/** Full moderation detail view of a single report. */
export interface AdminReportDetail {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedById: string | null;
  resolution: string | null;
  reporter: { id: string; displayName: string; avatarKey: string | null; status: UserStatus };
  target: ReportDetailTargetContext | null;
}

/** Admin/moderator view of a report, including target-specific context. */
export interface AdminReportView {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  createdAt: Date;
  reporter: { id: string; displayName: string; avatarKey: string | null; status: UserStatus };
  target: ReportTargetContext | null;
}

@Injectable()
export class AdminReportsService {
  private readonly logger = new Logger(AdminReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listReports(query: ListReportsDto): Promise<AdminReportView[]> {
    const status = query.status ?? ReportStatus.PENDING;

    this.logger.log(`[START] Listing reports: status=${status}, targetType=${query.targetType ?? 'all'}`);

    const reports = await this.prisma.report.findMany({
      where: {
        status,
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        note: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, displayName: true, avatarKey: true, status: true } },
      },
    });

    // Batch-load target context: group target IDs by type, run one
    // findMany per type, then join back to reports. Avoids N+1 queries.
    const listingIds = reports.filter((r) => r.targetType === ReportTargetType.LISTING).map((r) => r.targetId);
    const userIds = reports.filter((r) => r.targetType === ReportTargetType.USER).map((r) => r.targetId);
    const messageIds = reports.filter((r) => r.targetType === ReportTargetType.MESSAGE).map((r) => r.targetId);

    // Batch-load report count summaries for LISTING and USER targets in
    // grouped queries. This is historical context across ALL statuses,
    // not just the reports currently passing the dashboard filter, and
    // it must not be derived from the filtered reports array.
    const [listings, users, messages, listingReportSummaryById, userReportSummaryById] = await Promise.all([
      listingIds.length
        ? this.prisma.listing.findMany({
            where: { id: { in: listingIds } },
            select: {
              id: true,
              title: true,
              status: true,
              priceCents: true,
              condition: true,
              createdAt: true,
              seller: { select: { id: true, displayName: true } },
            },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true, status: true },
          })
        : Promise.resolve([]),
      messageIds.length
        ? this.prisma.message.findMany({
            where: { id: { in: messageIds } },
            select: {
              id: true,
              body: true,
              sender: { select: { id: true, displayName: true } },
              thread: { select: { id: true, listingId: true } },
            },
          })
        : Promise.resolve([]),
      this.fetchListingReportSummaries(listingIds),
      this.fetchUserReportSummaries(userIds),
    ]);

    const listingsById = new Map(listings.map((listing) => [listing.id, listing] as const));
    const usersById = new Map(users.map((user) => [user.id, user] as const));
    const messagesById = new Map(messages.map((message) => [message.id, message] as const));

    const views = reports.map((report) => ({
      ...report,
      target: this.resolveTargetContext(
        report.targetType,
        report.targetId,
        listingsById,
        usersById,
        messagesById,
        listingReportSummaryById,
        userReportSummaryById,
      ),
    }));

    this.logger.log(`[SUCCESS] Listed ${views.length} report(s): ${views.map((r) => r.id).join(', ') || 'none'}`);

    return views;
  }

  /** Historical report counts grouped by listing, across ALL statuses. */
  private async fetchListingReportSummaries(listingIds: string[]): Promise<Map<string, ReportSummary>> {
    if (!listingIds.length) return new Map();
    const groups = await this.prisma.report.groupBy({
      by: ['listingId', 'status'],
      where: { listingId: { in: listingIds } },
      _count: { _all: true },
    });
    return buildReportSummaryMap(groups, (group) => group.listingId);
  }

  /** Historical report counts grouped by targeted user, across ALL statuses. */
  private async fetchUserReportSummaries(userIds: string[]): Promise<Map<string, ReportSummary>> {
    if (!userIds.length) return new Map();
    const groups = await this.prisma.report.groupBy({
      by: ['targetId', 'status'],
      where: { targetType: ReportTargetType.USER, targetId: { in: userIds } },
      _count: { _all: true },
    });
    return buildReportSummaryMap(groups, (group) => group.targetId);
  }

  /** Full moderation detail for a single report. Read-only. */
  async getReportDetail(reportId: string): Promise<AdminReportDetail> {
    this.logger.log(`[START] Loading report detail: report=${reportId}`);

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        note: true,
        status: true,
        createdAt: true,
        resolvedById: true,
        resolution: true,
        reporter: { select: { id: true, displayName: true, avatarKey: true, status: true } },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    const target = await this.loadDetailTargetContext(report.targetType, report.targetId);

    this.logger.log(`[SUCCESS] Loaded report detail: report=${reportId}, targetType=${report.targetType}`);

    return { ...report, target };
  }

  /** Load the rich moderation context for a single target. */
  private async loadDetailTargetContext(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ReportDetailTargetContext | null> {
    switch (targetType) {
      case ReportTargetType.LISTING: {
        const listing = await this.prisma.listing.findUnique({
          where: { id: targetId },
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
            category: { select: { id: true, nameEn: true, nameAm: true } },
            city: { select: { id: true, nameEn: true, nameAm: true } },
            subcity: { select: { id: true, nameEn: true, nameAm: true } },
            images: {
              // TODO(media): swap storageKey for a resolved url once the
              // media/storage service exists — see ListingDetailContext.
              select: { id: true, storageKey: true, width: true, height: true, position: true },
              orderBy: { position: 'asc' as const },
            },
            seller: {
              select: {
                id: true,
                displayName: true,
                avatarKey: true,
                status: true,
                ratingAvg: true,
                ratingCount: true,
                createdAt: true,
                _count: { select: { listings: true } },
              },
            },
          },
        });
        if (!listing) return null;

        const summaryById = await this.fetchListingReportSummaries([listing.id]);

        const { seller, ...listingData } = listing;
        return {
          listing: listingData,
          seller: seller
            ? {
                id: seller.id,
                displayName: seller.displayName,
                avatarKey: seller.avatarKey,
                status: seller.status,
                ratingAvg: seller.ratingAvg.toString(),
                ratingCount: seller.ratingCount,
                createdAt: seller.createdAt,
                listingCount: seller._count.listings,
              }
            : null,
          reportSummary: summaryById.get(listing.id) ?? emptyReportSummary(),
        };
      }
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: { id: targetId },
          select: {
            id: true,
            displayName: true,
            avatarKey: true,
            bio: true,
            status: true,
            role: true,
            ratingAvg: true,
            ratingCount: true,
            createdAt: true,
          },
        });
        if (!user) return null;

        const [activeListings, soldListings, removedListings, totalListings, summaryById] = await Promise.all([
          this.prisma.listing.count({ where: { sellerId: user.id, status: ListingStatus.ACTIVE } }),
          this.prisma.listing.count({ where: { sellerId: user.id, status: ListingStatus.SOLD } }),
          this.prisma.listing.count({ where: { sellerId: user.id, status: ListingStatus.REMOVED } }),
          this.prisma.listing.count({ where: { sellerId: user.id } }),
          this.fetchUserReportSummaries([user.id]),
        ]);

        return {
          user: { ...user, ratingAvg: user.ratingAvg.toString() },
          activity: { activeListings, soldListings, removedListings, totalListings },
          reportSummary: summaryById.get(user.id) ?? emptyReportSummary(),
        };
      }
      case ReportTargetType.MESSAGE: {
        const message = await this.prisma.message.findUnique({
          where: { id: targetId },
          select: {
            id: true,
            body: true,
            type: true,
            wasRedacted: true,
            createdAt: true,
            threadId: true,
            sender: { select: { id: true, displayName: true, avatarKey: true } },
            thread: {
              select: {
                id: true,
                listingId: true,
                createdAt: true,
                listing: { select: { title: true } },
                buyer: { select: { id: true, displayName: true } },
                seller: { select: { id: true, displayName: true } },
              },
            },
          },
        });
        if (!message) return null;

        // Small window around the reported message rather than the whole
        // conversation: ~5 messages before and after. Use explicit
        // createdAt bounds — UUID ids are not a safe cursor for a
        // createdAt-ordered query. Ties are handled later if the schema
        // gains a tie-breaking ordering strategy.
        const messageSelect = {
          id: true,
          body: true,
          type: true,
          createdAt: true,
          sender: { select: { id: true, displayName: true } },
        } as const;
        const [beforeNewestFirst, afterOldestFirst] = await Promise.all([
          this.prisma.message.findMany({
            where: { threadId: message.threadId, createdAt: { lt: message.createdAt } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: messageSelect,
          }),
          this.prisma.message.findMany({
            where: { threadId: message.threadId, createdAt: { gt: message.createdAt } },
            orderBy: { createdAt: 'asc' },
            take: 5,
            select: messageSelect,
          }),
        ]);

        const conversation = [
          ...beforeNewestFirst.reverse(),
          {
            id: message.id,
            body: message.body,
            type: message.type,
            createdAt: message.createdAt,
            sender: { id: message.sender.id, displayName: message.sender.displayName },
          },
          ...afterOldestFirst,
        ];

        return {
          message: {
            id: message.id,
            body: message.body,
            type: message.type,
            wasRedacted: message.wasRedacted,
            createdAt: message.createdAt,
            sender: message.sender,
          },
          thread: message.thread
            ? {
                id: message.thread.id,
                listingId: message.thread.listingId,
                listingTitle: message.thread.listing?.title ?? null,
                createdAt: message.thread.createdAt,
                buyer: message.thread.buyer,
                sellerUser: message.thread.seller,
              }
            : null,
          conversation,
        };
      }
    }
  }

  /** Join a report to its pre-fetched target row by id. */
  private resolveTargetContext(
    targetType: ReportTargetType,
    targetId: string,
    listingsById: Map<string, ListingTargetRow>,
    usersById: Map<string, UserTargetRow>,
    messagesById: Map<string, MessageTargetRow>,
    listingReportSummaryById: Map<string, ReportSummary>,
    userReportSummaryById: Map<string, ReportSummary>,
  ): ReportTargetContext | null {
    switch (targetType) {
      case ReportTargetType.LISTING: {
        const listing = listingsById.get(targetId);
        return listing
          ? { listing, reportSummary: listingReportSummaryById.get(targetId) ?? emptyReportSummary() }
          : null;
      }
      case ReportTargetType.USER: {
        const user = usersById.get(targetId);
        return user
          ? { user, reportSummary: userReportSummaryById.get(targetId) ?? emptyReportSummary() }
          : null;
      }
      case ReportTargetType.MESSAGE: {
        const message = messagesById.get(targetId);
        return message
          ? { message: { id: message.id, body: message.body, sender: message.sender }, thread: message.thread }
          : null;
      }
    }
  }
}
