import { IsNotEmpty, IsIn, IsOptional, IsString } from 'class-validator';

export class AdminReviewPhotoDto {
  @IsNotEmpty()
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  reason?: string;
}
