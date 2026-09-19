import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ListingValidationService } from './services/listing-validation.service.js';
import { ListingCreateService } from './services/listing-create.service.js';
import { ListingUpdateService } from './services/listing-update.service.js';
import { ListingPublishService } from './services/listing-publish.service.js';
import { ListingSearchService } from './services/listing-search.service.js';
import { ListingFeedService } from './services/listing-feed.service.js';
import { ListingDiscoveryService } from './services/listing-discovery.service.js';
import { ListingDetailService } from './services/listing-detail.service.js';
import { ListingSellerService } from './services/listing-seller.service.js';
import { ListingDeleteService } from './services/listing-delete.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ListingsController],
  providers: [
    ListingValidationService,
    ListingCreateService,
    ListingUpdateService,
    ListingPublishService,
    ListingSearchService,
    ListingFeedService,
    ListingDiscoveryService,
    ListingDetailService,
    ListingSellerService,
    ListingDeleteService,
  ],
})
export class ListingsModule {}
