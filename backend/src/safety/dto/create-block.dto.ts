import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlockDto {
  @IsString({ message: 'Target user ID must be a string.' })
  @IsNotEmpty({ message: 'Target user ID is required.' })
  targetUserId: string;

  @IsOptional()
  @IsString({ message: 'Reason must be a string.' })
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters.' })
  reason?: string;
}
