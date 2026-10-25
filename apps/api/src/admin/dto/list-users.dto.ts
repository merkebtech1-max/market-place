import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED', 'ALL'] as const;
const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN', 'ALL'] as const;
const USER_SORTS = ['NEWEST', 'OLDEST'] as const;

/** Query params for GET /admin/users. Defaults to the full directory, newest first. */
export class ListUsersDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(USER_STATUSES, { message: 'status must be ACTIVE, SUSPENDED, DELETED, or ALL' })
  status: (typeof USER_STATUSES)[number] = 'ALL';

  @IsOptional()
  @IsIn(USER_ROLES, { message: 'role must be USER, MODERATOR, ADMIN, or ALL' })
  role: (typeof USER_ROLES)[number] = 'ALL';

  @IsOptional()
  @IsIn(USER_SORTS, { message: 'sort must be NEWEST or OLDEST' })
  sort: (typeof USER_SORTS)[number] = 'NEWEST';

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
