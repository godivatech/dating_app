import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ReorderPhotosDto {
  @IsArray()
  @ArrayMinSize(1, {
    message: 'At least one photo ID must be provided for reordering.',
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  photoIds: string[];
}
