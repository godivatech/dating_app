import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DiscoveryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(50, { message: 'Limit cannot exceed 50.' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'Cursor must be a valid string.' })
  cursor?: string;
}
