import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ListingStatus, PaymentProvider, PaymentStatus, ReservationStatus, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReservationCreateService } from './reservation-create.service.js';

interface MelaPaysInitializeData {
  checkout_url: string;
  expires_at: string;
  tx_ref: string;
  base_amount: number;
  amount: number;
  currency: string;
  mode?: string;
  fees?: Record<string, unknown>;
}

interface MelaPaysInitializeResponse {
  success: boolean;
  message?: string;
  data?: MelaPaysInitializeData;
}

export interface ReservationPaymentCheckout {
  paymentId: string;
  checkoutUrl: string;
  txRef: string;
  expiresAt: string;
  baseAmount: number;
  totalAmount: number;
  currency: string;
}

export interface ReservationPaymentStatus {
  status: PaymentStatus;
  reservationId: string | null;
}

type CallbackPayload = Record<string, unknown>;

/** Starts a hosted MelaPays checkout without reserving the listing. */
@Injectable()
export class ReservationPaymentService {
  private readonly logger = new Logger(ReservationPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reservationCreateService: ReservationCreateService,
  ) {}

  async initialize(
    buyerId: string,
    listingId: string,
    threadId: string,
  ): Promise<ReservationPaymentCheckout> {
    const [listing, buyer, thread, reservation] = await Promise.all([
      this.prisma.listing.findUnique({
        where: { id: listingId },
        include: { seller: { select: { status: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: buyerId },
        select: { id: true, status: true },
      }),
      this.prisma.thread.findUnique({
        where: { id: threadId },
        select: { id: true, listingId: true, buyerId: true, sellerId: true },
      }),
      this.prisma.reservation.findUnique({
        where: { threadId },
        select: { status: true },
      }),
    ]);

    if (!buyer) throw new NotFoundException('Buyer account not found.');
    if (buyer.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Your account is not active, so you cannot make a reservation.');
    }
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictException('This listing is not available for reservation.');
    }
    if (!listing.expiresAt || listing.expiresAt <= new Date()) {
      throw new BadRequestException('This listing has expired and can no longer be reserved.');
    }
    if (listing.seller.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('This listing is no longer available.');
    }
    if (listing.sellerId === buyerId) {
      throw new BadRequestException('You cannot reserve your own listing.');
    }
    if (!thread) throw new NotFoundException('Conversation not found.');
    if (thread.listingId !== listingId) {
      throw new BadRequestException('This conversation does not belong to the specified listing.');
    }
    if (thread.buyerId !== buyerId) {
      throw new BadRequestException('You are not the buyer in this conversation.');
    }
    if (thread.sellerId !== listing.sellerId) {
      throw new BadRequestException('The seller in this conversation does not match the listing seller.');
    }
    if (reservation && reservation.status !== ReservationStatus.CANCELLED) {
      throw new ConflictException('This conversation already has a reservation.');
    }

    const secretKey = this.config.get<string>('MELAPAYS_SECRET_KEY')?.trim();
    const baseUrl = this.config.get<string>('MELAPAYS_BASE_URL', 'https://melapays.com/api/v1').replace(/\/$/, '');
    const fee = Number(this.config.get<string>('MELAPAYS_RESERVATION_FEE', '10'));
    const webOrigin = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000').replace(/\/$/, '');
    const callbackUrl = this.config.get<string>(
      'MELAPAYS_CALLBACK_URL',
      `${webOrigin}/payment/complete`,
    );

    if (!secretKey) {
      throw new InternalServerErrorException('MelaPays is not configured.');
    }
    if (!Number.isFinite(fee) || fee <= 0) {
      throw new InternalServerErrorException('The reservation fee is not configured correctly.');
    }

    const txRef = `merkeb_${randomUUID()}`;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/payment/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: fee,
          currency: 'ETB',
          tx_ref: txRef,
          callback_url: callbackUrl,
          session_expired: 900,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(`MelaPays initialization failed for txRef=${txRef}`, error);
      throw new BadGatewayException('Unable to connect to MelaPays. Please try again.');
    }

    let body: MelaPaysInitializeResponse;
    try {
      body = (await response.json()) as MelaPaysInitializeResponse;
    } catch {
      throw new BadGatewayException('MelaPays returned an invalid response.');
    }

    const data = body.data;
    if (!response.ok || !body.success || !data?.checkout_url || !data.tx_ref) {
      this.logger.warn(`MelaPays rejected initialization for txRef=${txRef}: ${body.message ?? response.status}`);
      throw new BadGatewayException(body.message || 'MelaPays could not start the payment.');
    }

    const baseAmount = Number(data.base_amount);
    const totalAmount = Number(data.amount);
    const payment = await this.prisma.payment.create({
      data: {
        buyerId,
        listingId,
        threadId,
        provider: PaymentProvider.MELAPAYS,
        providerRef: data.tx_ref,
        amountCents: Math.round(baseAmount * 100),
        providerFeeCents: Math.max(0, Math.round((totalAmount - baseAmount) * 100)),
        status: PaymentStatus.PENDING,
        rawPayload: JSON.parse(JSON.stringify(data)) as object,
      },
      select: { id: true },
    });

    this.logger.log(`MelaPays checkout initialized: paymentId=${payment.id}, txRef=${data.tx_ref}`);
    return {
      paymentId: payment.id,
      checkoutUrl: data.checkout_url,
      txRef: data.tx_ref,
      expiresAt: data.expires_at,
      baseAmount,
      totalAmount,
      currency: data.currency,
    };
  }

  async getStatus(buyerId: string, paymentId: string): Promise<ReservationPaymentStatus> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        buyerId: true,
        status: true,
        reservationId: true,
      },
    });

    if (!payment || payment.buyerId !== buyerId) {
      throw new NotFoundException('Payment not found.');
    }

    return {
      status: payment.status,
      reservationId: payment.reservationId,
    };
  }

  /**
   * Captures a sandbox callback for integration discovery. It deliberately
   * does not verify the payment or create a reservation until MelaPays'
   * signing/verification contract is known.
   */
  async handleMelaPaysCallback(
    payload: CallbackPayload,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
  ): Promise<void> {
    const nested = payload.data;
    const data = nested && typeof nested === 'object' && !Array.isArray(nested)
      ? nested as Record<string, unknown>
      : undefined;
    const possibleRef = payload.tx_ref ?? data?.tx_ref ?? payload.reference ?? data?.reference;
    const txRef = typeof possibleRef === 'string' ? possibleRef : undefined;
    const signatureHeaders = Object.fromEntries(
      Object.entries(headers).filter(([name]) => /signature|webhook|hmac/i.test(name)),
    );
    const rawSignature = headers['x-melapays-signature'];
    const signature = (Array.isArray(rawSignature) ? rawSignature[0] : rawSignature)?.replace(/^sha256=/i, '');
    const secretKey = this.config.get<string>('MELAPAYS_SECRET_KEY')?.trim();
    let signatureVerified = false;
    if (signature && secretKey && rawBody) {
      const expected = createHmac('sha256', secretKey).update(rawBody).digest('hex');
      const receivedBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expected, 'utf8');
      signatureVerified = receivedBuffer.length === expectedBuffer.length
        && timingSafeEqual(receivedBuffer, expectedBuffer);
    }

    this.logger.log(
      `MelaPays callback captured: txRef=${txRef ?? 'missing'}, event=${String(payload.event ?? 'missing')}, status=${String(payload.status ?? 'missing')}, payloadKeys=${Object.keys(payload).join(',')}, signatureHeaders=${Object.keys(signatureHeaders).join(',') || 'none'}, hmacSha256Verified=${signatureVerified}`,
    );

    if (!signatureVerified) {
      throw new UnauthorizedException('Invalid MelaPays callback signature.');
    }
    if (!txRef) {
      throw new BadRequestException('MelaPays callback is missing tx_ref.');
    }

    const existing = await this.prisma.payment.findFirst({
      where: { provider: PaymentProvider.MELAPAYS, providerRef: txRef },
      select: {
        id: true,
        buyerId: true,
        listingId: true,
        threadId: true,
        reservationId: true,
        amountCents: true,
        providerFeeCents: true,
        status: true,
        rawPayload: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('MelaPays payment reference was not found.');
    }

    const initialization = existing.rawPayload && typeof existing.rawPayload === 'object' && !Array.isArray(existing.rawPayload)
      ? existing.rawPayload
      : null;
    const capturedPayload = JSON.parse(JSON.stringify({
      initialization,
      callback: payload,
      callbackSignatureHeaders: signatureHeaders,
      callbackSignatureVerified: signatureVerified,
      callbackReceivedAt: new Date().toISOString(),
    })) as object;

    if (payload.event !== 'payment.success' || payload.status !== 'success') {
      await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          ...(payload.status === 'failed' ? { status: PaymentStatus.FAILED } : {}),
          rawPayload: capturedPayload,
        },
      });
      return;
    }

    if (payload.currency !== 'ETB') {
      throw new BadRequestException('MelaPays callback currency does not match the payment.');
    }
    const callbackAmountCents = Math.round(Number(payload.amount) * 100);
    const expectedBaseCents = existing.amountCents;
    const expectedTotalCents = existing.amountCents + existing.providerFeeCents;
    if (
      !Number.isFinite(callbackAmountCents)
      || (callbackAmountCents !== expectedBaseCents && callbackAmountCents !== expectedTotalCents)
    ) {
      throw new BadRequestException('MelaPays callback amount does not match the payment.');
    }

    if (existing.status === PaymentStatus.VERIFIED && existing.reservationId) {
      return;
    }

    const reservation = await this.reservationCreateService.createReservation(
      existing.buyerId,
      existing.listingId,
      existing.threadId,
    );
    const paidAtValue = typeof payload.paid_at === 'string' ? new Date(payload.paid_at) : new Date();
    const paidAt = Number.isNaN(paidAtValue.getTime()) ? new Date() : paidAtValue;

    await this.prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: PaymentStatus.VERIFIED,
        paidAt,
        reservationId: reservation.id,
        rawPayload: capturedPayload,
      },
    });
    this.logger.log(
      `MelaPays payment verified and reservation activated: txRef=${txRef}, reservationId=${reservation.id}`,
    );
  }
}
