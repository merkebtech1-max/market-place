import { Prisma } from '../generated/prisma/client.js';

/**
 * The only message fields that may ever reach a client. Shared by message
 * creation and message retrieval so both endpoints return the exact same
 * shape.
 *
 * originalBody is intentionally absent: it is an internal/moderation field
 * and must never reach the client. Never add ContactInfoViolation data,
 * matchedText, or any other internal moderation information here — a
 * redacted message must stay redacted when it is retrieved later.
 */
export const MESSAGE_PUBLIC_SELECT = {
  id: true,
  threadId: true,
  senderId: true,
  body: true,
  type: true,
  wasRedacted: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

/** Public message shape returned by every endpoint that returns messages. */
export interface PublicMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  type: 'TEXT' | 'SYSTEM';
  wasRedacted: boolean;
  createdAt: Date;
}
