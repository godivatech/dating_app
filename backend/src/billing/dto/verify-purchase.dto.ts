import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DevicePlatform, PaymentProvider } from '@prisma/client';

export class VerifyPurchaseDto {
  @IsEnum(DevicePlatform)
  @IsNotEmpty()
  platform: DevicePlatform;

  @IsString()
  @IsNotEmpty()
  storeProductId: string;

  @IsString()
  @IsNotEmpty()
  receiptToken: string;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;
}
