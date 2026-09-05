import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ActionType } from '../../../../shared/src/types';

export class RecordActionDto {
  @IsString({ message: 'Target profile ID must be a string.' })
  @IsNotEmpty({ message: 'Target profile ID cannot be empty.' })
  targetProfileId: string;

  @IsEnum(ActionType, { message: 'Action type must be LIKE or PASS.' })
  actionType: ActionType;

  @IsOptional()
  @IsString({ message: 'Algorithm version must be a string.' })
  algorithmVersion?: string;

  @IsOptional()
  @IsString({ message: 'Note must be a string.' })
  note?: string;
}
