import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingCondition, ListingStatus, ReportStatus, ReportTargetType, UserStatus } from '../../generated/prisma/enums.js';
import { ListReportsDto } from '../dto/list-reports.dto.js';

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
  target: unknown;
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

    const [listings, users, messages] = await Promise.all([
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
    ]);

    const listingsById = new Map(listings.map((listing) => [listing.id, listing] as const));
    const usersById = new Map(users.map((user) => [user.id, user] as const));
    const messagesById = new Map(messages.map((message) => [message.id, message] as const));

    const views = reports.map((report) => ({
      ...report,
      target: this.resolveTargetContext(report.targetType, report.targetId, listingsById, usersById, messagesById),
    }));

    this.logger.log(`[SUCCESS] Listed ${views.length} report(s): ${views.map((r) => r.id).join(', ') || 'none'}`);

    return views;
  }

  /** Join a report to its pre-fetched target row by id. */
  private resolveTargetContext(
    targetType: ReportTargetType,
    targetId: string,
    listingsById: Map<string, {
      id: string; title: string; status: ListingStatus; priceCents: number; condition: ListingCondition; createdAt: Date;
      seller: { id: string; displayName: string };
    }>,
    usersById: Map<string, { id: string; displayName: string; status: UserStatus }>,
    messagesById: Map<string, {
      id: string; body: string;
      sender: { id: string; displayName: string };
      thread: { id: string; listingId: string };
    }>,
  ) {
    switch (targetType) {
      case ReportTargetType.LISTING: {
        const listing = listingsById.get(targetId);
        return listing ? { listing } : null;
      }
      case ReportTargetType.USER: {
        const user = usersById.get(targetId);
        return user ? { user } : null;
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
