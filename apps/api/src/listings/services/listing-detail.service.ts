import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus } from '../../generated/prisma/enums.js';
import { ListingModel } from '../../generated/prisma/models/Listing.js';

export interface ListingDetailResponse extends ListingModel {
  isSaved: boolean;
}

@Injectable()
export class ListingDetailService {
  private readonly logger = new Logger(ListingDetailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getListing(listingId: string, currentUserId?: string): Promise<ListingDetailResponse> {
    this.logger.log(`[START] Fetching listing=${listingId} ${currentUserId ? `for currentUserId=${currentUserId}` : '(public access)'}`);

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

      if (currentUserId && listing.sellerId === currentUserId) {
        // Owner: can view their own listing in any state (draft, expired, active).
      } else {
        // Anonymous or authenticated non-owner: only currently-visible listings.
        if (listing.status !== ListingStatus.ACTIVE || !listing.expiresAt || listing.expiresAt <= new Date()) {
          throw new NotFoundException('Listing not found.');
        }
      }

      let isSaved = false;
      if (currentUserId) {
        const saved = await this.prisma.savedListing.findUnique({
          where: { userId_listingId: { userId: currentUserId, listingId } },
          select: { listingId: true },
        });
        isSaved = saved !== null;
      }

      this.logger.log(`[SUCCESS] Listing retrieved: listingId=${listingId}, status=${listing.status}, isSaved=${isSaved}`);
      return { ...listing, isSaved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`[ERROR] Failed to get listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to retrieve the listing at this time. Please try again later.');
    }
  }
}
