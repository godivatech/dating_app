import {
  Injectable,
  Inject,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SMS_SERVICE } from '../../sms/sms.service.interface';
import type { ISmsService } from '../../sms/sms.service.interface';
import { PhoneUtil } from '../utils/phone.util';

export interface VerifyOtpResult {
  isValid: boolean;
  phoneNumber: string;
  error?: string;
  attemptsRemaining?: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly pepper: string;
  private readonly expirySeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Inject(SMS_SERVICE) private readonly smsService: ISmsService,
  ) {
    this.pepper =
      this.configService.get<string>('OTP_PEPPER') ||
      'default_dev_otp_pepper_secret_never_use_in_production_1234567890';
    this.expirySeconds =
      Number(this.configService.get<number>('OTP_EXPIRY_SECONDS')) || 300;
    this.maxAttempts =
      Number(this.configService.get<number>('OTP_MAX_ATTEMPTS')) || 3;
  }

  /**
   * Generates HMAC-SHA256 hash bound to challengeId and server-side secret pepper:
   * HMAC-SHA256(key = OTP_PEPPER, message = challengeId + ":" + otp)
   */
  computeOtpHmac(challengeId: string, otp: string): string {
    return crypto
      .createHmac('sha256', this.pepper)
      .update(`${challengeId}:${otp}`)
      .digest('hex');
  }

  /**
   * Initiates an OTP challenge: validates phone, enforces atomic cooldown and rate limits,
   * stores challenge in PostgreSQL, and dispatches OTP via SMS provider.
   */
  async requestOtp(
    rawPhone: string,
    ipAddress?: string,
  ): Promise<{ challengeId: string; expiresIn: number }> {
    const { isValid, normalized, error } = PhoneUtil.normalize(rawPhone);
    if (!isValid || !normalized) {
      throw new BadRequestException(error || 'Invalid phone number format');
    }

    const isDev = process.env.NODE_ENV === 'development';

    // 1. Enforce atomic 60-second cooldown per phone number (enforced in production & test)
    if (!isDev) {
      const cooldownKey = `rl:otp:cooldown:${normalized}`;
      const cooldownSet = await this.redisService.setWithNx(cooldownKey, '1', 60);
      if (!cooldownSet) {
        throw new HttpException(
          'Please wait 60 seconds before requesting another OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 2. Enforce volume limit per phone (max 3 OTPs per 10 minutes)
      const phoneLimitKey = `rl:otp:phone:${normalized}`;
      const { current: phoneReqCount } =
        await this.redisService.incrementWithWindow(phoneLimitKey, 600);
      if (phoneReqCount > 3) {
        throw new HttpException(
          'Too many OTP requests for this phone number. Please try again in 10 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 3. Enforce volume limit per IP address (max 10 OTPs per 10 minutes)
      if (ipAddress) {
        const ipLimitKey = `rl:otp:ip:${ipAddress}`;
        const { current: ipReqCount } =
          await this.redisService.incrementWithWindow(ipLimitKey, 600);
        if (ipReqCount > 10) {
          throw new HttpException(
            'Too many OTP requests from this network. Please try again later.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    // 4. Generate cryptographically secure challenge and 6-digit OTP
    const challengeId = crypto.randomUUID();
    const otp = isDev ? '123456' : crypto.randomInt(100000, 999999).toString();
    const otpHash = this.computeOtpHmac(challengeId, otp);
    const expiresAt = new Date(Date.now() + this.expirySeconds * 1000);

    // 5. Store challenge in PostgreSQL (Single Source of Truth)
    await this.prisma.otpChallenge.create({
      data: {
        id: challengeId,
        phoneNumber: normalized,
        otpHash,
        expiresAt,
        maxAttempts: this.maxAttempts,
        attemptsCount: 0,
        isConsumed: false,
      },
    });

    this.logger.log(
      `[OTP_REQUESTED] Challenge ${challengeId} created for ${PhoneUtil.mask(normalized)} (Dev OTP: ${otp})`,
    );

    // 6. Send OTP via SMS provider abstraction
    await this.smsService.sendOtp(normalized, otp);

    return {
      challengeId,
      expiresIn: this.expirySeconds,
    };
  }

  /**
   * Verifies an OTP challenge against stored PostgreSQL challenge record with constant-time equality.
   */
  async verifyOtp(challengeId: string, otp: string): Promise<VerifyOtpResult> {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return {
        isValid: false,
        phoneNumber: '',
        error: 'Invalid or expired OTP challenge. Please request a new OTP.',
      };
    }

    if (challenge.isConsumed) {
      return {
        isValid: false,
        phoneNumber: challenge.phoneNumber,
        error: 'This OTP has already been used. Please request a new OTP.',
      };
    }

    if (challenge.expiresAt <= new Date()) {
      return {
        isValid: false,
        phoneNumber: challenge.phoneNumber,
        error: 'OTP has expired. Please request a new OTP.',
      };
    }

    if (challenge.attemptsCount >= challenge.maxAttempts) {
      return {
        isValid: false,
        phoneNumber: challenge.phoneNumber,
        error:
          'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }

    // Compute expected HMAC hash and compare in constant time (Allow 123456 in dev mode)
    const isDev = process.env.NODE_ENV !== 'production';
    const isDevMasterOtp = isDev && otp.trim() === '123456';
    const expectedHash = challenge.otpHash;
    const computedHash = this.computeOtpHmac(challengeId, otp.trim());

    const isMatch = isDevMasterOtp || this.timingSafeCompare(expectedHash, computedHash);

    if (!isMatch) {
      // Increment attempt counter atomically
      const updated = await this.prisma.otpChallenge.update({
        where: { id: challengeId },
        data: {
          attemptsCount: { increment: 1 },
        },
      });

      const remaining = Math.max(
        0,
        updated.maxAttempts - updated.attemptsCount,
      );

      this.logger.warn(
        `[OTP_FAILED] Incorrect OTP attempt for challenge ${challengeId} (${PhoneUtil.mask(challenge.phoneNumber)}). Remaining: ${remaining}`,
      );

      return {
        isValid: false,
        phoneNumber: challenge.phoneNumber,
        error:
          remaining > 0
            ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
            : 'Incorrect OTP. Maximum verification attempts exceeded. Please request a new OTP.',
        attemptsRemaining: remaining,
      };
    }

    // Mark challenge as consumed atomically
    await this.prisma.otpChallenge.update({
      where: { id: challengeId },
      data: {
        isConsumed: true,
        consumedAt: new Date(),
      },
    });

    this.logger.log(
      `[OTP_VERIFIED] Challenge ${challengeId} verified for ${PhoneUtil.mask(challenge.phoneNumber)}`,
    );

    return {
      isValid: true,
      phoneNumber: challenge.phoneNumber,
    };
  }

  private timingSafeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
