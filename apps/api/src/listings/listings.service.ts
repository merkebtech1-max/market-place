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
    this.logger.debug(`[VALIDATION] Checking category existence and active status: categoryId=${categoryId}`);
    
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    
    if (!category) {
      this.logger.warn(`[VALIDATION] Category not found: categoryId=${categoryId}`);
      throw new NotFoundException(`Category with ID ${categoryId} not found. Please select a valid category.`);
    }
    
    if (!category.isActive) {
      this.logger.warn(`[VALIDATION] Category is not active: categoryId=${categoryId}, name=${category.nameEn}`);
      throw new BadRequestException(`The category "${category.nameEn}" is not available for new listings at this time.`);
    }
    
    this.logger.debug(`[VALIDATION] Category validated successfully: categoryId=${categoryId}, name=${category.nameEn}`);
  }

  /**
   * Validates that a location is usable as a city.
   * Accepts CITY type or REGION type — Addis Ababa is a region whose
   * subcities are direct children with no intermediate city layer.
   */
  private async validateCity(cityId: string): Promise<void> {
    this.logger.debug(`[VALIDATION] Checking city existence and type: cityId=${cityId}`);

    const city = await this.prisma.location.findUnique({ where: { id: cityId } });

    if (!city) {
      this.logger.warn(`[VALIDATION] City not found: cityId=${cityId}`);
      throw new NotFoundException(`City with ID ${cityId} not found. Please select a valid city.`);
    }

    if (city.type !== LocationType.CITY && city.type !== LocationType.REGION) {
      this.logger.warn(`[VALIDATION] Invalid location type: cityId=${cityId}, type=${city.type}`);
      throw new BadRequestException(`The location "${city.nameEn}" cannot be used as a city. Please select a valid city.`);
    }

    this.logger.debug(`[VALIDATION] City validated successfully: cityId=${cityId}, name=${city.nameEn}, type=${city.type}`);
  }

  /** Validates that a subcity exists, is of type SUBCITY, and belongs to the specified city */
  private async validateSubcity(subcityId: string, cityId: string): Promise<void> {
    this.logger.debug(`[VALIDATION] Checking subcity existence, type, and parent: subcityId=${subcityId}, cityId=${cityId}`);
    
    const subcity = await this.prisma.location.findUnique({
      where: { id: subcityId },
    });
    
    if (!subcity) {
      this.logger.warn(`[VALIDATION] Subcity not found: subcityId=${subcityId}`);
      throw new NotFoundException(`Subcity with ID ${subcityId} not found. Please select a valid subcity.`);
    }
    
    if (subcity.type !== LocationType.SUBCITY) {
      this.logger.warn(`[VALIDATION] Invalid location type: subcityId=${subcityId}, type=${subcity.type}, expected=SUBCITY`);
      throw new BadRequestException(`The location "${subcity.nameEn}" is not a subcity. Please select a valid subcity for your listing.`);
    }
    
    if (subcity.parentId !== cityId) {
      this.logger.warn(`[VALIDATION] Subcity does not belong to city: subcityId=${subcityId}, subcityParentId=${subcity.parentId}, cityId=${cityId}`);
      throw new BadRequestException(`The subcity "${subcity.nameEn}" does not belong to the selected city. Please select a subcity within your chosen city.`);
    }
    
    this.logger.debug(`[VALIDATION] Subcity validated successfully: subcityId=${subcityId}, name=${subcity.nameEn}, parentCityId=${cityId}`);
  }

  /**
   * Creates a new draft listing.
   * The sellerId is automatically extracted from the authenticated user.
   * Status defaults to DRAFT.
   */
  async createDraft(sellerId: string, dto: CreateListingDto): Promise<CreateListingResult> {
    this.logger.log(`[START] Creating draft listing for seller=${sellerId}, title="${dto.title}", priceCents=${dto.priceCents}`);
    
    try {
      this.logger.debug(`[VALIDATION] Starting validation for listing data`);
      
      // Validate category, city, and subcity
      await this.validateCategory(dto.categoryId);
      await this.validateCity(dto.cityId);
      if (dto.subcityId) {
        await this.validateSubcity(dto.subcityId, dto.cityId);
      }

      this.logger.debug(`[QUERY] Creating listing in database`);
      
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
          status: ListingStatus.DRAFT,
        },
      });

      this.logger.log(`[SUCCESS] Draft listing created: listingId=${listing.id}, sellerId=${sellerId}, status=${listing.status}`);
      return { listingId: listing.id, status: listing.status };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `[ERROR] Failed to create draft listing for seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to create your listing at this time. Please check your input and try again.');
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
    this.logger.log(`[START] Updating listing=${listingId} by seller=${sellerId}`);
    
    try {
      this.logger.debug(`[QUERY] Fetching listing to verify ownership and status`);
      
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        this.logger.warn(`[AUTH] Listing not found: listingId=${listingId}`);
        throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      }

      if (listing.sellerId !== sellerId) {
        this.logger.warn(`[AUTH] Unauthorized update attempt: listingId=${listingId}, requestedBy=${sellerId}, owner=${listing.sellerId}`);
        throw new ForbiddenException('You can only update your own listings.');
      }

      if (listing.status !== ListingStatus.DRAFT) {
        this.logger.warn(`[VALIDATION] Cannot update non-draft listing: listingId=${listingId}, status=${listing.status}`);
        throw new BadRequestException('Only draft listings can be updated. This listing has already been published or has a different status.');
      }

      this.logger.debug(`[VALIDATION] Validating updated fields`);
      
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

      this.logger.debug(`[QUERY] Updating listing in database`);
      
      const updated = await this.prisma.listing.update({
        where: { id: listingId },
        data: dto,
      });

      this.logger.log(`[SUCCESS] Listing updated: listingId=${listingId}, sellerId=${sellerId}`);
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
        `[ERROR] Failed to update listing=${listingId} by seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to update your listing at this time. Please try again later.');
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
    this.logger.log(`[START] Publishing listing=${listingId} by seller=${sellerId}`);
    
    try {
      this.logger.debug(`[QUERY] Fetching listing to verify ownership and status`);
      
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        this.logger.warn(`[AUTH] Listing not found: listingId=${listingId}`);
        throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      }

      if (listing.sellerId !== sellerId) {
        this.logger.warn(`[AUTH] Unauthorized publish attempt: listingId=${listingId}, requestedBy=${sellerId}, owner=${listing.sellerId}`);
        throw new ForbiddenException('You can only publish your own listings.');
      }

      if (listing.status !== ListingStatus.DRAFT) {
        this.logger.warn(`[VALIDATION] Cannot publish non-draft listing: listingId=${listingId}, status=${listing.status}`);
        throw new BadRequestException('Only draft listings can be published. This listing has already been published or has a different status.');
      }

      // TODO: Validate at least one image when image endpoint is implemented
      // if (!dto.images || dto.images.length === 0) {
      //   throw new BadRequestException('At least one image is required to publish a listing');
      // }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      this.logger.debug(`[TRANSACTION] Starting transaction to publish listing`);
      
      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        this.logger.debug(`[TRANSACTION] Updating listing status to ACTIVE`);
        
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

      this.logger.log(`[SUCCESS] Listing published: listingId=${listingId}, sellerId=${sellerId}, expiresAt=${expiresAt.toISOString()}`);
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
        `[ERROR] Failed to publish listing=${listingId} by seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to publish your listing at this time. Please try again later.');
    }
  }

  /**
   * Gets a single listing by ID.
   * Public access: only returns ACTIVE listings.
   * Authenticated seller: can view their own listings (any status).
   */
  async getListing(listingId: string, sellerId?: string): Promise<ListingModel> {
    this.logger.log(`[START] Fetching listing=${listingId} ${sellerId ? `for seller=${sellerId}` : '(public access)'}`);
    
    try {
      this.logger.debug(`[QUERY] Fetching listing with related data`);
      
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
        this.logger.warn(`[NOT_FOUND] Listing not found: listingId=${listingId}`);
        throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      }

      this.logger.debug(`[AUTH] Checking access permissions for listing=${listingId}`);
      
      // If sellerId is provided, check ownership
      if (sellerId) {
        if (listing.sellerId !== sellerId) {
          // Not the owner, only show if active
          if (listing.status !== ListingStatus.ACTIVE) {
            this.logger.warn(`[AUTH] Access denied: listingId=${listingId}, requestedBy=${sellerId}, status=${listing.status}`);
            throw new NotFoundException('Listing not found.');
          }
          this.logger.debug(`[AUTH] Public access granted for active listing: listingId=${listingId}`);
        }
        // Owner can view their own listings regardless of status
        this.logger.debug(`[AUTH] Owner access granted: listingId=${listingId}, owner=${sellerId}`);
      } else {
        // Public access - only show active listings
        if (listing.status !== ListingStatus.ACTIVE) {
          this.logger.warn(`[AUTH] Public access denied for non-active listing: listingId=${listingId}, status=${listing.status}`);
          throw new NotFoundException('Listing not found.');
        }
        this.logger.debug(`[AUTH] Public access granted for active listing: listingId=${listingId}`);
      }

      this.logger.log(`[SUCCESS] Listing retrieved: listingId=${listingId}, title="${listing.title}", status=${listing.status}`);
      return listing;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `[ERROR] Failed to get listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to retrieve the listing at this time. Please try again later.');
    }
  }

  /**
   * Gets all listings for a seller.
   * Returns both draft and active listings.
   */
  async getSellerListings(sellerId: string): Promise<ListingModel[]> {
    this.logger.log(`[START] Fetching all listings for seller=${sellerId}`);
    
    try {
      this.logger.debug(`[QUERY] Fetching listings with related data`);
      
      const listings = await this.prisma.listing.findMany({
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

      this.logger.log(`[SUCCESS] Retrieved ${listings.length} listings for seller=${sellerId}`);
      return listings;
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get listings for seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to retrieve your listings at this time. Please try again later.');
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
    this.logger.log(`[START] Deleting listing=${listingId} by seller=${sellerId}`);
    
    try {
      this.logger.debug(`[QUERY] Fetching listing to verify ownership and status`);
      
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        this.logger.warn(`[AUTH] Listing not found: listingId=${listingId}`);
        throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      }

      if (listing.sellerId !== sellerId) {
        this.logger.warn(`[AUTH] Unauthorized delete attempt: listingId=${listingId}, requestedBy=${sellerId}, owner=${listing.sellerId}`);
        throw new ForbiddenException('You can only delete your own listings.');
      }

      // Prevent deletion of listings with final statuses
      const finalStatuses: ListingStatus[] = [
        ListingStatus.SOLD,
        ListingStatus.RESERVED,
        ListingStatus.REMOVED,
      ];
      if (finalStatuses.includes(listing.status as ListingStatus)) {
        this.logger.warn(`[VALIDATION] Cannot delete listing with final status: listingId=${listingId}, status=${listing.status}`);
        throw new BadRequestException(
          `Cannot delete listing with status "${listing.status}". Listings that are sold, reserved, or already removed cannot be deleted. Only draft, active, and expired listings can be deleted.`,
        );
      }

      this.logger.debug(`[ACTION] Determining delete type based on status: listingId=${listingId}, status=${listing.status}`);
      
      // Soft delete for active and expired listings, hard delete for drafts
      if (listing.status === ListingStatus.ACTIVE || listing.status === ListingStatus.EXPIRED) {
        this.logger.debug(`[ACTION] Performing soft delete (status to REMOVED): listingId=${listingId}`);
        await this.prisma.listing.update({
          where: { id: listingId },
          data: { status: ListingStatus.REMOVED },
        });
        this.logger.log(`[SUCCESS] Listing soft deleted: listingId=${listingId}, sellerId=${sellerId}, previousStatus=${listing.status}`);
      } else {
        this.logger.debug(`[ACTION] Performing hard delete: listingId=${listingId}`);
        await this.prisma.listing.delete({
          where: { id: listingId },
        });
        this.logger.log(`[SUCCESS] Listing hard deleted: listingId=${listingId}, sellerId=${sellerId}`);
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
        `[ERROR] Failed to delete listing=${listingId} by seller=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to delete your listing at this time. Please try again later.');
    }
  }
}
