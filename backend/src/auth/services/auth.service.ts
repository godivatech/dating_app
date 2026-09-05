import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { PhoneUtil } from '../utils/phone.util';

export interface SafeUserDto {
  id: string;
  phoneNumber: string;
  phoneVerifiedAt: Date | null;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthResponseDto {
  user: SafeUserDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Requests an OTP challenge for the given phone number.
   */
  async requestOtp(
    phoneNumber: string,
    ipAddress?: string,
  ): Promise<{ challengeId: string; expiresIn: number }> {
    return this.otpService.requestOtp(phoneNumber, ipAddress);
  }

  /**
   * Verifies an OTP challenge, creates/retrieves the user account, updates lastLoginAt,
   * creates an authenticated session, and returns safe tokens and user data.
   */
  async verifyOtp(
    challengeId: string,
    otp: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const verifyResult = await this.otpService.verifyOtp(challengeId, otp);

    if (!verifyResult.isValid || !verifyResult.phoneNumber) {
      throw new BadRequestException(verifyResult.error || 'Invalid OTP');
    }

    const normalizedPhone = verifyResult.phoneNumber;

    // Find or create User atomically
    let user = await this.prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    const now = new Date();

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phoneNumber: normalizedPhone,
          phoneVerifiedAt: now,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      });
      this.logger.log(
        `[USER_CREATED] New user account ${user.id} registered for ${PhoneUtil.mask(normalizedPhone)}`,
      );
    } else {
      if (user.status !== UserStatus.ACTIVE) {
        this.logger.warn(
          `[AUTH_BLOCKED] Account ${user.id} status ${user.status} prevented from logging in.`,
        );
        throw new ForbiddenException(
          `Account is not active (${user.status}). Please contact support.`,
        );
      }

      // Update lastLoginAt on successful login
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerifiedAt: user.phoneVerifiedAt || now,
          lastLoginAt: now,
        },
      });
      this.logger.log(
        `[USER_LOGIN] User ${user.id} logged in (${PhoneUtil.mask(normalizedPhone)})`,
      );
    }

    // Create session & tokens
    const sessionResult = await this.sessionService.createSession(
      user,
      metadata,
    );

    return {
      user: this.formatSafeUser(user),
      accessToken: sessionResult.accessToken,
      refreshToken: sessionResult.refreshToken,
      expiresIn: sessionResult.expiresIn,
    };
  }

  /**
   * Direct instant login for seamless development without OTP delays.
   */
  async devLogin(
    rawPhone: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const { isValid, normalized, error } = PhoneUtil.normalize(rawPhone);
    if (!isValid || !normalized) {
      throw new BadRequestException(error || 'Invalid phone number format');
    }

    let user = await this.prisma.user.findUnique({
      where: { phoneNumber: normalized },
    });

    const now = new Date();

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phoneNumber: normalized,
          phoneVerifiedAt: now,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      });
      this.logger.log(
        `[DEV_LOGIN_CREATED] User ${user.id} registered directly for ${PhoneUtil.mask(normalized)}`,
      );
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerifiedAt: user.phoneVerifiedAt || now,
          lastLoginAt: now,
          status: UserStatus.ACTIVE,
        },
      });
      this.logger.log(
        `[DEV_LOGIN] User ${user.id} logged in directly for ${PhoneUtil.mask(normalized)}`,
      );
    }

    const sessionResult = await this.sessionService.createSession(
      user,
      metadata,
    );

    return {
      user: this.formatSafeUser(user),
      accessToken: sessionResult.accessToken,
      refreshToken: sessionResult.refreshToken,
      expiresIn: sessionResult.expiresIn,
    };
  }

  /**
   * Refreshes an authenticated session using an opaque refresh token.
   */
  async refreshSession(
    refreshToken: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const result = await this.sessionService.rotateSession(
      refreshToken,
      metadata,
    );

    return {
      user: this.formatSafeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  /**
   * Logs out a session by session ID.
   */
  async logout(sessionId: string): Promise<{ success: boolean }> {
    await this.sessionService.revokeSession(sessionId);
    return { success: true };
  }

  /**
   * Retrieves the safe authenticated user profile for /auth/me.
   */
  async getMe(userId: string): Promise<SafeUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(`Account is not active (${user.status}).`);
    }

    return this.formatSafeUser(user);
  }

  private formatSafeUser(user: User): SafeUserDto {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      phoneVerifiedAt: user.phoneVerifiedAt,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
