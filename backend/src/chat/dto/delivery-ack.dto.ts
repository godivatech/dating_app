import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryAckDto {
  @IsString({ message: 'Message ID must be a string.' })
  @IsNotEmpty({ message: 'Message ID is required.' })
  messageId: string;

  @Type(() => Number)
  @IsInt({ message: 'Sequence must be an integer.' })
  @Min(1, { message: 'Sequence must be at least 1.' })
  sequence: number;
}
