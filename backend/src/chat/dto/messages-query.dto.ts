import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class MessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(50, { message: 'Limit cannot exceed 50.' })
  limit?: number = 30;

  @IsOptional()
  @IsString({ message: 'Cursor must be a string.' })
  cursor?: string;

  @IsOptional()
  @IsIn(['before', 'after'], { message: 'Direction must be before or after.' })
  direction?: 'before' | 'after' = 'before';
}
