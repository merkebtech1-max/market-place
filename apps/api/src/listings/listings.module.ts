import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
