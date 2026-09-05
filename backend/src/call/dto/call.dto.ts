import { IsString, IsNotEmpty, IsEnum, IsUUID, IsOptional } from 'class-validator';
import { CallType, CallEndReason } from '@prisma/client';

export class InitiateCallDto {
  @IsUUID()
  @IsNotEmpty()
  matchId: string;

  @IsUUID()
  @IsNotEmpty()
  receiverUserId: string;

  @IsEnum(CallType)
  @IsOptional()
  callType?: CallType = CallType.VIDEO;
}

export class AcceptCallDto {
  @IsUUID()
  @IsNotEmpty()
  callId: string;
}

export class RejectCallDto {
  @IsUUID()
  @IsNotEmpty()
  callId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class EndCallDto {
  @IsUUID()
  @IsNotEmpty()
  callId: string;

  @IsEnum(CallEndReason)
  @IsOptional()
  reason?: CallEndReason = CallEndReason.CALLER_HANGUP;
}
