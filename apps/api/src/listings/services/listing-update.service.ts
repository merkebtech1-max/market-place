import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateListingDto } from '../dto/update-listing.dto.js';
import { ListingStatus } from '../../generated/prisma/enums.js';
import { ListingModel } from '../../generated/prisma/models/Listing.js';
import { ListingValidationService } from './listing-validation.service.js';

@Injectable()
export class ListingUpdateService {
  private readonly logger = new Logger(ListingUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: ListingValidationService,
  ) {}

  async updateListing(listingId: string, sellerId: string, dto: UpdateListingDto): Promise<ListingModel> {
    this.logger.log(`[START] Updating listing=${listingId} by seller=${sellerId}`);

    try {
      const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });

      if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      if (listing.sellerId !== sellerId) throw new ForbiddenException('You can only update your own listings.');
      if (listing.status !== ListingStatus.DRAFT) {
        throw new BadRequestException('Only draft listings can be updated. This listing has already been published or has a different status.');
      }

      if ('categoryId' in dto && dto.categoryId) await this.validation.validateCategory(dto.categoryId as string);
      if ('cityId' in dto && dto.cityId) await this.validation.validateCity(dto.cityId as string);
      if ('subcityId' in dto && dto.subcityId) {
        const cityIdToValidate = ('cityId' in dto && dto.cityId) ? dto.cityId as string : listing.cityId;
        await this.validation.validateSubcity(dto.subcityId as string, cityIdToValidate);
      }

      const data = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined && v !== null));
      if (Object.keys(data).length === 0) {
        throw new BadRequestException('At least one listing field is required. Send a JSON body such as { "title": "iPhone 15 Pro Max" }.');
      }

      const updated = await this.prisma.listing.update({ where: { id: listingId }, data });
      this.logger.log(`[SUCCESS] Listing updated: listingId=${listingId}`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) throw error;
      this.logger.error(`[ERROR] Failed to update listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to update your listing at this time. Please try again later.');
    }
  }
}
