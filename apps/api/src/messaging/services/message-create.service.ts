import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MessageType } from '../../generated/prisma/enums.js';
import { MESSAGE_MAX_LENGTH } from '../dto/create-message.dto.js';
import { MESSAGE_PUBLIC_SELECT, type PublicMessage } from '../message-public.select.js';
import { ContactInfoService } from './contact-info.service.js';

/**
 * Owns message creation. Authorization (JWT + participant + ACTIVE) is done by
 * the participant guard before this service runs, so the thread passed in is
 * already the caller's thread — no re-checks happen here.
 *
 * Contact-information protection is delegated to ContactInfoService:
 *   - locked thread (unlockedAt == null) → detected contact info is redacted,
 *     the original saved to originalBody (internal/moderation only), and a
 *     ContactInfoViolation row is created for each distinct pattern type;
 *   - unlocked thread → message stored verbatim, no protection applied.
 *
 * LOGGING RULE: never log the message body, originalBody, or any detected
 * phone/email/handle. Only ids and lengths may be logged.
 */
@Injectable()
export class MessageCreateService {
  private readonly logger = new Logger(MessageCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactInfo: ContactInfoService,
  ) {}

  async createMessage(
    thread: { id: string; unlockedAt?: Date | null },
    senderId: string,
    body: string,
  ): Promise<PublicMessage> {
    this.logger.log(`[START] Creating message for threadId=${thread.id} by senderId=${senderId}`);

    try {
      const trimmed = body.trim();
      if (!trimmed) {
        throw new BadRequestException('Message cannot be empty.');
      }
      if (trimmed.length > MESSAGE_MAX_LENGTH) {
        throw new BadRequestException(`Message cannot exceed ${MESSAGE_MAX_LENGTH} characters.`);
      }

      const detected = this.contactInfo.inspect(thread, trimmed);
      const wasRedacted = !detected.safe;

      // Message insert, ContactInfoViolation rows, and the lastMessageAt bump
      // run as one transaction: the inbox ordering (lastMessageAt DESC) can
      // never lag behind the message, and a violation can never exist without
      // its message (or vice versa).
      const created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            threadId: thread.id,
            senderId,
            body: detected.body,
            originalBody: wasRedacted ? trimmed : null,
            type: MessageType.TEXT,
            wasRedacted,
          },
          select: MESSAGE_PUBLIC_SELECT,
        });

        if (detected.violations.length > 0) {
          await tx.contactInfoViolation.createMany({
            data: detected.violations.map((violation) => ({
              userId: senderId,
              threadId: thread.id,
              messageId: message.id,
              patternType: violation.patternType,
              matchedText: violation.matchedText,
            })),
          });
        }

        await tx.thread.update({
          where: { id: thread.id },
          data: { lastMessageAt: message.createdAt },
        });
        return message;
      });

      this.logger.log(
        `[SUCCESS] Message created: messageId=${created.id}, threadId=${thread.id}, bodyLength=${created.body.length}`,
      );
      return created;
    } catch (error) {
      // Validation errors (empty / too long) are thrown directly above and
      // pass through untouched. Anything else — database outage, Prisma
      // failure, transaction abort — is NOT the client's bad request, so it
      // becomes a 500 with a generic message; the inner detail is logged
      // server-side only and never leaks to the client.
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`[ERROR] Failed to create message for threadId=${thread.id} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new InternalServerErrorException('Unable to send your message at this time. Please try again later.');
    }
  }
}