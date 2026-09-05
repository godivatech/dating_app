import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReadReceiptDto {
  @Type(() => Number)
  @IsInt({ message: 'throughSequence must be an integer.' })
  @Min(1, { message: 'throughSequence must be at least 1.' })
  throughSequence: number;
}
