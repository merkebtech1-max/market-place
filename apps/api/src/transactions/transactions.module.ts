import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationCreateService } from './services/reservation-create.service.js';
import { ReservationListService } from './services/reservation-list.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReservationsController],
  providers: [ReservationCreateService, ReservationListService],
})
export class TransactionsModule {}
