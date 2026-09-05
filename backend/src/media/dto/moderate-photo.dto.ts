import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PhotoStatus } from '@prisma/client';

export class ModeratePhotoDto {
  @IsEnum(PhotoStatus, {
    message: 'Status must be APPROVED or REJECTED.',
  })
  status: PhotoStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  rejectionReason?: string;
}
