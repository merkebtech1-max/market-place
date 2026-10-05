import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const AUDIT_LOG_SORTS = ['NEWEST', 'OLDEST'] as const;

/** Query params for GET /admin/audit-logs. */
export class ListAuditLogsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  target?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO datetime' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO datetime' })
  to?: string;

  @IsOptional()
  @IsIn(AUDIT_LOG_SORTS, { message: 'sort must be NEWEST or OLDEST' })
  sort: (typeof AUDIT_LOG_SORTS)[number] = 'NEWEST';

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
