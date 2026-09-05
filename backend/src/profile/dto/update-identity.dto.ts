import { IsEnum, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateIdentityDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, {
    message: 'Display name must be between 2 and 50 characters',
  })
  displayName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date of birth must be a valid date in YYYY-MM-DD format',
  })
  dateOfBirth: string;

  @IsEnum(Gender, {
    message: 'Gender must be MAN, WOMAN, NON_BINARY, or OTHER',
  })
  gender: Gender;
}
