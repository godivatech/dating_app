import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlocksService } from './services/blocks.service';
import { BlocksQueryDto } from './dto/blocks-query.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { SafeBlock, BlocksListResponse } from '../../../shared/src/types';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  /**
   * Blocks a user and immediately terminates active matches.
   */
  @Post(':targetUserId')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @Req() req: any,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: Partial<CreateBlockDto>,
  ): Promise<SafeBlock> {
    const userId = req.user.userId;
    return this.blocksService.blockUser(userId, targetUserId, dto.reason);
  }

  /**
   * Unblocks a user.
   */
  @Delete(':targetUserId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @Req() req: any,
    @Param('targetUserId') targetUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.userId;
    return this.blocksService.unblockUser(userId, targetUserId);
  }

  /**
   * Lists users blocked by the requesting user.
   */
  @Get()
  async listBlocks(
    @Req() req: any,
    @Query() query: BlocksQueryDto,
  ): Promise<BlocksListResponse> {
    const userId = req.user.userId;
    return this.blocksService.listBlocks(userId, query);
  }
}
