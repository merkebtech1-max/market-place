import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Moderator-chosen disposition of a report. */
export class ResolveReportDto {
  @IsString()
  @IsIn(['RESOLVED', 'DISMISSED'], { message: 'status must be RESOLVED or DISMISSED' })
  status: 'RESOLVED' | 'DISMISSED';

  @IsString()
  @IsNotEmpty({ message: 'resolution is required' })
  @MaxLength(1000, { message: 'resolution must be at most 1000 characters' })
  resolution: string;
}
