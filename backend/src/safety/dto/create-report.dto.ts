import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportTargetType, ReportReason } from '../../../../shared/src/types';

export class CreateReportDto {
  @IsString({ message: 'Target user ID must be a string.' })
  @IsNotEmpty({ message: 'Target user ID is required.' })
  targetUserId: string;

  @IsEnum(ReportTargetType, { message: 'Invalid target type.' })
  targetType: ReportTargetType;

  @IsString({ message: 'Target ID must be a string.' })
  @IsNotEmpty({ message: 'Target ID is required.' })
  targetId: string;

  @IsEnum(ReportReason, { message: 'Invalid report reason.' })
  reason: ReportReason;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters.' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'autoBlock must be a boolean.' })
  autoBlock?: boolean;
}
