import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import type { AdminDisciplineAction } from '../../../../shared/src/types';

export class AdminDisciplineDto {
  @IsNotEmpty()
  @IsIn([
    'WARN',
    'MUTE_24H',
    'SHADOWBAN_7D',
    'BAN',
    'UNBAN',
    'RESET_STRIKES',
  ])
  action: AdminDisciplineAction;

  @IsNotEmpty()
  @IsString()
  reason: string;
}
