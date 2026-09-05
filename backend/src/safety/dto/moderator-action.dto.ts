import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ModerationActionType } from '../../../../shared/src/types';

export class ModeratorActionDto {
  @IsString({ message: 'Target user ID must be a string.' })
  @IsNotEmpty({ message: 'Target user ID is required.' })
  targetUserId: string;

  @IsEnum(ModerationActionType, { message: 'Invalid moderation action type.' })
  actionType: ModerationActionType;

  @IsString({ message: 'Reason must be a string.' })
  @IsNotEmpty({ message: 'Action reason is required.' })
  @MaxLength(1000, { message: 'Reason cannot exceed 1000 characters.' })
  reason: string;

  @IsOptional()
  @IsString({ message: 'Report ID must be a string.' })
  reportId?: string;

  @IsOptional()
  @IsString({ message: 'Photo ID must be a string.' })
  photoId?: string;
}
