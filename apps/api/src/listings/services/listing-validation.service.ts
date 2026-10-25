import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LocationType, UserStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class ListingValidationService {
  private readonly logger = new Logger(ListingValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Blocks suspended or deleted sellers from creating or publishing listings. */
  async validateActiveSeller(sellerId: string): Promise<void> {
    this.logger.debug(`[VALIDATION] Checking seller status: sellerId=${sellerId}`);
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, status: true },
    });
    if (!seller || seller.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your account is not active (suspended or deleted), so you cannot create or publish listings. If you believe this is a mistake, please contact support.',
      );
    }
  }

  async validateCategory(categoryId: string): Promise<void> {
    this.logger.debug(`[VALIDATION] Checking category: categoryId=${categoryId}`);
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException(`Category with ID ${categoryId} not found. Please select a valid category.`);
    if (!category.isActive) throw new BadRequestException(`The category "${category.nameEn}" is not available for new listings at this time.`);
  }

  async validateCity(cityId: string): Promise<void> {
    this.logger.debug(`[VALIDATION] Checking city: cityId=${cityId}`);
    const city = await this.prisma.location.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException(`City with ID ${cityId} not found. Please select a valid city.`);
    if (city.type !== LocationType.CITY && city.type !== LocationType.REGION) {
      throw new BadRequestException(`The location "${city.nameEn}" cannot be used as a city. Please select a valid city.`);
    }
  }

  async validateSubcity(subcityId: string, cityId: string): Promise<void> {
    this.logger.debug(`[VALIDATION] Checking subcity: subcityId=${subcityId}, cityId=${cityId}`);
    const subcity = await this.prisma.location.findUnique({ where: { id: subcityId } });
    if (!subcity) throw new NotFoundException(`Subcity with ID ${subcityId} not found. Please select a valid subcity.`);
    if (subcity.type !== LocationType.SUBCITY) {
      throw new BadRequestException(`The location "${subcity.nameEn}" is not a subcity. Please select a valid subcity for your listing.`);
    }
    if (subcity.parentId !== cityId) {
      throw new BadRequestException(`The subcity "${subcity.nameEn}" does not belong to the selected city. Please select a subcity within your chosen city.`);
    }
  }
}
