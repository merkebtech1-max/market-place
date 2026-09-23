import { ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, UserStatus } from '../../generated/prisma/enums.js';

/** Lightweight row for the "my conversations" inbox: thread scalars, a slim
 * listing snapshot, both participants, and the newest message preview. */
const THREAD_LIST_SELECT = {
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  unlockedAt: true,
  lastMessageAt: true,
  createdAt: true,
  listing: {
    select: {
      id: true,
      title: true,
      priceCents: true,
      images: {
        select: { storageKey: true, width: true, height: true, blurhash: true, position: true },
        orderBy: { position: 'asc' },
        take: 1,
      },
    },
  },
  buyer: {
    select: { id: true, displayName: true, avatarKey: true },
  },
  seller: {
    select: { id: true, displayName: true, avatarKey: true },
  },
  messages: {
    // readAt lets the frontend derive the tick state of the last message
    // (null = delivered/unread, timestamp = read) by comparing senderId.
    select: { id: true, body: true, type: true, senderId: true, createdAt: true, readAt: true },
    orderBy: { createdAt: 'desc' },
    // TODO(messages): preview only — full history/pagination comes with the
    // message endpoints. When redaction lands, expose the final visible body
    // (Message.body) here and NEVER select Message.originalBody — it must not
    // leak into the inbox.
    take: 1,
  },
} satisfies Prisma.ThreadSelect;

type ThreadListRow = Prisma.ThreadGetPayload<{ select: typeof THREAD_LIST_SELECT }>;

/** Newest message preview shown in the inbox; null when nothing was sent yet. */
export interface ThreadLastMessage {
  id: string;
  body: string;
  type: 'TEXT' | 'SYSTEM';
  senderId: string;
  createdAt: Date;
  /** When the OTHER participant read it; null = still unread. The frontend
   * derives the tick state from senderId + this timestamp. */
  readAt: Date | null;
}

/** Public conversation summary — only what the inbox UI needs. */
export interface ThreadSummary {
  id: string;
  listingId: string;
  listing: {
    id: string;
    title: string;
    priceCents: number;
    image: ThreadListRow['listing']['images'][number] | null;
  };
  /** The other participant, resolved for the requesting user. */
  counterparty: {
    id: string;
    displayName: string;
    avatarKey: string | null;
  };
  lastMessage: ThreadLastMessage | null;
  /** Newest activity: last message time, falling back to thread creation. */
  lastActivityAt: Date;
  unlockedAt: Date | null;
  // TODO(read-status): unreadCount for the inbox badge lands with readAt work.
}

/**
 * Owns the "my conversations" feed: every thread the current user is part of,
 * restricted to threads whose listing is still active + unexpired and whose
 * seller is active (same visibility rules as the saved feed), sorted newest
 * conversation first (by last message, falling back to creation time).
 */
@Injectable()
export class ThreadListService {
  private readonly logger = new Logger(ThreadListService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMyThreads(userId: string): Promise<ThreadSummary[]> {
    this.logger.log(`[START] Fetching threads for userId=${userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('Your account is not active, so you cannot access conversations.');
      }

      const rows = await this.prisma.thread.findMany({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          listing: {
            status: ListingStatus.ACTIVE,
            expiresAt: { gt: new Date() },
            seller: { status: UserStatus.ACTIVE },
          },
        },
        // Newest activity first; threads that never had a message sort by
        // creation time so a freshly-started thread still appears on top.
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        select: THREAD_LIST_SELECT,
      });

      const threads = rows.map((row) => {
        const isSellerViewing = row.seller.id === userId;
        return {
          id: row.id,
          listingId: row.listingId,
          listing: {
            id: row.listing.id,
            title: row.listing.title,
            priceCents: row.listing.priceCents,
            image: row.listing.images[0] ?? null,
          },
          counterparty: isSellerViewing ? row.buyer : row.seller,
          lastMessage: row.messages[0] ?? null,
          lastActivityAt: row.lastMessageAt ?? row.createdAt,
          unlockedAt: row.unlockedAt,
        };
      });

      this.logger.log(`[SUCCESS] Fetched ${threads.length} threads for userId=${userId}`);
      return threads;
    } catch (error) {
      // ForbiddenException passes through; anything unexpected (DB outage,
      // Prisma failure) is a server fault → generic 500, detail logged only.
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`[ERROR] Failed to fetch threads for userId=${userId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Unable to retrieve your conversations at this time. Please try again later.');
    }
  }
}
