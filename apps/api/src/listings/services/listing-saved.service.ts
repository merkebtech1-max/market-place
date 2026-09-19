import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, UserStatus } from '../../generated/prisma/enums.js';
import { SavedListingModel } from '../../generated/prisma/models/SavedListing.js';
import { LISTING_CARD_SELECT, toListingCard } from './listing-card.mapper.js';
import { PaginatedListings } from './listing-search.service.js';

/**
 * Owns the saved-listing lifecycle: save, unsave, and the paginated
 * "my saved listings" feed (newest saved first, lightweight cards).
 */
@Injectable()
export class ListingSavedService {
  private readonly logger = new Logger(ListingSavedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveListing(listingId: string, userId: string): Promise<SavedListingModel> {
    this.logger.log(`[START] Saving listing=${listingId} by userId=${userId}`);

    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          sellerId: true,
          status: true,
          expiresAt: true,
          seller: { select: { status: true } },
        },
      });

      if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      if (listing.sellerId === userId) {
        throw new BadRequestException('You cannot save your own listing.');
      }
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException('Only active listings can be saved.');
      }
      if (!listing.expiresAt || listing.expiresAt <= new Date()) {
        throw new BadRequestException('This listing has expired and can no longer be saved.');
      }
      if (listing.seller.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('This listing is no longer available.');
      }

      try {
        const saved = await this.prisma.savedListing.create({ data: { userId, listingId } });
        this.logger.log(`[SUCCESS] Listing saved: userId=${userId}, listingId=${listingId}`);
        return saved;
      } catch (error) {
        // P2002 = composite key (userId, listingId) already exists — treat repeat saves as idempotent.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existing = await this.prisma.savedListing.findUnique({
            where: { userId_listingId: { userId, listingId } },
          });
          if (existing) {
            this.logger.log(`[SUCCESS] Listing already saved: userId=${userId}, listingId=${listingId}`);
            return existing;
          }
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`[ERROR] Failed to save listing=${listingId} for userId=${userId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to save this listing at this time. Please try again later.');
    }
  }

  async unsaveListing(listingId: string, userId: string): Promise<void> {
    this.logger.log(`[START] Removing saved listing=${listingId} by userId=${userId}`);

    try {
      // deleteMany is idempotent — safe whether or not the row exists.
      await this.prisma.savedListing.deleteMany({ where: { userId, listingId } });
      this.logger.log(`[SUCCESS] Saved listing removed: userId=${userId}, listingId=${listingId}`);
    } catch (error) {
      this.logger.error(`[ERROR] Failed to unsave listing=${listingId} for userId=${userId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to remove this saved listing at this time. Please try again later.');
    }
  }

  async getSavedListings(userId: string, page: number, limit: number): Promise<PaginatedListings> {
    this.logger.log(`[START] Fetching saved listings for userId=${userId}, page=${page}, limit=${limit}`);

    try {
      const skip = (page - 1) * limit;
      // Only currently-visible listings appear in the saved feed; the SavedListing
      // rows are never deleted when a listing becomes unavailable.
      const where = {
        userId,
        listing: {
          status: ListingStatus.ACTIVE,
          expiresAt: { gt: new Date() },
          seller: { status: UserStatus.ACTIVE },
        },
      };

      const [total, rows] = await Promise.all([
        this.prisma.savedListing.count({ where }),
        this.prisma.savedListing.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { listing: { select: LISTING_CARD_SELECT } },
        }),
      ]);

      const data = rows.map((row) => toListingCard(row.listing, true));

      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
      this.logger.error(`[ERROR] Failed to fetch saved listings for userId=${userId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to retrieve your saved listings at this time. Please try again later.');
    }
  }
}