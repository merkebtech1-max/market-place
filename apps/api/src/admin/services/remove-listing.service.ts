import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ListingStatus } from '../../generated/prisma/enums.js';

/** Safe listing summary returned after removing a listing. */
export interface RemoveListingResult {
  id: string;
  title: string;
  status: ListingStatus;
  sellerId: string;
  updatedAt: Date;
}

/** Statuses a moderator is allowed to remove from. */
const REMOVABLE_STATUSES: ListingStatus[] = [
  ListingStatus.DRAFT,
  ListingStatus.PENDING_REVIEW,
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
  ListingStatus.EXPIRED,
];

/**
 * General admin listing removal: listings keep all history (images,
 * messages, reservations, reports); only the status transitions to
 * REMOVED. SOLD listings are preserved as marketplace history and are
 * not removable.
 */
@Injectable()
export class RemoveListingService {
  private readonly logger = new Logger(RemoveListingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async removeListing(moderatorId: string, listingId: string): Promise<RemoveListingResult> {
    this.logger.log(`[START] Removing listing: listing=${listingId}, moderator=${moderatorId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      return this.removeListingInTransaction(tx, moderatorId, listingId);
    });

    this.logger.log(`[SUCCESS] Removed listing=${listingId} by moderator=${moderatorId}`);

    return result;
  }

  /**
   * Canonical listing removal. Transaction-aware: it runs in whatever
   * Prisma transaction the caller provides and never starts its own, so
   * callers composing a larger atomic operation (e.g. report resolution)
   * can use the exact same mutation + audit. Optional reportId is added
   * to the audit diff when removal is driven by report moderation.
   */
  async removeListingInTransaction(
    tx: Prisma.TransactionClient,
    moderatorId: string,
    listingId: string,
    reportId?: string,
  ): Promise<RemoveListingResult> {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
    if (listing.status === ListingStatus.REMOVED) {
      throw new ConflictException('Listing is already removed.');
    }
    if (listing.status === ListingStatus.SOLD) {
      throw new ConflictException('Sold listings cannot be removed; they are preserved marketplace history.');
    }

    // Conditional update: only from a removable status. If a concurrent
    // moderation request already sold/removed/changed it, 0 rows match
    // and the transaction rolls back.
    const updated = await tx.listing.updateMany({
      where: { id: listing.id, status: { in: REMOVABLE_STATUSES } },
      data: { status: ListingStatus.REMOVED },
    });
    if (updated.count === 0) {
      throw new ConflictException('Listing is not in a removable state.');
    }

    await tx.auditLog.create({
      data: {
        actorId: moderatorId,
        action: 'LISTING_REMOVED',
        target: listing.id,
        diff: { from: listing.status, to: ListingStatus.REMOVED, ...(reportId ? { reportId } : {}) },
      },
    });

    const removed = await tx.listing.findUnique({
      where: { id: listing.id },
      select: { id: true, title: true, status: true, sellerId: true, updatedAt: true },
    });

    if (!removed) {
      throw new NotFoundException('Listing not found.');
    }

    return removed;
  }
}
