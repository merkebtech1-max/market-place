import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { ScanQrDto } from './dto/scan-qr.dto.js';
import {
  ReservationCreateService,
  type ReservationResponse,
} from './services/reservation-create.service.js';
import {
  ReservationLifecycleService,
  type ReservationCompletionResponse,
} from './services/reservation-lifecycle.service.js';
import {
  ReservationListService,
  type ReservationCard,
} from './services/reservation-list.service.js';
import {
  ReservationQrService,
  type ReservationQrResponse,
} from './services/reservation-qr.service.js';
import { ReservationStatus } from '../generated/prisma/enums.js';
import {
  ReservationPaymentService,
  type ReservationPaymentCheckout,
  type ReservationPaymentStatus,
} from './services/reservation-payment.service.js';

@Controller('transactions/reservations')
export class ReservationsController {
  private readonly logger = new Logger(ReservationsController.name);

  constructor(
    private readonly reservationCreateService: ReservationCreateService,
    private readonly reservationLifecycleService: ReservationLifecycleService,
    private readonly reservationListService: ReservationListService,
    private readonly reservationQrService: ReservationQrService,
    private readonly reservationPaymentService: ReservationPaymentService,
  ) {}

  @Post('payment/initialize')
  @UseGuards(AuthGuard('jwt'))
  async initializeReservationPayment(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ReservationPaymentCheckout }> {
    const data = await this.reservationPaymentService.initialize(user.sub, dto.listingId, dto.threadId);
    return { success: true, data };
  }

  @Post('payment/melapays/callback')
  @HttpCode(HttpStatus.OK)
  async captureMelaPaysCallback(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    await this.reservationPaymentService.handleMelaPaysCallback(payload, headers, request.rawBody);
    return { received: true };
  }

  @Get('payment/:paymentId/status')
  @UseGuards(AuthGuard('jwt'))
  async getReservationPaymentStatus(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ReservationPaymentStatus }> {
    const data = await this.reservationPaymentService.getStatus(user.sub, paymentId);
    return { success: true, data };
  }

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

  @Get(':reservationId/qr')
  @UseGuards(AuthGuard('jwt'))
  async getBuyerQr(
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ReservationQrResponse }> {
    this.logger.log(
      `[REQUEST] GET /transactions/reservations/${reservationId}/qr - userId=${user.sub}`,
    );
    const data = await this.reservationQrService.getBuyerQr(user.sub, reservationId);
    this.logger.log(`[RESPONSE] GET /transactions/reservations/${reservationId}/qr`);
    return { success: true, data };
  }

  @Post('scan-qr')
  @UseGuards(AuthGuard('jwt'))
  async scanQr(
    @Body() dto: ScanQrDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ReservationCompletionResponse }> {
    this.logger.log(`[REQUEST] POST /transactions/reservations/scan-qr - userId=${user.sub}`);
    const data = await this.reservationLifecycleService.completeReservationByQr(user.sub, dto.token);
    this.logger.log(`[RESPONSE] POST /transactions/reservations/scan-qr - reservationId=${data.reservationId}`);
    return { success: true, data };
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

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  async cancelReservation(
    @Param('id') reservationId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; message: string; data: ReservationResponse }> {
    this.logger.log(
      `[REQUEST] POST /transactions/reservations/${reservationId}/cancel - userId=${user.sub}`,
    );
    const reservation = await this.reservationLifecycleService.cancelReservation(user.sub, reservationId);
    this.logger.log(`[RESPONSE] POST /transactions/reservations/${reservationId}/cancel - reservationId=${reservation.id}`);
    return {
      success: true,
      message: 'Reservation cancelled successfully',
      data: reservation,
    };
  }
}
