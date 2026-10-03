import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReservationStatus } from '../../generated/prisma/enums.js';
import { getQrTokenSecret } from '../transactions.config.js';
import { generateQrToken, hashQrToken } from '../utils/qr-token.util.js';

/** Buyer-safe QR response. Never contains qrTokenHash, seller, or payment info. */
export interface ReservationQrResponse {
  reservationId: string;
  token: string;
  expiresAt: Date;
}

/**
 * Owns the reservation QR credential: derives the deterministic raw token
 * for the buyer and persists only its hash on the reservation.
 */
@Injectable()
export class ReservationQrService {
  private readonly logger = new Logger(ReservationQrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getBuyerQr(buyerId: string, reservationId: string): Promise<ReservationQrResponse> {
    this.logger.log(
      `[START] Getting buyer QR: reservationId=${reservationId}, buyerId=${buyerId}`,
    );

    try {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          buyerId: true,
          status: true,
          expiresAt: true,
          qrTokenHash: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation with ID ${reservationId} not found.`);
      }

      // Only the buyer who owns the reservation can fetch its QR
      if (reservation.buyerId !== buyerId) {
        throw new ForbiddenException('You can only access the QR code for your own reservations.');
      }

      if (reservation.status !== ReservationStatus.RESERVED) {
        throw new ConflictException(
          `Reservation QR is not available because the reservation is ${reservation.status}.`,
        );
      }

      // Expired reservations must go through the automatic expiry lifecycle.
      const now = new Date();
      if (reservation.expiresAt <= now) {
        throw new ConflictException('This reservation has expired and its QR code is no longer valid.');
      }

      const secret = getQrTokenSecret(this.config);
      const rawToken = generateQrToken(reservation.id, secret);
      const tokenHash = hashQrToken(rawToken);

      if (reservation.qrTokenHash) {
        // Deterministic derivation (same reservation + secret) means the
        // stored hash must match. If it doesn't, something is inconsistent
        // (e.g. secret rotation) — do NOT overwrite the stored hash.
        //
        // NOTE: QR_TOKEN_SECRET is a long-lived secret. Rotating it
        // invalidates derivation of existing reservation tokens. Proper
        // rotation would require a secret version/key ID — out of scope.
        if (reservation.qrTokenHash !== tokenHash) {
          this.logger.error(
            `[ERROR] Stored qrTokenHash mismatch for reservationId=${reservationId}`,
          );
          throw new InternalServerErrorException(
            'Reservation QR credential is inconsistent. Please contact support.',
          );
        }
      } else {
        // First QR request: persist the hash. The conditional update (only
        // when still null) never overwrites another value. Race-safety comes
        // from determinism: concurrent requests both derive the identical
        // hash, so even if both run it, the final value is the same.
        const updateResult = await this.prisma.reservation.updateMany({
          where: { id: reservationId, qrTokenHash: null },
          data: { qrTokenHash: tokenHash },
        });

        if (updateResult.count === 0) {
          // Another concurrent request populated the hash first — expected
          // and safe, nothing to do (the stored value is identical).
          this.logger.log(
            `[INFO] qrTokenHash already set concurrently for reservationId=${reservationId}`,
          );
        }
      }

      this.logger.log(`[SUCCESS] Buyer QR issued: reservationId=${reservationId}`);

      return {
        reservationId: reservation.id,
        token: rawToken,
        expiresAt: reservation.expiresAt,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `[ERROR] Failed to get buyer QR: reservationId=${reservationId}, buyerId=${buyerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to get the reservation QR code at this time. Please try again later.',
      );
    }
  }
}
