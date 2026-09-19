import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PublishListingDto } from '../dto/publish-listing.dto.js';
import { ListingStatus } from '../../generated/prisma/enums.js';
import { ListingValidationService } from './listing-validation.service.js';

export interface PublishListingResult {
  listingId: string;
  status: ListingStatus;
  publishedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ListingPublishService {
  private readonly logger = new Logger(ListingPublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: ListingValidationService,
  ) {}

  async publishListing(listingId: string, sellerId: string, _dto: PublishListingDto): Promise<PublishListingResult> {
    this.logger.log(`[START] Publishing listing=${listingId} by seller=${sellerId}`);

    try {
      const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });

      if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      if (listing.sellerId !== sellerId) throw new ForbiddenException('You can only publish your own listings.');
      if (listing.status !== ListingStatus.DRAFT) {
        throw new BadRequestException('Only draft listings can be published. This listing has already been published or has a different status.');
      }
      await this.validation.validateActiveSeller(sellerId);

      const now = new Date();
      // TODO: Implement moderator-controlled expiry. For now, listings effectively never expire (5 years).
      const expiresAt = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.$transaction(async (tx) => {
        return tx.listing.update({
          where: { id: listingId },
          data: { status: ListingStatus.ACTIVE, publishedAt: now, expiresAt },
        });
      });

      this.logger.log(`[SUCCESS] Listing published: listingId=${listingId}, expiresAt=${expiresAt.toISOString()}`);
      return { listingId: result.id, status: result.status, publishedAt: result.publishedAt!, expiresAt: result.expiresAt! };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) throw error;
      this.logger.error(`[ERROR] Failed to publish listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to publish your listing at this time. Please try again later.');
    }
  }
}
