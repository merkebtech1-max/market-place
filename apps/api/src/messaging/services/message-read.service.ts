import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** How many unread messages were newly marked as read by one request. */
export interface MessageReadResult {
  updatedCount: number;
}

/**
 * Owns marking a thread's messages as read for one participant.
 * Authorization (JWT + participant + ACTIVE) is done by ThreadParticipantGuard
 * before this service runs, so the thread passed in is already the caller's
 * thread — it is never re-fetched or re-checked here.
 *
 * A Message carries a single readAt timestamp, which is enough for a
 * two-party (buyer/seller) conversation: what matters is the recipient
 * reading the sender's messages, so no separate MessageRead table exists.
 *
 * Only the OTHER participant's unread messages become read — the caller's own
 * sent messages are never touched. The whole operation is one bulk
 * updateMany (no fetch-then-loop), and it is idempotent: a second call with
 * nothing left to read simply returns updatedCount 0 as a success.
 */
@Injectable()
export class MessageReadService {
  private readonly logger = new Logger(MessageReadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async markAsRead(thread: { id: string }, userId: string): Promise<MessageReadResult> {
    this.logger.log(`[START] Marking messages as read: threadId=${thread.id}, userId=${userId}`);

    try {
      const { count } = await this.prisma.message.updateMany({
        where: {
          threadId: thread.id,
          // Only messages the OTHER side sent, and only ones still unread.
          senderId: { not: userId },
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      this.logger.log(
        `[SUCCESS] Marked ${count} message(s) as read: threadId=${thread.id}, userId=${userId}`,
      );
      return { updatedCount: count };
    } catch (error) {
      // There is no client-error path here (zero matches is a success, not an
      // error), so every failure is a server-side one: database outage,
      // Prisma failure — logged with detail server-side and surfaced to the
      // client as a generic 500.
      this.logger.error(
        `[ERROR] Failed to mark messages as read for threadId=${thread.id} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to mark messages as read at this time. Please try again later.',
      );
    }
  }
}
