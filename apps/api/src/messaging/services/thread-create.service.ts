import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, UserStatus } from '../../generated/prisma/enums.js';
import { ThreadModel } from '../../generated/prisma/models/Thread.js';

/** Scalar fields shared by every thread read across the module. */
export const THREAD_BASE_SELECT = {
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  unlockedAt: true,
  lastMessageAt: true,
  createdAt: true,
} as const;

/**
 * Owns the create-or-retrieve lifecycle for conversation threads.
 *
 * A thread is unique per (listingId, buyerId), so the service is idempotent:
 * repeated "Message Seller" taps return the same thread and never create
 * duplicates, including under concurrent requests (P2002 race).
 */
@Injectable()
export class ThreadCreateService {
  private readonly logger = new Logger(ThreadCreateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createThread(listingId: string, buyerId: string): Promise<ThreadModel> {
    this.logger.log(`[START] Ensuring thread for listing=${listingId} by buyerId=${buyerId}`);

    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          sellerId: true,
          status: true,
          expiresAt: true,
          seller: { select: { status: true } },
        },
      });

      if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException('Only active listings can be messaged.');
      }
      if (!listing.expiresAt || listing.expiresAt <= new Date()) {
        throw new BadRequestException('This listing has expired and can no longer be messaged.');
      }
      if (listing.seller.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('This listing is no longer available.');
      }
      // A seller can never open their own conversation — the buyer must always
      // be someone other than the listing's owner.
      if (listing.sellerId === buyerId) {
        throw new BadRequestException('You cannot open a conversation about your own listing.');
      }

      const buyer = await this.prisma.user.findUnique({
        where: { id: buyerId },
        select: { id: true, status: true },
      });
      if (!buyer || buyer.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('Your account is not active, so you cannot start a conversation.');
      }

      const existing = await this.findExisting(listingId, buyerId);
      if (existing) {
        this.logger.log(`[SUCCESS] Thread already exists: threadId=${existing.id}`);
        return existing;
      }

      try {
        const created = await this.prisma.thread.create({
          data: { listingId, buyerId, sellerId: listing.sellerId },
          select: THREAD_BASE_SELECT,
        });
        this.logger.log(`[SUCCESS] Thread created: threadId=${created.id}, buyerId=${buyerId}, sellerId=${listing.sellerId}`);
        return created;
      } catch (error) {
        // P2002 = the (listingId, buyerId) unique constraint fired because a
        // concurrent request created the same thread — return that one instead.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const raced = await this.findExisting(listingId, buyerId);
          if (raced) {
            this.logger.log(`[SUCCESS] Concurrent request yielded existing thread: threadId=${raced.id}`);
            return raced;
          }
        }
        throw error;
      }
    } catch (error) {
      // Business validation (NotFoundException / BadRequestException thrown
      // above) passes through untouched. Unexpected failures — database
      // outages, Prisma errors — are server faults, not client bad requests:
      // surface a generic 500 and log the real cause server-side only.
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`[ERROR] Failed to ensure thread for listing=${listingId}, buyerId=${buyerId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Unable to open a conversation for this listing at this time. Please try again later.');
    }
  }

  private async findExisting(listingId: string, buyerId: string): Promise<ThreadModel | null> {
    return this.prisma.thread.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
      select: THREAD_BASE_SELECT,
    });
  }
}