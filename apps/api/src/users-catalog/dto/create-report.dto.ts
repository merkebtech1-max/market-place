import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const REPORT_TARGET_TYPES = ['LISTING', 'USER', 'MESSAGE'] as const;

/**
 * Client-supplied report input. Server-owned fields (reporterId, status,
 * listingId, resolvedById, resolution) are intentionally absent.
 */
export class CreateReportDto {
  @IsString()
  @IsIn(REPORT_TARGET_TYPES, { message: 'targetType must be LISTING, USER, or MESSAGE' })
  targetType: 'LISTING' | 'USER' | 'MESSAGE';

  @IsString()
  @IsNotEmpty({ message: 'targetId is required' })
  targetId: string;

  /** Schema stores reason as a free-form string (no ReportReason enum). */
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(200, { message: 'reason must be at most 200 characters' })
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'note must be at most 500 characters' })
  note?: string;
}
