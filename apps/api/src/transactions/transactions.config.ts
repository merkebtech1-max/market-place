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
