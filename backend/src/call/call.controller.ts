import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallService } from './services/call.service';
import { RefreshTokenDto } from './dto/call.dto';

@Controller('calls')
@UseGuards(AuthGuard('jwt'))
export class CallController {
  constructor(private readonly callService: CallService) {}

  @Get('history')
  async getCallHistory(@Request() req: any, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.callService.getCallHistory(req.user.userId, parsedLimit);
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Request() req: any, @Body() dto: RefreshTokenDto) {
    return this.callService.refreshToken(req.user.userId, dto);
  }
}
