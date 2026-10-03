import { Logger } from '@nestjs/common';

const logger = new Logger('TransactionsConfig');

/**
 * Validates and returns the reservation duration in hours.
 *
 * Must be a positive, finite number. Falls back to 48 if the configured
 * value is missing or invalid.
 */
export function getReservationDurationHours(config: { get(key: string, defaultValue?: string): string | undefined }): number {
  const raw = config.get('RESERVATION_DURATION_HOURS', '48');
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(
      `RESERVATION_DURATION_HOURS="${raw}" is invalid (must be a positive number). Falling back to 48.`,
    );
    return 48;
  }

  return parsed;
}

/**
 * Returns the secret used to derive deterministic QR tokens.
 *
 * Must be a sufficiently long, random value provided via the environment.
 * Never hardcoded, never exposed to the frontend. Throws if missing or
 * blank so misconfiguration fails fast instead of silently weakening
 * token security.
 */
export function getQrTokenSecret(config: { get(key: string, defaultValue?: string): string | undefined }): string {
  const secret = config.get('QR_TOKEN_SECRET');

  if (!secret || secret.trim().length === 0) {
    throw new Error('QR_TOKEN_SECRET is not configured. Set it to a long, random secret in the environment.');
  }

  return secret;
}
