import { createHash, createHmac } from 'node:crypto';

/**
 * Derives the deterministic raw QR token for a reservation.
 *
 * rawToken = HMAC-SHA256(serverSecret, reservationId)
 *
 * The same reservation and secret always produce the same token, so the
 * raw token never needs to be stored — only its hash is persisted.
 *
 * Pure crypto logic: knows nothing about Prisma, reservations as
 * entities, users, HTTP, or NestJS exceptions.
 */
export function generateQrToken(reservationId: string, secret: string): string {
  return createHmac('sha256', secret).update(reservationId, 'utf8').digest('hex');
}

/**
 * Deterministically hashes a raw QR token with SHA-256.
 *
 * The same raw token always produces the same hash, and different tokens
 * produce different hashes with negligible collision probability.
 * Only the resulting hash should ever be stored in PostgreSQL.
 */
export function hashQrToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
