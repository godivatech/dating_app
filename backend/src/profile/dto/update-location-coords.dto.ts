import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateLocationCoordsDto {
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude: number;

  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude: number;

  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'City name must be between 2 and 60 characters' })
  locationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Region/State name cannot exceed 60 characters' })
  locationRegion?: string;
}
