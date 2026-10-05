import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus } from '../../generated/prisma/enums.js';

/** Safe listing summary returned after restoring a listing. */
export interface RestoreListingResult {
  id: string;
  title: string;
  status: ListingStatus;
  sellerId: string;
  updatedAt: Date;
}

/**
 * Basic restore: REMOVED → ACTIVE. The moderator explicitly decides the
 * listing may participate in the marketplace again; we don't try to
 * reconstruct the pre-removal lifecycle state.
 */
@Injectable()
export class RestoreListingService {
  private readonly logger = new Logger(RestoreListingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async restoreListing(moderatorId: string, listingId: string): Promise<RestoreListingResult> {
    this.logger.log(`[START] Restoring listing: listing=${listingId}, moderator=${moderatorId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found.');
      }
      if (listing.status !== ListingStatus.REMOVED) {
        throw new ConflictException('Listing is not removed.');
      }

      // Conditional update: only REMOVED → ACTIVE. If a concurrent
      // moderation request already changed the status, 0 rows match and
      // the transaction rolls back.
      const updated = await tx.listing.updateMany({
        where: { id: listing.id, status: ListingStatus.REMOVED },
        data: { status: ListingStatus.ACTIVE },
      });
      if (updated.count === 0) {
        throw new ConflictException('Listing is not removed.');
      }

      await tx.auditLog.create({
        data: {
          actorId: moderatorId,
          action: 'LISTING_RESTORED',
          target: listing.id,
          diff: { from: ListingStatus.REMOVED, to: ListingStatus.ACTIVE },
        },
      });

      return tx.listing.findUnique({
        where: { id: listing.id },
        select: { id: true, title: true, status: true, sellerId: true, updatedAt: true },
      });
    });

    if (!result) {
      throw new NotFoundException('Listing not found.');
    }

    this.logger.log(`[SUCCESS] Restored listing=${listingId} by moderator=${moderatorId}`);

    return result;
  }
}
