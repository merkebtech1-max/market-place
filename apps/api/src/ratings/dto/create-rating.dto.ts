import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Input for rating a completed transaction.
 *
 * Only reservationId is client-supplied. The rating target (rateeId),
 * listingId, and role are derived server-side from the reservation —
 * never trust the client for those.
 */
export class CreateRatingDto {
  @IsUUID('4', { message: 'reservationId must be a valid UUID' })
  reservationId: string;

  @Type(() => Number)
  @IsInt({ message: 'stars must be an integer' })
  @Min(1, { message: 'stars must be between 1 and 5' })
  @Max(5, { message: 'stars must be between 1 and 5' })
  stars: number;

  @IsOptional()
  @IsString({ message: 'comment must be a string' })
  @MaxLength(500, { message: 'comment must be at most 500 characters' })
  comment?: string;
}
