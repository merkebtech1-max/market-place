import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const LISTING_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED', 'REMOVED', 'ALL'] as const;
const LISTING_SORTS = ['NEWEST', 'OLDEST'] as const;

/** Query params for GET /admin/listings. Defaults to the full directory, newest first. */
export class ListListingsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(LISTING_STATUSES, { message: `status must be one of ${LISTING_STATUSES.join(', ')}` })
  status: (typeof LISTING_STATUSES)[number] = 'ALL';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  subcityId?: string;

  @IsOptional()
  @IsIn(LISTING_SORTS, { message: 'sort must be NEWEST or OLDEST' })
  sort: (typeof LISTING_SORTS)[number] = 'NEWEST';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
