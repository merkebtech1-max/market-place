import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListingsService } from './listings.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { PublishListingDto } from './dto/publish-listing.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtTokenService } from '../auth/jwt/jwt-token.service.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';

/** Handles HTTP routes for listings: create, update, publish, and view */
@Controller('listings')
export class ListingsController {
  private readonly logger = new Logger(ListingsController.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  /**
   * Creates a new draft listing.
   * Requires authentication.
   * Seller ID is automatically extracted from the JWT token.
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createDraft(@Body() dto: CreateListingDto, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] POST /listings - Creating draft listing for userId=${user.sub}, title="${dto.title}", priceCents=${dto.priceCents}`);
    
    try {
      const result = await this.listingsService.createDraft(user.sub, dto);
      
      this.logger.log(`[RESPONSE] POST /listings - Draft listing created: listingId=${result.listingId}, userId=${user.sub}, status=${result.status}`);
      return {
        success: true,
        message: 'Draft listing created successfully',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] POST /listings - Request failed for userId=${user.sub} - ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    this.logger.log(`[REQUEST] PATCH /listings/${id} - Updating listing by userId=${user.sub}`);
    
    try {
      const listing = await this.listingsService.updateListing(id, user.sub, dto);
      
      this.logger.log(`[RESPONSE] PATCH /listings/${id} - Listing updated: listingId=${id}, userId=${user.sub}`);
      return {
        success: true,
        message: 'Listing updated successfully',
        listing,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] PATCH /listings/${id} - Request failed for userId=${user.sub} - ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    this.logger.log(`[REQUEST] POST /listings/${id}/publish - Publishing listing by userId=${user.sub}`);
    
    try {
      const result = await this.listingsService.publishListing(id, user.sub, dto);
      
      this.logger.log(`[RESPONSE] POST /listings/${id}/publish - Listing published: listingId=${id}, userId=${user.sub}, expiresAt=${result.expiresAt.toISOString()}`);
      return {
        success: true,
        message: 'Listing published successfully',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] POST /listings/${id}/publish - Request failed for userId=${user.sub} - ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    this.logger.log(`[REQUEST] GET /listings/my - Fetching listings for userId=${user.sub}`);
    
    try {
      const listings = await this.listingsService.getSellerListings(user.sub);
      
      this.logger.log(`[RESPONSE] GET /listings/my - Retrieved ${listings.length} listings for userId=${user.sub}`);
      return {
        success: true,
        listings,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] GET /listings/my - Request failed for userId=${user.sub} - ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  async getListing(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let sellerId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const payload = await this.jwtTokenService.verifyAccessToken(token);
        sellerId = payload.sub;
      } catch {
        // invalid/expired token — treat as public access
      }
    }
    this.logger.log(`[REQUEST] GET /listings/${id} - Fetching listing ${sellerId ? `for userId=${sellerId}` : '(public access)'}`);
    
    try {
      const listing = await this.listingsService.getListing(id, sellerId);
      
      this.logger.log(`[RESPONSE] GET /listings/${id} - Listing retrieved: title="${listing.title}", status=${listing.status}`);
      return {
        success: true,
        listing,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] GET /listings/${id} - Request failed - ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    this.logger.log(`[REQUEST] DELETE /listings/${id} - Deleting listing by userId=${user.sub}`);
    
    try {
      await this.listingsService.deleteListing(id, user.sub);
      
      this.logger.log(`[RESPONSE] DELETE /listings/${id} - Listing deleted: listingId=${id}, userId=${user.sub}`);
      return {
        success: true,
        message: 'Listing deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] DELETE /listings/${id} - Request failed for userId=${user.sub} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
