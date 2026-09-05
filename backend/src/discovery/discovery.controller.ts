import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscoveryService } from './services/discovery.service';
import { ImpressionService } from './services/impression.service';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';
import { RecordImpressionDto } from './dto/record-impression.dto';
import {
  DiscoveryFeedResponse,
  RecordImpressionResponse,
} from '../../../shared/src/types';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly impressionService: ImpressionService,
  ) {}

  /**
   * Retrieves a safe, mutually compatible, ranked, and paginated discovery candidate feed.
   */
  @Get()
  async getDiscoveryFeed(
    @Req() req: any,
    @Query() query: DiscoveryQueryDto,
  ): Promise<DiscoveryFeedResponse> {
    const userId = req.user.userId;
    return this.discoveryService.getDiscoveryFeed(userId, query);
  }

  /**
   * Records candidate presentation impressions idempotently.
   */
  @Post('impressions')
  @HttpCode(HttpStatus.OK)
  async recordImpressions(
    @Req() req: any,
    @Body() dto: RecordImpressionDto,
  ): Promise<RecordImpressionResponse> {
    const userId = req.user.userId;
    return this.impressionService.recordImpressions(userId, dto);
  }
}
