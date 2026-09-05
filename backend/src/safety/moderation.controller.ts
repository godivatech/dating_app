import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { ModerationService } from './services/moderation.service';
import { ModeratorActionDto } from './dto/moderator-action.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import {
  UserRole,
  ReportsListResponse,
  ModerationAuditLogResponse,
  AuditLogsListResponse,
} from '../../../shared/src/types';

@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /**
   * Lists moderation reports.
   */
  @Get('reports')
  async listReports(
    @Query() query: ReportsQueryDto,
  ): Promise<ReportsListResponse> {
    return this.moderationService.listReports(query);
  }

  /**
   * Applies an authoritative moderation action and logs an audit record.
   */
  @Post('actions')
  @HttpCode(HttpStatus.OK)
  async applyAction(
    @Req() req: any,
    @Body() dto: ModeratorActionDto,
  ): Promise<ModerationAuditLogResponse> {
    const moderatorUserId = req.user.userId;
    return this.moderationService.applyModeratorAction(moderatorUserId, dto);
  }

  /**
   * Lists immutable moderation audit logs.
   */
  @Get('audit-logs')
  async listAuditLogs(
    @Query() query: AuditLogsQueryDto,
  ): Promise<AuditLogsListResponse> {
    return this.moderationService.listAuditLogs(query);
  }
}
