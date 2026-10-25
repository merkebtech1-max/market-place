import { BadRequestException } from '@nestjs/common';

/**
 * Position of one message in the newest-first (createdAt DESC, id DESC)
 * message ordering. The id is the tie-breaker: two messages can share a
 * timestamp, so the pair — not createdAt alone — identifies an exact spot.
 */
export interface MessageCursor {
  createdAt: Date;
  id: string;
}

/**
 * Encodes a cursor as URL-safe Base64(JSON) so clients only ever see an
 * opaque token like `nextCursor: "eyJ..."` and never the fields inside.
 * The client must echo it back verbatim; it is not meant to be built by hand.
 */
export function encodeMessageCursor(cursor: MessageCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
    'utf8',
  ).toString('base64url');
}

/**
 * Decodes a cursor supplied by a client back into its fields.
 *
 * Anything malformed — bad Base64, non-JSON, wrong shape, missing id, or an
 * unparseable timestamp — becomes a 400 here so a garbage cursor never
 * reaches Prisma and surfaces as an obscure database error.
 */
export function decodeMessageCursor(raw: string): MessageCursor {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Cursor is not an object.');
    }

    const { createdAt, id } = parsed as { createdAt?: unknown; id?: unknown };
    if (typeof createdAt !== 'string') {
      throw new Error('Cursor is missing createdAt.');
    }
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('Cursor is missing id.');
    }

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Cursor createdAt is not a valid date.');
    }

    return { createdAt: date, id };
  } catch {
    throw new BadRequestException('Invalid cursor.');
  }
}
