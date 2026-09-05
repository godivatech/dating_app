import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActionsService } from './services/actions.service';
import { RecordActionDto } from './dto/record-action.dto';
import { RecordActionResponse } from '../../../shared/src/types';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  /**
   * Records an explicit LIKE or PASS decision toward a dating candidate.
   * Atomically establishes a Match if reciprocal interest exists.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async recordAction(
    @Req() req: any,
    @Body() dto: RecordActionDto,
  ): Promise<RecordActionResponse> {
    const userId = req.user.userId;
    return this.actionsService.recordAction(userId, dto);
  }

  /**
   * Undoes the most recent PASS action in discovery.
   * Requires REWIND_PASS entitlement.
   */
  @Post('undo')
  @HttpCode(HttpStatus.OK)
  async undoLastPass(@Req() req: any): Promise<{ success: boolean; rewoundProfileId: string; message: string }> {
    const userId = req.user.userId;
    return this.actionsService.undoLastPass(userId);
  }
}
