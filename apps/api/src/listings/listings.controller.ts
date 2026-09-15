import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListingsService } from './listings.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { PublishListingDto } from './dto/publish-listing.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';

/** Handles HTTP routes for listings: create, update, publish, and view */
@Controller('listings')
export class ListingsController {
  private readonly logger = new Logger(ListingsController.name);

  constructor(private readonly listingsService: ListingsService) {}

  /**
   * Creates a new draft listing.
   * Requires authentication.
   * Seller ID is automatically extracted from the JWT token.
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createDraft(@Body() dto: CreateListingDto, @CurrentUser() user: TokenPayload) {
    try {
      this.logger.log(`Creating draft listing for userId=${user.sub}`);
      const result = await this.listingsService.createDraft(user.sub, dto);
      this.logger.log(`Draft listing created listingId=${result.listingId} userId=${user.sub}`);
      return {
        success: true,
        message: 'Draft listing created successfully',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create draft listing for userId=${user.sub}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Updates an existing listing.
   * Requires authentication.
   * Only the seller can update their own listings.
   * Only draft listings can be updated.
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateListing(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: TokenPayload,
  ) {
    try {
      this.logger.log(`Updating listing=${id} by userId=${user.sub}`);
      const listing = await this.listingsService.updateListing(id, user.sub, dto);
      this.logger.log(`Listing updated listing=${id} userId=${user.sub}`);
      return {
        success: true,
        message: 'Listing updated successfully',
        listing,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update listing=${id} by userId=${user.sub}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Publishes a draft listing.
   * Requires authentication.
   * Only the seller can publish their own listings.
   * Validates required fields and sets status to ACTIVE.
   * Images will be handled by a separate endpoint in the future.
   */
  @Post(':id/publish')
  @UseGuards(AuthGuard('jwt'))
  async publishListing(
    @Param('id') id: string,
    @Body() dto: PublishListingDto,
    @CurrentUser() user: TokenPayload,
  ) {
    try {
      this.logger.log(`Publishing listing=${id} by userId=${user.sub}`);
      const result = await this.listingsService.publishListing(id, user.sub, dto);
      this.logger.log(`Listing published listing=${id} userId=${user.sub}`);
      return {
        success: true,
        message: 'Listing published successfully',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to publish listing=${id} by userId=${user.sub}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Gets all listings for the authenticated seller.
   * Requires authentication.
   * Returns both draft and active listings.
   * Note: This route must come before :id to avoid route conflicts.
   */
  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getSellerListings(@CurrentUser() user: TokenPayload) {
    try {
      this.logger.log(`Getting listings for userId=${user.sub}`);
      const listings = await this.listingsService.getSellerListings(user.sub);
      return {
        success: true,
        listings,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get listings for userId=${user.sub}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Gets a single listing by ID.
   * Public endpoint - anyone can view ACTIVE listings.
   * Authenticated users can also view their own listings (any status).
   */
  @Get(':id')
  async getListing(@Param('id') id: string, @CurrentUser() user?: TokenPayload) {
    try {
      const sellerId = user?.sub;
      this.logger.log(`Getting listing=${id} ${sellerId ? `by userId=${sellerId}` : 'public'}`);
      const listing = await this.listingsService.getListing(id, sellerId);
      return {
        success: true,
        listing,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get listing=${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Deletes a listing.
   * Requires authentication.
   * Only the seller can delete their own listings.
   * Draft and Active listings can be deleted.
   * Sold, Reserved, and other final statuses cannot be deleted.
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteListing(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    try {
      this.logger.log(`Deleting listing=${id} by userId=${user.sub}`);
      await this.listingsService.deleteListing(id, user.sub);
      this.logger.log(`Listing deleted listing=${id} userId=${user.sub}`);
      return {
        success: true,
        message: 'Listing deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete listing=${id} by userId=${user.sub}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
