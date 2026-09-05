import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendMessageDto {
  @IsString({ message: 'Client message ID must be a string.' })
  @IsNotEmpty({ message: 'Client message ID is required.' })
  clientMessageId: string;

  @IsString({ message: 'Message body must be a string.' })
  @IsNotEmpty({ message: 'Message body cannot be empty.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: 'Message body must contain at least 1 character.' })
  @MaxLength(2000, { message: 'Message body cannot exceed 2000 characters.' })
  body: string;
}
