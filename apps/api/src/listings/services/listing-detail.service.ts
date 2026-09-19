import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus } from '../../generated/prisma/enums.js';
import { ListingModel } from '../../generated/prisma/models/Listing.js';

@Injectable()
export class ListingDetailService {
  private readonly logger = new Logger(ListingDetailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getListing(listingId: string, sellerId?: string): Promise<ListingModel> {
    this.logger.log(`[START] Fetching listing=${listingId} ${sellerId ? `for seller=${sellerId}` : '(public access)'}`);

    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          images: {
            select: {
              id: true,
              storageKey: true,
              width: true,
              height: true,
              blurhash: true,
              phash: true,
              position: true,
            },
            orderBy: { position: 'asc' },
          },
          seller: { select: { id: true, displayName: true, avatarKey: true, ratingAvg: true, ratingCount: true } },
          category: true,
          city: true,
          subcity: true,
        },
      });

      if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);

      if (sellerId) {
        if (listing.sellerId !== sellerId && listing.status !== ListingStatus.ACTIVE) {
          throw new NotFoundException('Listing not found.');
        }
      } else {
        if (listing.status !== ListingStatus.ACTIVE || !listing.expiresAt || listing.expiresAt <= new Date()) {
          throw new NotFoundException('Listing not found.');
        }
      }

      this.logger.log(`[SUCCESS] Listing retrieved: listingId=${listingId}, status=${listing.status}`);
      return listing;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`[ERROR] Failed to get listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to retrieve the listing at this time. Please try again later.');
    }
  }
}
