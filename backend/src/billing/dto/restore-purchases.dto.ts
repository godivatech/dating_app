import { IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class RestorePurchasesDto {
  @IsEnum(DevicePlatform)
  @IsNotEmpty()
  platform: DevicePlatform;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  receiptTokens: string[];
}
