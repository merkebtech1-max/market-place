import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * Feeds the default discovery feed with lightweight, deterministic variety.
 *
 * The ordering is derived from a seed that is stable for a given identity
 * (user id or anonymous feed seed) and a six-hour UTC bucket, so:
 *  - the same user/session sees the same ordering for the whole bucket,
 *  - pagination stays deterministic (page 2 is a slice of the same ordering),
 *  - a new bucket produces a new ordering.
 *
 * No identity or behavior is persisted anywhere.
 */
@Injectable()
export class ListingFeedService {
  private readonly SIX_HOUR_MS = 6 * 60 * 60 * 1000;

  /**
   * Recency boundaries (in hours). A listing whose publishedAt is newer than a
   * boundary belongs to that (younger) window; older listings fall through to
   * the next one, and anything beyond the last boundary lands in the oldest bucket.
   */
  private readonly RECENCY_WINDOW_HOURS = [24, 72, 168];

  /** Bucket index: floor(utcMillis / 6h). Stable for six hours, then increments. */
  getSixHourBucket(now: Date): number {
    return Math.floor(now.getTime() / this.SIX_HOUR_MS);
  }

  /** Start of the current six-hour bucket. */
  getBucketStart(now: Date): Date {
    return new Date(this.getSixHourBucket(now) * this.SIX_HOUR_MS);
  }

  /** Deterministic seed = hash(identity:bucket). */
  buildFeedSeed(identity: string, now: Date): string {
    const bucket = this.getSixHourBucket(now);
    return createHash('md5').update(`${identity}:${bucket}`).digest('hex');
  }

  /**
   * Builds a self-contained ORDER BY fragment:
   * recency window -> deterministic numeric seed score -> listing id (stable tie-breaker).
   *
   * The seed score is the first 32 bits of md5(seed || listingId) read as an integer.
   * This keeps the ordering deterministic without pretending a hash is a UUID.
   *
   * Window boundaries are anchored to the start of the current six-hour bucket so
   * the ordering is identical for every request inside the bucket.
   *
   * All embedded values are server-derived (md5 hex seed + ISO timestamps), never
   * user input, so they are safe to inline as literals.
   */
  buildFeedOrderBy(seed: string, now: Date): string {
    const reference = this.getBucketStart(now);
    const boundaries = this.RECENCY_WINDOW_HOURS.map((hours) => {
      const boundary = new Date(reference.getTime() - hours * 60 * 60 * 1000);
      return boundary.toISOString();
    });

    return `
      CASE
        WHEN l."publishedAt" > '${boundaries[0]}'::timestamptz THEN 1
        WHEN l."publishedAt" > '${boundaries[1]}'::timestamptz THEN 2
        WHEN l."publishedAt" > '${boundaries[2]}'::timestamptz THEN 3
        ELSE 4
      END,
      ('x' || substr(md5('${seed}' || l.id::text), 1, 8))::bit(32)::int,
      l.id`;
  }
}
