import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RatingRole, ReservationStatus, UserStatus } from '../../generated/prisma/enums.js';
import { CreateRatingDto } from '../dto/create-rating.dto.js';

/** Safe rating representation returned to clients. */
export interface RatingResponse {
  id: string;
  listingId: string;
  raterId: string;
  rateeId: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
}

/**
 * Owns the buyer → seller rating use case. A completed reservation is the
 * proof of transaction; the rating (create + seller aggregate update)
 * happens in one transaction.
 */
@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRating(raterId: string, dto: CreateRatingDto): Promise<RatingResponse> {
    this.logger.log(`[START] Creating rating by rater=${raterId}, reservation=${dto.reservationId}`);

    // ── Validation phase ──────────────────────────────────────────────

    const [rater, reservation] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: raterId },
        select: { id: true, status: true },
      }),
      this.prisma.reservation.findUnique({
        where: { id: dto.reservationId },
        select: { id: true, listingId: true, buyerId: true, sellerId: true, status: true },
      }),
    ]);

    if (!rater) {
      throw new NotFoundException('Rater account not found.');
    }
    if (rater.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Your account is not active, so you cannot create a rating.');
    }

    if (!reservation) {
      throw new NotFoundException('Reservation not found.');
    }

    // The authenticated user must be the buyer of this reservation.
    if (reservation.buyerId !== raterId) {
      throw new ForbiddenException('You can only rate reservations you participated in as the buyer.');
    }

    // Only completed transactions can be rated.
    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new ConflictException(`Reservation cannot be rated because it is ${reservation.status}.`);
    }

    // Application-level duplicate check for a clean conflict response.
    const existing = await this.prisma.rating.findUnique({
      where: { listingId_raterId: { listingId: reservation.listingId, raterId } },
    });
    if (existing) {
      throw new ConflictException('You have already rated this listing.');
    }

    // ── Atomic create + aggregate update ──────────────────────────────

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent rating transactions for the same seller so
        // the aggregate computed below includes every committed rating plus
        // the one we're about to write — no stale read-then-write window.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reservation.sellerId} FOR UPDATE`;

        // Re-check inside the transaction (race window between the
        // application-level check and the write).
        const duplicate = await tx.rating.findUnique({
          where: { listingId_raterId: { listingId: reservation.listingId, raterId } },
        });
        if (duplicate) {
          throw new ConflictException('You have already rated this listing.');
        }

        const rating = await tx.rating.create({
          data: {
            listingId: reservation.listingId,
            raterId,
            rateeId: reservation.sellerId,
            role: RatingRole.BUYER,
            stars: dto.stars,
            comment: dto.comment,
          },
        });

        // Derive the aggregate from the actual ratings rows rather than
        // trusting a possibly stale User.ratingAvg / ratingCount.
        const aggregate = await tx.rating.aggregate({
          where: { rateeId: reservation.sellerId },
          _count: { _all: true },
          _avg: { stars: true },
        });

        await tx.user.update({
          where: { id: reservation.sellerId },
          data: {
            ratingCount: aggregate._count._all,
            ratingAvg: aggregate._avg.stars ?? new Prisma.Decimal(0),
          },
        });

        return {
          id: rating.id,
          listingId: rating.listingId,
          raterId: rating.raterId,
          rateeId: rating.rateeId,
          stars: rating.stars,
          comment: rating.comment,
          createdAt: rating.createdAt,
        };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Database-level race safety net for @@unique([listingId, raterId]).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already rated this listing.');
      }

      this.logger.error(
        `[ERROR] Failed to create rating: raterId=${raterId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to create the rating at this time. Please try again later.',
      );
    }
  }
}
