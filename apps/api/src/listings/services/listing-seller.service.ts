import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingModel } from '../../generated/prisma/models/Listing.js';

@Injectable()
export class ListingSellerService {
  private readonly logger = new Logger(ListingSellerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSellerListings(sellerId: string): Promise<ListingModel[]> {
    this.logger.log(`[START] Fetching all listings for seller=${sellerId}`);

    try {
      const listings = await this.prisma.listing.findMany({
        where: { sellerId },
        include: {
          images: { orderBy: { position: 'asc' } },
          category: true,
          city: true,
          subcity: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(`[SUCCESS] Retrieved ${listings.length} listings for seller=${sellerId}`);
      return listings;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to get listings for seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to retrieve your listings at this time. Please try again later.');
    }
  }
}
