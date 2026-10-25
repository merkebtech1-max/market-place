import { IsIn, IsOptional } from 'class-validator';

const REPORT_STATUSES = ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;
const REPORT_TARGET_TYPES = ['LISTING', 'USER', 'MESSAGE'] as const;

/** Query params for GET /admin/reports. Default status is PENDING. */
export class ListReportsDto {
  @IsOptional()
  @IsIn(REPORT_STATUSES, { message: 'status must be PENDING, REVIEWING, RESOLVED, or DISMISSED' })
  status?: (typeof REPORT_STATUSES)[number];

  @IsOptional()
  @IsIn(REPORT_TARGET_TYPES, { message: 'targetType must be LISTING, USER, or MESSAGE' })
  targetType?: (typeof REPORT_TARGET_TYPES)[number];
}
