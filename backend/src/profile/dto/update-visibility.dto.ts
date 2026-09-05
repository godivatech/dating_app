import { IsEnum } from 'class-validator';
import { ProfileVisibility } from '@prisma/client';

export class UpdateVisibilityDto {
  @IsEnum(ProfileVisibility, {
    message: 'Visibility must be VISIBLE or HIDDEN',
  })
  visibility: ProfileVisibility;
}
