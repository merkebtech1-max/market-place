import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const REPORT_ACTIONS = ['REMOVE_LISTING', 'SUSPEND_USER', 'DELETE_USER', 'REMOVE_MESSAGE', 'DISMISS'] as const;

export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** Moderator-chosen action on a pending report. */
export class ResolveReportDto {
  @IsString()
  @IsIn(REPORT_ACTIONS, { message: 'action must be REMOVE_LISTING, SUSPEND_USER, DELETE_USER, REMOVE_MESSAGE, or DISMISS' })
  action: ReportAction;

  @IsString()
  @IsNotEmpty({ message: 'resolution is required' })
  @MaxLength(1000, { message: 'resolution must be at most 1000 characters' })
  resolution: string;
}
