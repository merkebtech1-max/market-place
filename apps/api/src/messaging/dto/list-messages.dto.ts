import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Messages per request when the client omits `limit`. */
export const MESSAGE_LIST_DEFAULT_LIMIT = 30;

/** Hard maximum page size — larger values are rejected, never clamped. */
export const MESSAGE_LIST_MAX_LIMIT = 50;

/**
 * Query DTO for GET /threads/:id/messages.
 *
 * `cursor` is the opaque token returned as `nextCursor` by the previous
 * page; clients echo it back to fetch older history and must not build it
 * themselves. `limit` defaults to 30 and is capped at 50: over-limit or
 * non-numeric values fail validation (400) instead of being silently changed.
 */
export class ListMessagesDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGE_LIST_MAX_LIMIT)
  limit: number = MESSAGE_LIST_DEFAULT_LIMIT;
}
