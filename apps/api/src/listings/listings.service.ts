import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { PublishListingDto } from './dto/publish-listing.dto.js';
import { ListingStatus } from '../generated/prisma/enums.js';
import { ListingModel } from '../generated/prisma/models/Listing.js';
import { LocationType } from '../generated/prisma/enums.js';

/** Result returned when creating a listing */
export interface CreateListingResult {
  listingId: string;
  status: ListingStatus;
}

/** Result returned when publishing a listing */
export interface PublishListingResult {
  listingId: string;
  status: ListingStatus;
  publishedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Validates that a category exists and is active */
  private async validateCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (!category.isActive) {
      throw new BadRequestException('This category is not available for new listings');
    }
  }

  /** Validates that a city exists and is of type CITY */
  private async validateCity(cityId: string): Promise<void> {
    const city = await this.prisma.location.findUnique({
      where: { id: cityId },
    });
    if (!city) {
      throw new NotFoundException('City not found');
    }
    if (city.type !== LocationType.CITY) {
      throw new BadRequestException('Invalid location: must be a city');
    }
  }

  /** Validates that a subcity exists, is of type SUBCITY, and belongs to the specified city */
  private async validateSubcity(subcityId: string, cityId: string): Promise<void> {
    const subcity = await this.prisma.location.findUnique({
      where: { id: subcityId },
    });
    if (!subcity) {
      throw new NotFoundException('Subcity not found');
    }
    if (subcity.type !== LocationType.SUBCITY) {
      throw new BadRequestException('Invalid location: must be a subcity');
    }
    if (subcity.parentId !== cityId) {
      throw new BadRequestException('Subcity does not belong to the specified city');
    }
  }

  /**
   * Creates a new draft listing.
   * The sellerId is automatically extracted from the authenticated user.
   * Status defaults to DRAFT.
   */
  async createDraft(sellerId: string, dto: CreateListingDto): Promise<CreateListingResult> {
    try {
      this.logger.log(`Creating draft listing for seller=${sellerId}`);

      // Validate category, city, and subcity
      await this.validateCategory(dto.categoryId);
      await this.validateCity(dto.cityId);
      if (dto.subcityId) {
        await this.validateSubcity(dto.subcityId, dto.cityId);
      }

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

      this.logger.log(`Draft listing created listing=${listing.id} seller=${sellerId}`);
      return { listingId: listing.id, status: listing.status };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to create draft listing for seller=${sellerId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to create listing. Please try again.');
    }
  }

  /**
   * Updates an existing listing.
   * Only the seller can update their own listings.
   * Only draft listings can be updated.
   */
  async updateListing(
    listingId: string,
    sellerId: string,
    dto: UpdateListingDto,
  ): Promise<ListingModel> {
    try {
      this.logger.log(`Updating listing=${listingId} by seller=${sellerId}`);

      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (listing.sellerId !== sellerId) {
        throw new ForbiddenException('You can only update your own listings');
      }

      if (listing.status !== ListingStatus.DRAFT) {
        throw new BadRequestException('Only draft listings can be updated');
      }

      // Validate category, city, and subcity if provided
      if ('categoryId' in dto && dto.categoryId) {
        await this.validateCategory(dto.categoryId as string);
      }
      if ('cityId' in dto && dto.cityId) {
        await this.validateCity(dto.cityId as string);
      }
      if ('subcityId' in dto && dto.subcityId) {
        const cityIdToValidate = ('cityId' in dto && dto.cityId) ? dto.cityId as string : listing.cityId;
        await this.validateSubcity(dto.subcityId as string, cityIdToValidate);
      }

      const updated = await this.prisma.listing.update({
        where: { id: listingId },
        data: dto,
      });

      this.logger.log(`Listing updated listing=${listingId} seller=${sellerId}`);
      return updated;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to update listing=${listingId} by seller=${sellerId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to update listing. Please try again.');
    }
  }

  /**
   * Publishes a draft listing.
   * Validates required fields, sets status to ACTIVE,
   * and sets publishedAt and expiresAt timestamps.
   * Uses a transaction to ensure atomicity.
   * Images will be handled by a separate endpoint in the future.
   */
  async publishListing(
    listingId: string,
    sellerId: string,
    dto: PublishListingDto,
  ): Promise<PublishListingResult> {
    try {
      this.logger.log(`Publishing listing=${listingId} by seller=${sellerId}`);

      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (listing.sellerId !== sellerId) {
        throw new ForbiddenException('You can only publish your own listings');
      }

      if (listing.status !== ListingStatus.DRAFT) {
        throw new BadRequestException('Only draft listings can be published');
      }

      // TODO: Validate at least one image when image endpoint is implemented
      // if (!dto.images || dto.images.length === 0) {
      //   throw new BadRequestException('At least one image is required to publish a listing');
      // }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Update listing status and timestamps
        const updated = await tx.listing.update({
          where: { id: listingId },
          data: {
            status: ListingStatus.ACTIVE,
            publishedAt: now,
            expiresAt,
          },
        });

        // TODO: Create listing images when image endpoint is implemented
        // if (dto.images && dto.images.length > 0) {
        //   await tx.listingImage.createMany({
        //     data: dto.images.map((image, index) => ({
        //       listingId,
        //       storageKey: image.storageKey,
        //       width: image.width,
        //       height: image.height,
        //       blurhash: image.blurhash,
        //       phash: image.phash,
        //       position: image.position ?? index,
        //     })),
        //   });
        // }

        return updated;
      });

      this.logger.log(`Listing published listing=${listingId} seller=${sellerId}`);
      return {
        listingId: result.id,
        status: result.status,
        publishedAt: result.publishedAt!,
        expiresAt: result.expiresAt!,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to publish listing=${listingId} by seller=${sellerId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to publish listing. Please try again.');
    }
  }

  /**
   * Gets a single listing by ID.
   * Public access: only returns ACTIVE listings.
   * Authenticated seller: can view their own listings (any status).
   */
  async getListing(listingId: string, sellerId?: string): Promise<ListingModel> {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          images: {
            orderBy: { position: 'asc' },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
              avatarKey: true,
              ratingAvg: true,
              ratingCount: true,
            },
          },
          category: true,
          city: true,
          subcity: true,
        },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      // If sellerId is provided, check ownership
      if (sellerId) {
        if (listing.sellerId !== sellerId) {
          // Not the owner, only show if active
          if (listing.status !== ListingStatus.ACTIVE) {
            throw new NotFoundException('Listing not found');
          }
        }
        // Owner can view their own listings regardless of status
      } else {
        // Public access - only show active listings
        if (listing.status !== ListingStatus.ACTIVE) {
          throw new NotFoundException('Listing not found');
        }
      }

      return listing;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `Failed to get listing=${listingId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to get listing. Please try again.');
    }
  }

  /**
   * Gets all listings for a seller.
   * Returns both draft and active listings.
   */
  async getSellerListings(sellerId: string): Promise<ListingModel[]> {
    try {
      return await this.prisma.listing.findMany({
        where: { sellerId },
        include: {
          images: {
            orderBy: { position: 'asc' },
          },
          category: true,
          city: true,
          subcity: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get listings for seller=${sellerId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to get listings. Please try again.');
    }
  }

  /**
   * Deletes a listing.
   * Only the seller can delete their own listings.
   * Draft listings: hard delete (permanent removal).
   * Active and EXPIRED listings: soft delete (status changed to REMOVED).
   * Sold, Reserved, and REMOVED listings cannot be deleted.
   */
  async deleteListing(listingId: string, sellerId: string): Promise<void> {
    try {
      this.logger.log(`Deleting listing=${listingId} by seller=${sellerId}`);

      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (listing.sellerId !== sellerId) {
        throw new ForbiddenException('You can only delete your own listings');
      }

      // Prevent deletion of listings with final statuses
      const finalStatuses: ListingStatus[] = [
        ListingStatus.SOLD,
        ListingStatus.RESERVED,
        ListingStatus.REMOVED,
      ];
      if (finalStatuses.includes(listing.status as ListingStatus)) {
        throw new BadRequestException(
          `Cannot delete listing with status ${listing.status}. Only draft, active, and expired listings can be deleted.`,
        );
      }

      // Soft delete for active and expired listings, hard delete for drafts
      if (listing.status === ListingStatus.ACTIVE || listing.status === ListingStatus.EXPIRED) {
        await this.prisma.listing.update({
          where: { id: listingId },
          data: { status: ListingStatus.REMOVED },
        });
        this.logger.log(`Listing soft deleted (status to REMOVED) listing=${listingId} seller=${sellerId}`);
      } else {
        await this.prisma.listing.delete({
          where: { id: listingId },
        });
        this.logger.log(`Listing hard deleted listing=${listingId} seller=${sellerId}`);
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to delete listing=${listingId} by seller=${sellerId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to delete listing. Please try again.');
    }
  }
}
