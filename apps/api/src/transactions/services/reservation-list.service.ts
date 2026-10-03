import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReservationStatus } from '../../generated/prisma/enums.js';

/** Lightweight listing card embedded in a reservation card. */
export interface ReservationListingCard {
  id: string;
  title: string;
  priceCents: number;
  condition: string;
  city: { id: string; nameEn: string; nameAm: string };
  subcity: { id: string; nameEn: string; nameAm: string } | null;
  firstImage: { storageKey: string; width: number | null; height: number | null; blurhash: string | null } | null;
  seller: {
    id: string;
    displayName: string;
    avatarKey: string | null;
    ratingAvg: string;
    ratingCount: number;
  };
}

/** Reservation card representation for the "my reservations" list. */
export interface ReservationCard {
  id: string;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  listing: ReservationListingCard;
}

const RESERVATION_CARD_SELECT = {
  id: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  listing: {
    select: {
      id: true,
      title: true,
      priceCents: true,
      condition: true,
      city: { select: { id: true, nameEn: true, nameAm: true } },
      subcity: { select: { id: true, nameEn: true, nameAm: true } },
      images: {
        select: { storageKey: true, width: true, height: true, blurhash: true, position: true },
        orderBy: { position: 'asc' },
        take: 1,
      },
      seller: { select: { id: true, displayName: true, avatarKey: true, ratingAvg: true, ratingCount: true } },
    },
  },
} satisfies Prisma.ReservationSelect;

type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_CARD_SELECT }>;

/**
 * Owns the "my reservations" list use case.
 *
 * Returns reservations for the authenticated buyer with a lightweight
 * listing-card representation. Active (RESERVED) reservations appear first,
 * then newest first within each status group.
 */
@Injectable()
export class ReservationListService {
  private readonly logger = new Logger(ReservationListService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMyReservations(buyerId: string, status?: ReservationStatus): Promise<ReservationCard[]> {
    this.logger.log(`[START] Fetching reservations for buyer=${buyerId}, status=${status || 'all'}`);

    const reservations = await this.prisma.reservation.findMany({
      where: { buyerId, ...(status ? { status } : {}) },
      select: RESERVATION_CARD_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`[SUCCESS] Retrieved ${reservations.length} reservations for buyer=${buyerId}`);

    // Business ordering: active (RESERVED) first, then newest first.
    // Explicit sort rather than relying on DB enum ordering.
    const cards = reservations.map((row) => this.toCard(row));
    return cards.sort((a, b) => {
      if (a.status === ReservationStatus.RESERVED && b.status !== ReservationStatus.RESERVED) return -1;
      if (a.status !== ReservationStatus.RESERVED && b.status === ReservationStatus.RESERVED) return 1;
      return 0; // already sorted by createdAt DESC from the query
    });
  }

  private toCard(row: ReservationRow): ReservationCard {
    return {
      id: row.id,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      listing: {
        id: row.listing.id,
        title: row.listing.title,
        priceCents: row.listing.priceCents,
        condition: row.listing.condition,
        city: row.listing.city,
        subcity: row.listing.subcity,
        firstImage: row.listing.images[0]
          ? {
              storageKey: row.listing.images[0].storageKey,
              width: row.listing.images[0].width,
              height: row.listing.images[0].height,
              blurhash: row.listing.images[0].blurhash,
            }
          : null,
        seller: {
          id: row.listing.seller.id,
          displayName: row.listing.seller.displayName,
          avatarKey: row.listing.seller.avatarKey,
          ratingAvg: row.listing.seller.ratingAvg.toString(),
          ratingCount: row.listing.seller.ratingCount,
        },
      },
    };
  }
}
