import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchesService } from './services/matches.service';
import { MatchesQueryDto } from './dto/matches-query.dto';
import {
  MatchesListResponse,
  SafeMatch,
  UnmatchResponse,
} from '../../../shared/src/types';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  /**
   * Retrieves active matches with cursor pagination.
   */
  @Get()
  async getMatches(
    @Req() req: any,
    @Query() query: MatchesQueryDto,
  ): Promise<MatchesListResponse> {
    const userId = req.user.userId;
    return this.matchesService.getMatches(userId, query);
  }

  /**
   * Retrieves pending incoming likes directed to the user.
   * Unmasks candidate details only if user holds the SEE_LIKES entitlement.
   */
  @Get('incoming-likes')
  async getIncomingLikes(
    @Req() req: any,
    @Query() query: MatchesQueryDto,
  ) {
    const userId = req.user.userId;
    return this.matchesService.getIncomingLikes(userId, query);
  }

  /**
   * Retrieves pending incoming direct messages/notes sent to the user.
   */
  @Get('incoming-notes')
  async getIncomingNotes(@Req() req: any) {
    const userId = req.user.userId;
    return this.matchesService.getIncomingNotes(userId);
  }

  /**
   * Retrieves detail for a specific match.
   */
  @Get(':matchId')
  async getMatchDetail(
    @Req() req: any,
    @Param('matchId') matchId: string,
  ): Promise<SafeMatch> {
    const userId = req.user.userId;
    return this.matchesService.getMatchDetail(userId, matchId);
  }

  /**
   * Unmatches with a matched user.
   */
  @Delete(':matchId')
  @HttpCode(HttpStatus.OK)
  async unmatch(
    @Req() req: any,
    @Param('matchId') matchId: string,
  ): Promise<UnmatchResponse> {
    const userId = req.user.userId;
    return this.matchesService.unmatch(userId, matchId);
  }
}
