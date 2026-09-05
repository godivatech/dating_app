import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ModerationActionType } from '../../../../shared/src/types';

export class AuditLogsQueryDto {
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
  @IsString({ message: 'Target user ID must be a string.' })
  targetUserId?: string;

  @IsOptional()
  @IsEnum(ModerationActionType, { message: 'Invalid action type filter.' })
  actionType?: ModerationActionType;
}
