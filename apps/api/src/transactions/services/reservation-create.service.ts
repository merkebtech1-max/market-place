import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, ReservationStatus, UserStatus } from '../../generated/prisma/enums.js';
import { getReservationDurationHours } from '../transactions.config.js';

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

/**
 * Owns the reservation creation use case.
 *
 * Validates that a listing can be reserved, then atomically creates the
 * reservation and transitions the listing to RESERVED in a single
 * Prisma transaction. The listing status transition uses a conditional
 * updateMany as a compare-and-swap: if two buyers race, only one UPDATE
 * matches `status = ACTIVE AND expiresAt > now` and the other receives
 * a conflict.
 *
 * The thread must already exist — created via POST /threads. This
 * service validates the thread belongs to the listing and participants.
 */
@Injectable()
export class ReservationCreateService {
  private readonly logger = new Logger(ReservationCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createReservation(
    buyerId: string,
    listingId: string,
    threadId: string,
  ): Promise<ReservationResponse> {
    this.logger.log(
      `[START] Creating reservation for listing=${listingId}, thread=${threadId}, buyer=${buyerId}`,
    );

    // Single timestamp for the whole operation — expiration checks and
    // the CAS condition must agree on what "now" means.
    const now = new Date();

    try {
      // ── Validation phase ──────────────────────────────────────────

      const [listing, buyer, thread] = await Promise.all([
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
      ]);

      // Buyer must exist and be ACTIVE (suspended users can log in but cannot transact)
      if (!buyer) {
        throw new NotFoundException('Buyer account not found.');
      }
      if (buyer.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('Your account is not active, so you cannot make a reservation.');
      }

      // Listing must exist
      if (!listing) {
        throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      }

      // Listing must be ACTIVE
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new ConflictException('This listing is not available for reservation.');
      }

      // Listing must not be expired
      if (!listing.expiresAt || listing.expiresAt <= now) {
        throw new BadRequestException('This listing has expired and can no longer be reserved.');
      }

      // Seller must be ACTIVE
      if (listing.seller.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('This listing is no longer available.');
      }

      // Buyer cannot reserve their own listing
      if (listing.sellerId === buyerId) {
        throw new BadRequestException('You cannot reserve your own listing.');
      }

      // Thread must exist
      if (!thread) {
        throw new NotFoundException(`Thread with ID ${threadId} not found.`);
      }

      // Thread must belong to this listing
      if (thread.listingId !== listingId) {
        throw new BadRequestException('This conversation does not belong to the specified listing.');
      }

      // Buyer must be the thread's buyer
      if (thread.buyerId !== buyerId) {
        throw new BadRequestException('You are not the buyer in this conversation.');
      }

      // Thread seller must match the listing's seller
      if (thread.sellerId !== listing.sellerId) {
        throw new BadRequestException('The seller in this conversation does not match the listing seller.');
      }

      // ── Check for existing reservation on this thread ─────────────

      const existingReservation = await this.prisma.reservation.findUnique({
        where: { threadId },
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

      if (existingReservation) {
        if (existingReservation.status === ReservationStatus.RESERVED) {
          // Already reserved — return the existing reservation
          this.logger.log(
            `[SUCCESS] Reservation already exists: reservationId=${existingReservation.id}, threadId=${threadId}`,
          );
          return {
            id: existingReservation.id,
            listingId: existingReservation.listingId,
            buyerId: existingReservation.buyerId,
            sellerId: existingReservation.sellerId,
            status: existingReservation.status,
            expiresAt: existingReservation.expiresAt,
            createdAt: existingReservation.createdAt,
          };
        }
        // Reservation exists in a terminal state (COMPLETED, CANCELLED, etc.)
        // For now, treat as conflict — we'll decide later if a new reservation
        // can be created for the same thread
        throw new ConflictException(
          'This conversation already has a reservation that is no longer active.',
        );
      }

      // ── Calculate expiration ──────────────────────────────────────

      const durationHours = getReservationDurationHours(this.config);
      const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      // ── Atomic transaction ────────────────────────────────────────

      const reservation = await this.prisma.$transaction(async (tx) => {
        // Compare-and-swap: only succeeds if the listing is still ACTIVE
        // and unexpired. This is the DB-level guard against two buyers racing.
        const updateResult = await tx.listing.updateMany({
          where: {
            id: listingId,
            status: ListingStatus.ACTIVE,
            expiresAt: { gt: now },
          },
          data: { status: ListingStatus.RESERVED },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            'This listing was just reserved by someone else. Please try another listing.',
          );
        }

        // Create the reservation.
        // TODO: Integrate payment-provider initiation and verification once provider/legal requirements are finalized.
        try {
          return await tx.reservation.create({
            data: {
              listingId,
              threadId,
              buyerId,
              sellerId: listing.sellerId,
              status: ReservationStatus.RESERVED,
              expiresAt,
              completionMethod: null,
              // commissionTierId and commissionCents are null until payment integration
            },
          });
        } catch (error) {
          // P2002 = unique constraint on threadId fired because a concurrent
          // request already created a reservation for this thread.
          // Re-read and return the existing one (idempotent).
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const raced = await tx.reservation.findUnique({
              where: { threadId },
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
            if (raced) {
              this.logger.log(`[SUCCESS] Concurrent request yielded existing reservation: reservationId=${raced.id}, threadId=${threadId}`);
              return raced;
            }
          }
          throw error;
        }
      });

      this.logger.log(
        `[SUCCESS] Reservation created: reservationId=${reservation.id}, buyerId=${buyerId}, listingId=${listingId}`,
      );

      return {
        id: reservation.id,
        listingId: reservation.listingId,
        buyerId: reservation.buyerId,
        sellerId: reservation.sellerId,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
        createdAt: reservation.createdAt,
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
        `[ERROR] Failed to create reservation for listing=${listingId}, buyer=${buyerId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to create reservation at this time. Please try again later.',
      );
    }
  }
}
