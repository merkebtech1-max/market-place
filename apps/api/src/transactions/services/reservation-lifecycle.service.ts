import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, ReservationStatus, CompletionMethod } from '../../generated/prisma/enums.js';
import { hashQrToken } from '../utils/qr-token.util.js';

/** Safe reservation representation returned to clients. */
export interface ReservationResponse {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
}

/** Safe completion response returned to the seller. No token/hash/payment internals. */
export interface ReservationCompletionResponse {
  reservationId: string;
  listingId: string;
  status: ReservationStatus;
  completedAt: Date;
  completionMethod: CompletionMethod;
}

/**
 * Owns reservation lifecycle operations: cancellation, QR completion,
 * expiry, and dispute transitions.
 *
 * Currently implements only buyer cancellation. Other operations will
 * be added incrementally as their respective features are built out.
 */
@Injectable()
export class ReservationLifecycleService {
  private readonly logger = new Logger(ReservationLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cancel a reservation by the buyer who owns it.
   *
   * Transitions:
   *   Reservation: RESERVED → CANCELLED
   *   Listing:     RESERVED → ACTIVE
   *
   * The listing transition uses a conditional updateMany as a
   * compare-and-swap: only succeeds if the listing is still RESERVED.
   * This prevents accidentally reopening a listing if a future lifecycle
   * operation (e.g. QR completion → SOLD) has already changed it.
   *
   * TODO: Trigger refund workflow after payment integration. Refundable
   * amount must be calculated according to the configured
   * cancellation/refund policy.
   */
  async cancelReservation(buyerId: string, reservationId: string): Promise<ReservationResponse> {
    this.logger.log(
      `[START] Cancelling reservation: reservationId=${reservationId}, buyerId=${buyerId}`,
    );

    // Single timestamp for the whole operation — expiration checks and
    // the CAS condition must agree on what "now" means.
    const now = new Date();

    try {
      // ── Validation phase ──────────────────────────────────────────

      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          listingId: true,
          buyerId: true,
          sellerId: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation with ID ${reservationId} not found.`);
      }

      // Only the buyer who owns the reservation can cancel it
      if (reservation.buyerId !== buyerId) {
        throw new BadRequestException('You can only cancel your own reservations.');
      }

      // Can only cancel a RESERVED reservation
      if (reservation.status !== ReservationStatus.RESERVED) {
        throw new ConflictException(
          `Reservation cannot be cancelled because it is already ${reservation.status}.`,
        );
      }

      // Cannot cancel an expired reservation — it must go through the
      // automatic expiry lifecycle instead.
      if (reservation.expiresAt <= now) {
        throw new ConflictException(
          'This reservation has expired and can no longer be cancelled.',
        );
      }

      // ── Atomic transaction ────────────────────────────────────────

      const cancelled = await this.prisma.$transaction(async (tx) => {
        // Compare-and-swap: only transition the reservation if it is
        // still RESERVED. This guards against concurrent operations
        // (e.g. QR completion) that may have already changed the status.
        const reservationUpdate = await tx.reservation.updateMany({
          where: {
            id: reservationId,
            status: ReservationStatus.RESERVED,
          },
          data: { status: ReservationStatus.CANCELLED },
        });

        if (reservationUpdate.count === 0) {
          throw new ConflictException(
            'This reservation was just modified by another operation. Please refresh and try again.',
          );
        }

        // Compare-and-swap: the listing MUST still be RESERVED for the
        // cancellation to proceed. If a future lifecycle operation
        // (e.g. QR completion → SOLD) has already changed the listing
        // status, this update matches 0 rows and we throw — rolling
        // back the reservation cancellation above.
        const listingUpdate = await tx.listing.updateMany({
          where: {
            id: reservation.listingId,
            status: ListingStatus.RESERVED,
          },
          data: { status: ListingStatus.ACTIVE },
        });

        if (listingUpdate.count === 0) {
          throw new ConflictException(
            'This listing is no longer reserved, so the reservation cannot be cancelled.',
          );
        }

        // TODO: Trigger refund workflow after payment integration.
        // Refundable amount must be calculated according to the
        // configured cancellation/refund policy.

        return tx.reservation.findUnique({
          where: { id: reservationId },
          select: {
            id: true,
            listingId: true,
            buyerId: true,
            sellerId: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        });
      });

      this.logger.log(
        `[SUCCESS] Reservation cancelled: reservationId=${reservationId}, buyerId=${buyerId}, listingId=${reservation.listingId}`,
      );

      return {
        id: cancelled!.id,
        listingId: cancelled!.listingId,
        buyerId: cancelled!.buyerId,
        sellerId: cancelled!.sellerId,
        status: cancelled!.status,
        expiresAt: cancelled!.expiresAt,
        createdAt: cancelled!.createdAt,
      };
    } catch (error) {
      // Business validation errors pass through untouched
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      // Unexpected failures are server faults, not client bad requests
      this.logger.error(
        `[ERROR] Failed to cancel reservation: reservationId=${reservationId}, buyerId=${buyerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to cancel reservation at this time. Please try again later.',
      );
    }
  }

  /**
   * Completes a reservation when the seller scans the buyer's QR code.
   *
   * Flow: hash the scanned token → find reservation by qrTokenHash →
   * validate seller/status/expiry/consumption → atomically transition
   * Reservation RESERVED → COMPLETED and Listing RESERVED → SOLD.
   *
   * The conditional updateMany on the reservation is the double-completion
   * guard: exactly one concurrent scan can win the RESERVED → COMPLETED
   * transition; the rest get a ConflictException.
   */
  async completeReservationByQr(sellerId: string, token: string): Promise<ReservationCompletionResponse> {
    this.logger.log(`[START] Completing reservation by QR: sellerId=${sellerId}`);

    // Single timestamp for the whole operation.
    const now = new Date();

    try {
      const scannedTokenHash = hashQrToken(token);

      const reservation = await this.prisma.reservation.findUnique({
        where: { qrTokenHash: scannedTokenHash },
        select: {
          id: true,
          listingId: true,
          sellerId: true,
          status: true,
          expiresAt: true,
          qrConsumedAt: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException('No reservation matches this QR code.');
      }

      // A valid QR must not be usable by an unrelated seller.
      if (reservation.sellerId !== sellerId) {
        throw new ForbiddenException('This QR code belongs to a different seller.');
      }

      if (reservation.status !== ReservationStatus.RESERVED) {
        throw new ConflictException(
          `Reservation cannot be completed because it is ${reservation.status}.`,
        );
      }

      if (reservation.expiresAt <= now) {
        throw new ConflictException('This reservation has expired.');
      }

      // Defense-in-depth: a completed reservation already fails the RESERVED
      // check, but keep the explicit check.
      if (reservation.qrConsumedAt !== null) {
        throw new ConflictException('This QR code has already been used.');
      }

      // ── Atomic transaction ────────────────────────────────────────

      const completed = await this.prisma.$transaction(async (tx) => {
        // Compare-and-swap: only succeeds if this is still the same
        // RESERVED, unconsumed reservation for this seller.
        const reservationUpdate = await tx.reservation.updateMany({
          where: {
            id: reservation.id,
            sellerId,
            status: ReservationStatus.RESERVED,
            qrConsumedAt: null,
          },
          data: {
            status: ReservationStatus.COMPLETED,
            qrConsumedAt: now,
            completedAt: now,
            completionMethod: CompletionMethod.QR_SCAN,
          },
        });

        if (reservationUpdate.count === 0) {
          throw new ConflictException(
            'This reservation was just modified by another operation. Please refresh and try again.',
          );
        }

        // The listing MUST still be RESERVED, otherwise roll back — we never
        // want Reservation = COMPLETED with Listing = RESERVED.
        const listingUpdate = await tx.listing.updateMany({
          where: {
            id: reservation.listingId,
            status: ListingStatus.RESERVED,
          },
          data: { status: ListingStatus.SOLD },
        });

        if (listingUpdate.count === 0) {
          throw new ConflictException(
            'This listing is no longer reserved, so the reservation cannot be completed.',
          );
        }

        // Return the authoritative, just-written row so the response is
        // derived from the transaction result rather than reconstructed
        // from the constants we sent.
        return tx.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
          select: {
            id: true,
            listingId: true,
            status: true,
            completedAt: true,
            completionMethod: true,
          },
        });
      });

      this.logger.log(
        `[SUCCESS] Reservation completed by QR: reservationId=${reservation.id}, sellerId=${sellerId}`,
      );

      return {
        reservationId: completed.id,
        listingId: completed.listingId,
        status: completed.status,
        completedAt: completed.completedAt!,
        completionMethod: completed.completionMethod!,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.error(
        `[ERROR] Failed to complete reservation by QR: sellerId=${sellerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to complete the reservation at this time. Please try again later.',
      );
    }
  }

  /**
   * Find reservations that reached their expiration time and complete them
   * automatically (AUTO_EXPIRY). Safe to run repeatedly: each reservation is
   * finalized with a compare-and-swap update, so concurrent runs and
   * in-flight QR completions simply skip already-transitioned rows.
   *
   * One bad reservation must not roll back the rest of the batch, so each
   * candidate runs in its own transaction and failures are accounted for
   * individually.
   */
  async processExpiredReservations(): Promise<{
    found: number;
    completed: number;
    skipped: number;
    failed: number;
  }> {
    const now = new Date();

    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.RESERVED,
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        listingId: true,
        sellerId: true,
        status: true,
        expiresAt: true,
        qrConsumedAt: true,
      },
    });

    let completed = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const transitioned = await this.prisma.$transaction(async (tx) => {
          // Compare-and-swap: only succeeds if this reservation is still RESERVED.
          const reservationUpdate = await tx.reservation.updateMany({
            where: {
              id: candidate.id,
              status: ReservationStatus.RESERVED,
              expiresAt: { lte: now },
              qrConsumedAt: null,
            },
            data: {
              status: ReservationStatus.COMPLETED,
              completedAt: now,
              completionMethod: CompletionMethod.AUTO_EXPIRY,
            },
          });

          if (reservationUpdate.count === 0) {
            // Someone else already changed this reservation — expected
            // concurrency, not a fatal error. Caller rolls nothing back.
            return false;
          }

          // The listing MUST still be RESERVED, otherwise roll back — we never
          // want Reservation = COMPLETED with Listing = RESERVED.
          const listingUpdate = await tx.listing.updateMany({
            where: {
              id: candidate.listingId,
              status: ListingStatus.RESERVED,
            },
            data: { status: ListingStatus.SOLD },
          });

          if (listingUpdate.count === 0) {
            throw new ConflictException(
              `Listing ${candidate.listingId} is no longer reserved; rolling back reservation ${candidate.id}.`,
            );
          }

          return true;
        });

        if (transitioned) {
          completed += 1;
        } else {
          skipped += 1;
          this.logger.log(`Skipped reservation ${candidate.id}: already transitioned.`);
        }
      } catch (error) {
        if (error instanceof ConflictException) {
          // Expected concurrency: listing already changed elsewhere.
          skipped += 1;
          this.logger.log(`Skipped reservation ${candidate.id}: ${error.message}`);
          continue;
        }

        // Unexpected infrastructure failure: log and keep processing the
        // batch. Retry strategy for the job itself is a later concern.
        failed += 1;
        this.logger.error(
          `[ERROR] Failed to expire reservation ${candidate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return { found: candidates.length, completed, skipped, failed };
  }
}
