import {
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordImpressionItemDto {
  @IsString({ message: 'Candidate profile ID must be a string.' })
  @IsNotEmpty({ message: 'Candidate profile ID cannot be empty.' })
  candidateProfileId: string;

  @IsInt({ message: 'Position must be an integer.' })
  @Min(0, { message: 'Position must be at least 0.' })
  position: number;

  @IsOptional()
  @IsString({ message: 'Algorithm version must be a string.' })
  algorithmVersion?: string;
}

export class RecordImpressionDto {
  @IsArray({ message: 'Impressions must be an array.' })
  @ArrayMinSize(1, { message: 'At least 1 impression must be provided.' })
  @ArrayMaxSize(50, {
    message: 'Cannot record more than 50 impressions at once.',
  })
  @ValidateNested({ each: true })
  @Type(() => RecordImpressionItemDto)
  impressions: RecordImpressionItemDto[];
}
