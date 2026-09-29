import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { PublishListingDto } from './dto/publish-listing.dto.js';
import { ListingQueryDto } from './dto/listing-query.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';
import { ReorderListingImagesDto } from './dto/reorder-listing-images.dto.js';
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
import { ListingImageService } from './services/listing-image.service.js';
import { ListingSavedService } from './services/listing-saved.service.js';

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
    private readonly imageService: ListingImageService,
    private readonly savedService: ListingSavedService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  @Get()
  async getListings(
    @Query() query: ListingQueryDto,
    @Headers('authorization') authHeader?: string,
  ) {
    this.logger.log(`[REQUEST] GET /listings - page=${query.page}, limit=${query.limit}`);
    let currentUserId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwtTokenService.verifyAccessToken(authHeader.slice(7));
        currentUserId = payload.sub;
      } catch {
        // invalid/expired token — fall through to anonymous handling
      }
    }
    const feedIdentity = currentUserId ?? query.feedSeed;
    const result = await this.discoveryService.getListings(query, feedIdentity, currentUserId);
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

  @Get('saved')
  @UseGuards(AuthGuard('jwt'))
  async getSavedListings(@Query() query: PaginationDto, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] GET /listings/saved - userId=${user.sub}, page=${query.page}, limit=${query.limit}`);
    const result = await this.savedService.getSavedListings(user.sub, query.page, query.limit);
    this.logger.log(`[RESPONSE] GET /listings/saved - total=${result.meta.total}, page=${result.meta.page}`);
    return result;
  }

  @Post(':id/save')
  @UseGuards(AuthGuard('jwt'))
  async saveListing(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] POST /listings/${id}/save - userId=${user.sub}`);
    const saved = await this.savedService.saveListing(id, user.sub);
    this.logger.log(`[RESPONSE] POST /listings/${id}/save - saved listingId=${saved.listingId}`);
    return { success: true, message: 'Listing saved successfully', saved };
  }

  @Delete(':id/save')
  @UseGuards(AuthGuard('jwt'))
  async unsaveListing(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] DELETE /listings/${id}/save - userId=${user.sub}`);
    await this.savedService.unsaveListing(id, user.sub);
    this.logger.log(`[RESPONSE] DELETE /listings/${id}/save - removed`);
    return { success: true, message: 'Listing removed from saved' };
  }

  @Get(':id')
  async getListing(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let currentUserId: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwtTokenService.verifyAccessToken(authHeader.slice(7));
        currentUserId = payload.sub;
      } catch {
        // invalid/expired token — treat as public access
      }
    }
    this.logger.log(`[REQUEST] GET /listings/${id} - ${currentUserId ? `userId=${currentUserId}` : 'public'}`);
    const listing = await this.detailService.getListing(id, currentUserId);
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

  @Post(':id/images')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: TokenPayload,
  ) {
    this.logger.log(`[REQUEST] POST /listings/${id}/images - userId=${user.sub}`);

    if (!file) {
      throw new BadRequestException('No file was supplied. Upload an image under the "file" field.');
    }

    const image = await this.imageService.addImage(id, user.sub, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
    this.logger.log(`[RESPONSE] POST /listings/${id}/images - imageId=${image.id}`);
    return { success: true, message: 'Image uploaded successfully', image };
  }

  @Delete(':id/images/:imageId')
  @UseGuards(AuthGuard('jwt'))
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: TokenPayload,
  ) {
    this.logger.log(`[REQUEST] DELETE /listings/${id}/images/${imageId} - userId=${user.sub}`);
    await this.imageService.deleteImage(id, user.sub, imageId);
    this.logger.log(`[RESPONSE] DELETE /listings/${id}/images/${imageId} - deleted`);
    return { success: true, message: 'Image deleted successfully' };
  }

  @Patch(':id/images/reorder')
  @UseGuards(AuthGuard('jwt'))
  async reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderListingImagesDto,
    @CurrentUser() user: TokenPayload,
  ) {
    this.logger.log(`[REQUEST] PATCH /listings/${id}/images/reorder - userId=${user.sub}, imageIds=${dto.imageIds.join(',')}`);
    const images = await this.imageService.reorderImages(id, user.sub, dto.imageIds);
    this.logger.log(`[RESPONSE] PATCH /listings/${id}/images/reorder - count=${images.length}`);
    return { success: true, message: 'Images reordered successfully', images };
  }
}
