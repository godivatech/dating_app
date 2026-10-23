import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CheckPhoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber!: string;
}

export class PhonePinAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber!: string;

  @IsString()
  @Length(4, 6, { message: 'Security PIN must be 4 to 6 digits' })
  @Matches(/^\d+$/, { message: 'Security PIN must contain only digits' })
  pin!: string;
}
