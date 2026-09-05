import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallService } from './services/call.service';
import { AgoraTokenService } from './services/agora-token.service';

@Controller('calls')
@UseGuards(AuthGuard('jwt'))
export class CallController {
  constructor(
    private readonly callService: CallService,
    private readonly agoraTokenService: AgoraTokenService,
  ) {}

  @Get('history')
  async getCallHistory(@Request() req: any, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.callService.getCallHistory(req.user.id, parsedLimit);
  }

  @Post('token/refresh')
  async refreshToken(
    @Request() req: any,
    @Body() body: { channelName: string; uid: number },
  ) {
    const tokenData = this.agoraTokenService.generateRtcToken(
      body.channelName,
      body.uid,
    );
    return tokenData;
  }
}
