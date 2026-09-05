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
import { ReportsService } from './services/reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { SafeReport } from '../../../shared/src/types';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Submits a safety report.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async createReport(
    @Req() req: any,
    @Body() dto: CreateReportDto,
  ): Promise<SafeReport> {
    const userId = req.user.userId;
    return this.reportsService.createReport(userId, dto);
  }
}
