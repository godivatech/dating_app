import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GiftType } from '../../../../shared/src/types';

export class SendGiftDto {
  @IsString()
  @IsNotEmpty()
  receiverUserId: string;

  @IsEnum(GiftType)
  @IsNotEmpty()
  giftType: GiftType;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  callId?: string;
}
