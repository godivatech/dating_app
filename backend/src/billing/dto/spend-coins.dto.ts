import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class SpendCoinsDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: 'DIRECT_NOTE' | 'BOOST' | 'CALL' | 'REWIND' | 'UNBLUR';

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
