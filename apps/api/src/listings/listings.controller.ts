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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { PublishListingDto } from './dto/publish-listing.dto.js';
import { ListingQueryDto } from './dto/listing-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtTokenService } from '../auth/jwt/jwt-token.service.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { ListingCreateService } from './services/listing-create.service.js';
import { ListingUpdateService } from './services/listing-update.service.js';
import { ListingPublishService } from './services/listing-publish.service.js';
import { ListingDiscoveryService } from './services/listing-discovery.service.js';
import { ListingDetailService } from './services/listing-detail.service.js';
import { ListingSellerService } from './services/listing-seller.service.js';
import { ListingDeleteService } from './services/listing-delete.service.js';

@Controller('listings')
export class ListingsController {
  private readonly logger = new Logger(ListingsController.name);

  constructor(
    private readonly createService: ListingCreateService,
    private readonly updateService: ListingUpdateService,
    private readonly publishService: ListingPublishService,
    private readonly discoveryService: ListingDiscoveryService,
    private readonly detailService: ListingDetailService,
    private readonly sellerService: ListingSellerService,
    private readonly deleteService: ListingDeleteService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  @Get()
  async getListings(
    @Query() query: ListingQueryDto,
    @Headers('authorization') authHeader?: string,
  ) {
    this.logger.log(`[REQUEST] GET /listings - page=${query.page}, limit=${query.limit}`);
    let feedIdentity: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwtTokenService.verifyAccessToken(authHeader.slice(7));
        feedIdentity = payload.sub;
      } catch {
        // invalid/expired token — fall through to anonymous handling
      }
    }
    if (!feedIdentity) {
      feedIdentity = query.feedSeed;
    }
    const result = await this.discoveryService.getListings(query, feedIdentity);
    this.logger.log(`[RESPONSE] GET /listings - total=${result.meta.total}, page=${result.meta.page}`);
    return result;
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createDraft(@Body() dto: CreateListingDto, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] POST /listings - userId=${user.sub}, title="${dto.title}"`);
    const result = await this.createService.createDraft(user.sub, dto);
    this.logger.log(`[RESPONSE] POST /listings - listingId=${result.listingId}, status=${result.status}`);
    return { success: true, message: 'Draft listing created successfully', ...result };
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateListing(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: TokenPayload,
  ) {
    this.logger.log(`[REQUEST] PATCH /listings/${id} - userId=${user.sub}`);
    const listing = await this.updateService.updateListing(id, user.sub, dto);
    this.logger.log(`[RESPONSE] PATCH /listings/${id} - updated`);
    return { success: true, message: 'Listing updated successfully', listing };
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard('jwt'))
  async publishListing(
    @Param('id') id: string,
    @Body() dto: PublishListingDto,
    @CurrentUser() user: TokenPayload,
  ) {
    this.logger.log(`[REQUEST] POST /listings/${id}/publish - userId=${user.sub}`);
    const result = await this.publishService.publishListing(id, user.sub, dto);
    this.logger.log(`[RESPONSE] POST /listings/${id}/publish - expiresAt=${result.expiresAt.toISOString()}`);
    return { success: true, message: 'Listing published successfully', ...result };
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getSellerListings(@CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] GET /listings/my - userId=${user.sub}`);
    const listings = await this.sellerService.getSellerListings(user.sub);
    this.logger.log(`[RESPONSE] GET /listings/my - count=${listings.length}`);
    return { success: true, listings };
  }

  @Get(':id')
  async getListing(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let sellerId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwtTokenService.verifyAccessToken(authHeader.slice(7));
        sellerId = payload.sub;
      } catch {
        // invalid/expired token — treat as public access
      }
    }
    this.logger.log(`[REQUEST] GET /listings/${id} - ${sellerId ? `userId=${sellerId}` : 'public'}`);
    const listing = await this.detailService.getListing(id, sellerId);
    this.logger.log(`[RESPONSE] GET /listings/${id} - status=${listing.status}`);
    return { success: true, listing };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteListing(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] DELETE /listings/${id} - userId=${user.sub}`);
    await this.deleteService.deleteListing(id, user.sub);
    this.logger.log(`[RESPONSE] DELETE /listings/${id} - deleted`);
    return { success: true, message: 'Listing deleted successfully' };
  }
}
