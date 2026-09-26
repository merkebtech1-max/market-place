import { createHmac } from 'node:crypto';

/**
 * Extracts and hashes the real client IP from request headers.
 *
 * Priority:
 *  1. CF-Connecting-IP — set by Cloudflare, cannot be forged by the client.
 *  2. First entry of X-Forwarded-For — the leftmost value is the originating
 *     client when the header is a comma-separated proxy chain. Taking only
 *     the first entry avoids hashing the entire chain as one string, which
 *     would produce different hashes for the same client across different
 *     proxy paths.
 *
 * Returns undefined if neither header is present.
 */
export function hashIp(
  cfConnectingIp: string | undefined,
  xForwardedFor: string | undefined,
): string | undefined {
  const ip =
    cfConnectingIp?.trim() ||
    xForwardedFor?.split(',')[0]?.trim();

  if (!ip) return undefined;

  const pepper = process.env.IP_HASH_SECRET;
  if (!pepper) {
    throw new Error('IP_HASH_SECRET environment variable is required for IP hashing');
  }
  return createHmac('sha256', pepper).update(ip).digest('hex');
}
