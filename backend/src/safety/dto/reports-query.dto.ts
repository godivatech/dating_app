import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportStatus, ReportReason } from '../../../../shared/src/types';

export class ReportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(50, { message: 'Limit cannot exceed 50.' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'Cursor must be a string.' })
  cursor?: string;

  @IsOptional()
  @IsEnum(ReportStatus, { message: 'Invalid report status filter.' })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportReason, { message: 'Invalid report reason filter.' })
  reason?: ReportReason;
}
