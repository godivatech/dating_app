import {
  IsArray,
  IsNotEmpty,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateInterestsDto {
  @IsArray()
  @ArrayMinSize(3, { message: 'Please select at least 3 interests' })
  @ArrayMaxSize(15, { message: 'You can select at most 15 interests' })
  @IsString({ each: true, message: 'Each interest ID must be a string' })
  @IsNotEmpty({ each: true })
  interestIds: string[];
}
