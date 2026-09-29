import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateListingDto } from '../dto/create-listing.dto.js';
import { ListingStatus } from '../../generated/prisma/enums.js';
import { ListingValidationService } from './listing-validation.service.js';

export interface CreateListingResult {
  listingId: string;
  status: ListingStatus;
}

@Injectable()
export class ListingCreateService {
  private readonly logger = new Logger(ListingCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: ListingValidationService,
  ) {}

  async createDraft(sellerId: string, dto: CreateListingDto): Promise<CreateListingResult> {
    this.logger.log(`[START] Creating draft listing for seller=${sellerId}, title="${dto.title}", priceCents=${dto.priceCents}`);

    try {
      await this.validation.validateCategory(dto.categoryId);
      await this.validation.validateCity(dto.cityId);
      if (dto.subcityId) {
        await this.validation.validateSubcity(dto.subcityId, dto.cityId);
      }
      await this.validation.validateActiveSeller(sellerId);

      const listing = await this.prisma.listing.create({
        data: {
          sellerId,
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          condition: dto.condition,
          priceCents: dto.priceCents,
          isNegotiable: dto.isNegotiable ?? false,
          attributes: dto.attributes,
          cityId: dto.cityId,
          subcityId: dto.subcityId,
          landmark: dto.landmark,
          status: ListingStatus.DRAFT,
        },
      });

      this.logger.log(`[SUCCESS] Draft listing created: listingId=${listing.id}, sellerId=${sellerId}`);
      return { listingId: listing.id, status: listing.status };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) throw error;
      this.logger.error(`[ERROR] Failed to create draft for seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Unable to create your listing at this time. Please check your input and try again.');
    }
  }
}
