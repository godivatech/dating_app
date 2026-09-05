import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthService,
  AuthResponseDto,
  SafeUserDto,
} from './services/auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './guards/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Request OTP challenge for phone number.
   */
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Ip() ip: string,
  ): Promise<{ challengeId: string; expiresIn: number }> {
    return this.authService.requestOtp(dto.phoneNumber, ip);
  }

  /**
   * Verify OTP challenge and create/authenticate account session.
   */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    return this.authService.verifyOtp(dto.challengeId, dto.otp, {
      userAgent,
      ipAddress: ip,
    });
  }

  /**
   * Direct instant login for development without OTP step.
   */
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(
    @Body() dto: RequestOtpDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    return this.authService.devLogin(dto.phoneNumber, {
      userAgent,
      ipAddress: ip,
    });
  }

  /**
   * Rotate refresh token and obtain new access & refresh tokens.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    return this.authService.refreshSession(dto.refreshToken, {
      userAgent,
      ipAddress: ip,
    });
  }

  /**
   * Invalidate current authenticated session (Logout).
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    return this.authService.logout(user.sessionId);
  }

  /**
   * Retrieve current authenticated user account.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<SafeUserDto> {
    return this.authService.getMe(user.userId);
  }
}
