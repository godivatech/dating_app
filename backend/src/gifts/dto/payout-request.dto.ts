import { IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';

export class RequestPayoutDto {
  @IsInt()
  @IsPositive()
  @Min(50000, { message: 'Minimum withdrawal amount is ₹500 (50,000 paise)' })
  @IsNotEmpty()
  amountPaise: number;

  @IsString()
  @IsNotEmpty()
  upiId: string;

  @IsString()
  @IsNotEmpty()
  accountHolderName: string;
}
