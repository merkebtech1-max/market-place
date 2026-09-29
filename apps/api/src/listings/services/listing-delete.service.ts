import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class ListingDeleteService {
  private readonly logger = new Logger(ListingDeleteService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deleteListing(listingId: string, sellerId: string): Promise<void> {
    this.logger.log(`[START] Deleting listing=${listingId} by seller=${sellerId}`);

    try {
      const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });

      if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      if (listing.sellerId !== sellerId) throw new ForbiddenException('You can only delete your own listings.');

      const finalStatuses: ListingStatus[] = [ListingStatus.SOLD, ListingStatus.RESERVED, ListingStatus.REMOVED];
      if (finalStatuses.includes(listing.status as ListingStatus)) {
        throw new BadRequestException(
          `Cannot delete listing with status "${listing.status}". Listings that are sold, reserved, or already removed cannot be deleted. Only draft, active, and expired listings can be deleted.`,
        );
      }

      if (listing.status === ListingStatus.ACTIVE || listing.status === ListingStatus.EXPIRED) {
        await this.prisma.listing.update({ where: { id: listingId }, data: { status: ListingStatus.REMOVED } });
        this.logger.log(`[SUCCESS] Listing soft deleted: listingId=${listingId}`);
      } else {
        await this.prisma.listing.delete({ where: { id: listingId } });
        this.logger.log(`[SUCCESS] Listing hard deleted: listingId=${listingId}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) throw error;
      this.logger.error(`[ERROR] Failed to delete listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to delete your listing at this time. Please try again later.');
    }
  }
}
