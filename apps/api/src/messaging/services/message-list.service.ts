import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MESSAGE_PUBLIC_SELECT, type PublicMessage } from '../message-public.select.js';
import { decodeMessageCursor, encodeMessageCursor } from '../pagination/message-cursor.js';

/** One page of messages plus the pagination state for the next request. */
export interface MessagePage {
  messages: PublicMessage[];
  pagination: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

/** Pagination inputs resolved by the DTO: a page size and an optional cursor. */
export interface MessageListParams {
  limit: number;
  cursor?: string;
}

/**
 * Owns reading a thread's message history with cursor pagination.
 * Authorization (JWT + participant + ACTIVE) is done by ThreadParticipantGuard
 * before this service runs, so the thread passed in is already the caller's
 * thread — no re-checks happen here, and the thread is never re-fetched.
 *
 * Ordering is newest-first: createdAt DESC with id DESC as the tie-breaker.
 * createdAt alone is not a stable cursor (two messages can share a
 * timestamp), so continuation is identified by the pair. The client only ever
 * sees the Base64-encoded cursor, never these fields.
 *
 * The query takes limit + 1 rows: the extra row proves another page exists
 * without a COUNT(*) query. It is discarded before responding, so
 * hasNextPage=true comes with exactly `limit` messages and a nextCursor
 * pointing at the last one returned.
 */
@Injectable()
export class MessageListService {
  private readonly logger = new Logger(MessageListService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMessages(
    thread: { id: string },
    params: MessageListParams,
  ): Promise<MessagePage> {
    const { limit, cursor: rawCursor } = params;
    this.logger.log(
      `[START] Fetching messages for threadId=${thread.id} limit=${limit} cursor=${rawCursor ? 'present' : 'none'}`,
    );

    try {
      // Malformed cursors throw BadRequestException (400) here, before any
      // database call, so garbage never reaches Prisma.
      const cursor = rawCursor ? decodeMessageCursor(rawCursor) : null;

      const rows = await this.prisma.message.findMany({
        where: {
          threadId: thread.id,
          ...(cursor && {
            // Everything strictly older than the cursor position under
            // (createdAt DESC, id DESC): older timestamp, or same timestamp
            // with a lexicographically smaller id.
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        // Fetch one extra row purely to detect whether an older page exists.
        take: limit + 1,
        select: MESSAGE_PUBLIC_SELECT,
      });

      const hasNextPage = rows.length > limit;
      const messages = hasNextPage ? rows.slice(0, limit) : rows;

      // Only emitted when the extra row proved more history exists. Built
      // from the last message actually returned so the next page starts
      // exactly after it — never from the discarded peek row.
      const lastReturned = messages[messages.length - 1];
      const nextCursor =
        hasNextPage && lastReturned
          ? encodeMessageCursor({ createdAt: lastReturned.createdAt, id: lastReturned.id })
          : null;

      this.logger.log(
        `[SUCCESS] Fetched ${messages.length} messages for threadId=${thread.id} hasNextPage=${hasNextPage}`,
      );
      return { messages, pagination: { nextCursor, hasNextPage } };
    } catch (error) {
      // The cursor's 400 and any future validation errors pass through
      // untouched. Anything else — database outage, Prisma failure — is not
      // the client's fault, so it becomes a 500 with a generic message; the
      // detail is logged server-side only and never leaks to the client.
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `[ERROR] Failed to fetch messages for threadId=${thread.id} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to retrieve messages at this time. Please try again later.',
      );
    }
  }
}
