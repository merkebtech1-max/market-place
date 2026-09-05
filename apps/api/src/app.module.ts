import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersCatalogModule } from './users-catalog/users-catalog.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { RatingsModule } from './ratings/ratings.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, UsersCatalogModule, ListingsModule, MessagingModule, TransactionsModule, ModerationModule, RatingsModule, AdminModule],
})
export class AppModule {}