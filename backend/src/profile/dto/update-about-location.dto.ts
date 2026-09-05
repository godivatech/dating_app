import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateAboutLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio cannot exceed 500 characters' })
  bio?: string;

  @IsString()
  @Length(2, 60, { message: 'City name must be between 2 and 60 characters' })
  locationCity: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Region/State name cannot exceed 60 characters' })
  locationRegion?: string;
}
