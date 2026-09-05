import { IsEnum, IsInt, IsOptional, IsArray, Min, Max } from 'class-validator';
import {
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
} from '@prisma/client';

export class UpdatePreferencesDto {
  @IsEnum(PreferredGenderMode, {
    message: 'Preferred gender mode must be ANY or SELECTED',
  })
  preferredGenderMode: PreferredGenderMode;

  @IsOptional()
  @IsArray()
  @IsEnum(Gender, {
    each: true,
    message: 'Each preferred gender must be a valid Gender',
  })
  preferredGenders?: Gender[];

  @IsInt()
  @Min(18, { message: 'Minimum age preference must be at least 18' })
  @Max(99, { message: 'Minimum age preference cannot exceed 99' })
  minAge: number;

  @IsInt()
  @Min(18, { message: 'Maximum age preference must be at least 18' })
  @Max(99, { message: 'Maximum age preference cannot exceed 99' })
  maxAge: number;

  @IsEnum(RelationshipIntent, {
    message:
      'Relationship intent must be LONG_TERM, MARRIAGE, SERIOUS_DATING, OPEN_TO_EXPLORE, or CASUAL',
  })
  relationshipIntent: RelationshipIntent;
}
