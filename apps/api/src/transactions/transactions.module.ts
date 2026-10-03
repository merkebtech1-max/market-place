import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationCreateService } from './services/reservation-create.service.js';
import { ReservationLifecycleService } from './services/reservation-lifecycle.service.js';
import { ReservationListService } from './services/reservation-list.service.js';
import { ReservationQrService } from './services/reservation-qr.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReservationsController],
  providers: [ReservationCreateService, ReservationLifecycleService, ReservationListService, ReservationQrService],
  exports: [ReservationLifecycleService],
})
export class TransactionsModule {}
