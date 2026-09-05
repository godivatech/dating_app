import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DisciplineService } from './services/discipline.service';
import { UserSafetyStatusDto } from '../../../shared/src/types';

@Controller('safety')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private readonly disciplineService: DisciplineService) {}

  /**
   * Retrieves the requesting user's account safety standing, restrictions, and active strikes.
   */
  @Get('my-status')
  async getMySafetyStatus(@Req() req: any): Promise<UserSafetyStatusDto> {
    const userId = req.user.userId;
    return this.disciplineService.getUserSafetyStatus(userId);
  }
}
