import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, ReportStatus, ReservationStatus, UserStatus } from '../../generated/prisma/enums.js';

export interface AdminOverviewUsers {
  total: number;
  active: number;
  suspended: number;
  deleted: number;
}

export interface AdminOverviewListings {
  total: number;
  draft: number;
  pendingReview: number;
  active: number;
  reserved: number;
  sold: number;
  expired: number;
  removed: number;
}

export interface AdminOverviewReports {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
}

export interface AdminOverviewReservations {
  total: number;
  reserved: number;
  completed: number;
  cancelled: number;
  disputed: number;
  refunded: number;
}

export interface AdminOverview {
  users: AdminOverviewUsers;
  listings: AdminOverviewListings;
  reports: AdminOverviewReports;
  reservations: AdminOverviewReservations;
}

@Injectable()
export class AdminOverviewService {
  private readonly logger = new Logger(AdminOverviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverview> {
    this.logger.log('[START] Building admin overview');

    const [userGroups, listingGroups, reportGroups, reservationGroups] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const users: AdminOverviewUsers = { total: 0, active: 0, suspended: 0, deleted: 0 };
    for (const group of userGroups) {
      const count = group._count._all;
      users.total += count;
      if (group.status === UserStatus.ACTIVE) users.active += count;
      else if (group.status === UserStatus.SUSPENDED) users.suspended += count;
      else if (group.status === UserStatus.DELETED) users.deleted += count;
    }

    const listings: AdminOverviewListings = {
      total: 0, draft: 0, pendingReview: 0, active: 0, reserved: 0, sold: 0, expired: 0, removed: 0,
    };
    for (const group of listingGroups) {
      const count = group._count._all;
      listings.total += count;
      if (group.status === ListingStatus.DRAFT) listings.draft += count;
      else if (group.status === ListingStatus.PENDING_REVIEW) listings.pendingReview += count;
      else if (group.status === ListingStatus.ACTIVE) listings.active += count;
      else if (group.status === ListingStatus.RESERVED) listings.reserved += count;
      else if (group.status === ListingStatus.SOLD) listings.sold += count;
      else if (group.status === ListingStatus.EXPIRED) listings.expired += count;
      else if (group.status === ListingStatus.REMOVED) listings.removed += count;
    }

    const reports: AdminOverviewReports = { total: 0, pending: 0, resolved: 0, dismissed: 0 };
    for (const group of reportGroups) {
      // REVIEWING is the atomic workflow lock while a moderator handles a
      // report — never a dashboard concept. Exclude it from the buckets
      // and from the total rather than folding it into pending.
      if (group.status === ReportStatus.REVIEWING) continue;
      const count = group._count._all;
      reports.total += count;
      if (group.status === ReportStatus.PENDING) reports.pending += count;
      else if (group.status === ReportStatus.RESOLVED) reports.resolved += count;
      else if (group.status === ReportStatus.DISMISSED) reports.dismissed += count;
    }

    const reservations: AdminOverviewReservations = {
      total: 0, reserved: 0, completed: 0, cancelled: 0, disputed: 0, refunded: 0,
    };
    for (const group of reservationGroups) {
      const count = group._count._all;
      reservations.total += count;
      if (group.status === ReservationStatus.RESERVED) reservations.reserved += count;
      else if (group.status === ReservationStatus.COMPLETED) reservations.completed += count;
      else if (group.status === ReservationStatus.CANCELLED) reservations.cancelled += count;
      else if (group.status === ReservationStatus.DISPUTED) reservations.disputed += count;
      else if (group.status === ReservationStatus.REFUNDED) reservations.refunded += count;
    }

    this.logger.log(`[SUCCESS] Admin overview built: users=${users.total}, listings=${listings.total}, reports=${reports.total}, reservations=${reservations.total}`);

    return { users, listings, reports, reservations };
  }
}
