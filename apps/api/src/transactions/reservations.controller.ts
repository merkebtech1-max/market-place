import { BadRequestException, Body, Controller, Get, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import {
  ReservationCreateService,
  type ReservationResponse,
} from './services/reservation-create.service.js';
import {
  ReservationListService,
  type ReservationCard,
} from './services/reservation-list.service.js';
import { ReservationStatus } from '../generated/prisma/enums.js';

@Controller('transactions/reservations')
export class ReservationsController {
  private readonly logger = new Logger(ReservationsController.name);

  constructor(
    private readonly reservationCreateService: ReservationCreateService,
    private readonly reservationListService: ReservationListService,
  ) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getMyReservations(
    @CurrentUser() user: TokenPayload,
    @Query('status') status?: string,
  ): Promise<{ success: true; data: ReservationCard[] }> {
    this.logger.log(`[REQUEST] GET /transactions/reservations/my - userId=${user.sub}, status=${status || 'all'}`);

    if (status && !Object.values(ReservationStatus).includes(status as ReservationStatus)) {
      this.logger.warn(`[INVALID] Invalid status parameter: ${status}`);
      throw new BadRequestException('Invalid status value');
    }

    const reservations = await this.reservationListService.getMyReservations(
      user.sub,
      status as ReservationStatus | undefined,
    );
    this.logger.log(`[RESPONSE] GET /transactions/reservations/my - count=${reservations.length}`);
    return { success: true, data: reservations };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createReservation(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; message: string; data: ReservationResponse }> {
    this.logger.log(
      `[REQUEST] POST /transactions/reservations - userId=${user.sub}, listingId=${dto.listingId}`,
    );
    const reservation = await this.reservationCreateService.createReservation(user.sub, dto.listingId, dto.threadId);
    this.logger.log(`[RESPONSE] POST /transactions/reservations - reservationId=${reservation.id}`);
    return {
      success: true,
      message: 'Listing reserved successfully',
      data: reservation,
    };
  }
}
