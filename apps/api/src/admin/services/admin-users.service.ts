import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ListingStatus,
  ReportTargetType,
  UserRole,
  UserStatus,
} from '../../generated/prisma/enums.js';
import { ListUsersDto } from '../dto/list-users.dto.js';
import { summarizeReportGroups, type ReportSummary } from './report-summary.js';

/** Listing activity rollup for an admin user row. */
export interface AdminUserActivity {
  activeListings: number;
  soldListings: number;
  removedListings: number;
  totalListings: number;
}

function emptyActivity(): AdminUserActivity {
  return { activeListings: 0, soldListings: 0, removedListings: 0, totalListings: 0 };
}

/** Admin/moderator directory view of a user. */
export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  avatarKey: string | null;
  bio: string | null;
  status: UserStatus;
  role: UserRole;
  ratingAvg: string;
  ratingCount: number;
  createdAt: Date;
  activity: AdminUserActivity;
}

export interface AdminUsersPage {
  data: AdminUserSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Full moderation view of a single user. */
export interface AdminUserDetail {
  id: string;
  displayName: string | null;
  avatarKey: string | null;
  bio: string | null;
  status: UserStatus;
  role: UserRole;
  ratingAvg: string;
  ratingCount: number;
  createdAt: Date;
  activity: AdminUserActivity;
  reportSummary: ReportSummary;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersDto): Promise<AdminUsersPage> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    this.logger.log(
      `[START] Listing users: search=${query.search ?? 'none'}, status=${query.status ?? 'ALL'}, role=${query.role ?? 'ALL'}, sort=${query.sort ?? 'NEWEST'}, page=${page}, limit=${limit}`,
    );

    const where = {
      ...(query.search
        ? { displayName: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
      ...(query.role && query.role !== 'ALL' ? { role: query.role } : {}),
    };

    const orderBy = query.sort === 'OLDEST' ? { createdAt: 'asc' as const } : { createdAt: 'desc' as const };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
      }),
    ]);

    // One grouped query for the whole page of users — no per-user listing
    // count queries (avoids N+1).
    const sellerIds = users.map((user) => user.id);
    const activityById = await this.fetchActivityBySellerId(sellerIds);

    const data: AdminUserSummary[] = users.map((user) => ({
      ...user,
      ratingAvg: user.ratingAvg.toString(),
      activity: activityById.get(user.id) ?? emptyActivity(),
    }));

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`[SUCCESS] Listed ${data.length} user(s), total=${total}`);

    return { data, pagination: { page, limit, total, totalPages } };
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    this.logger.log(`[START] Loading user detail: user=${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [activityById, reportGroups] = await Promise.all([
      this.fetchActivityBySellerId([user.id]),
      this.prisma.report.groupBy({
        by: ['status'],
        where: { targetType: ReportTargetType.USER, targetId: user.id },
        _count: { _all: true },
      }),
    ]);

    this.logger.log(`[SUCCESS] Loaded user detail: user=${userId}`);

    return {
      ...user,
      ratingAvg: user.ratingAvg.toString(),
      activity: activityById.get(user.id) ?? emptyActivity(),
      reportSummary: summarizeReportGroups(reportGroups),
    };
  }

  /**
   * Listing activity rollups per seller, excluding DRAFT listings from the
   * totals. One grouped query for the whole page — no per-user count queries.
   */
  private async fetchActivityBySellerId(sellerIds: string[]): Promise<Map<string, AdminUserActivity>> {
    const activityById = new Map<string, AdminUserActivity>();
    if (!sellerIds.length) return activityById;

    const listingGroups = await this.prisma.listing.groupBy({
      by: ['sellerId', 'status'],
      where: { sellerId: { in: sellerIds }, status: { not: ListingStatus.DRAFT } },
      _count: { _all: true },
    });

    for (const group of listingGroups) {
      if (!group.sellerId) continue;
      const activity = activityById.get(group.sellerId) ?? emptyActivity();
      const count = group._count._all;
      activity.totalListings += count;
      if (group.status === ListingStatus.ACTIVE) activity.activeListings += count;
      else if (group.status === ListingStatus.SOLD) activity.soldListings += count;
      else if (group.status === ListingStatus.REMOVED) activity.removedListings += count;
      activityById.set(group.sellerId, activity);
    }

    return activityById;
  }
}
