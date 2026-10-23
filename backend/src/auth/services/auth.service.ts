import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { PhoneUtil } from '../utils/phone.util';
import { PinUtil } from '../utils/pin.util';

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
    private readonly redisService: RedisService,
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
   * Checks whether a phone number is already registered and if it has a security PIN configured.
   */
  async checkPhone(
    rawPhone: string,
  ): Promise<{ exists: boolean; hasPin: boolean }> {
    const { isValid, normalized, error } = PhoneUtil.normalize(rawPhone);
    if (!isValid || !normalized) {
      throw new BadRequestException(error || 'Invalid phone number format');
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: normalized },
      select: { id: true, pinHash: true, status: true },
    });

    if (user && user.status !== UserStatus.ACTIVE && user.status !== UserStatus.DEACTIVATED) {
      throw new ForbiddenException(`Account is ${user.status}. Please contact support.`);
    }

    return {
      exists: !!user,
      hasPin: !!user?.pinHash,
    };
  }

  /**
   * Authenticates or registers a user via Phone Number + 4-digit Security PIN.
   * Zero SMS cost, brute-force protected via Redis, constant-time hashed comparison.
   */
  async loginWithPin(
    rawPhone: string,
    pin: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const { isValid, normalized, error } = PhoneUtil.normalize(rawPhone);
    if (!isValid || !normalized) {
      throw new BadRequestException(error || 'Invalid phone number format');
    }

    if (!PinUtil.isValidPinFormat(pin)) {
      throw new BadRequestException('Security PIN must be 4 to 6 digits');
    }

    // Rate limiting for PIN attempts (Max 5 attempts per phone within 15 minutes)
    const attemptsKey = `auth:pin:attempts:${normalized}`;
    const attemptsStr = await this.redisService.get(attemptsKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    if (attempts >= 5) {
      throw new ForbiddenException(
        'Too many incorrect PIN attempts. For security, please wait 15 minutes before trying again.',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { phoneNumber: normalized },
    });

    const now = new Date();

    if (!user) {
      // New user registration with PIN
      user = await this.prisma.user.create({
        data: {
          phoneNumber: normalized,
          phoneVerifiedAt: now,
          pinHash: PinUtil.hashPin(pin),
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      });
      this.logger.log(
        `[USER_REGISTER_PIN] New user account ${user.id} registered for ${PhoneUtil.mask(normalized)}`,
      );
    } else {
      if (user.status === UserStatus.DEACTIVATED) {
        // Reactivate deactivated account if authenticating with correct PIN
        if (user.pinHash) {
          const isValidPin = PinUtil.verifyPin(pin, user.pinHash);
          if (!isValidPin) {
            await this.redisService.set(attemptsKey, (attempts + 1).toString(), 900);
            throw new UnauthorizedException('Incorrect security PIN. Please try again.');
          }
        }
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
            pinHash: user.pinHash || PinUtil.hashPin(pin),
            lastLoginAt: now,
          },
        });
        this.logger.log(`[USER_REACTIVATED] Account ${user.id} reactivated via PIN login.`);
      } else if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          `Account is not active (${user.status}). Please contact support.`,
        );
      } else {
        // User is ACTIVE
        if (!user.pinHash) {
          // First time setting PIN on existing account
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              pinHash: PinUtil.hashPin(pin),
              lastLoginAt: now,
            },
          });
          this.logger.log(`[USER_PIN_SET] Security PIN initialized for user ${user.id}`);
        } else {
          // Verify existing PIN
          const isValidPin = PinUtil.verifyPin(pin, user.pinHash);
          if (!isValidPin) {
            await this.redisService.set(attemptsKey, (attempts + 1).toString(), 900);
            const remaining = Math.max(0, 4 - attempts);
            throw new UnauthorizedException(
              `Incorrect security PIN. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Account temporarily locked for 15 minutes.'}`,
            );
          }
          // Reset attempts on successful PIN entry
          await this.redisService.del(attemptsKey);
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: now,
            },
          });
          this.logger.log(`[USER_LOGIN_PIN] User ${user.id} logged in with PIN`);
        }
      }
    }

    const sessionResult = await this.sessionService.createSession(user, metadata);

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
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Developer instant login is disabled in production.');
    }

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
