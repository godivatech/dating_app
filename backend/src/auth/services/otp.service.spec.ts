import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';
import type { ISmsService } from '../../sms/sms.service.interface';

describe('OtpService', () => {
  let otpService: OtpService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockConfig: any;
  let mockSms: ISmsService;

  const challengeStore = new Map<string, any>();

  beforeEach(() => {
    challengeStore.clear();

    mockPrisma = {
      otpChallenge: {
        create: jest.fn().mockImplementation(({ data }) => {
          challengeStore.set(data.id, { ...data });
          return Promise.resolve(data);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const item = challengeStore.get(where.id);
          return Promise.resolve(item ? { ...item } : null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = challengeStore.get(where.id);
          if (!item) return Promise.resolve(null);
          if (data.attemptsCount?.increment) {
            item.attemptsCount =
              (item.attemptsCount || 0) + data.attemptsCount.increment;
          }
          if (data.isConsumed !== undefined) {
            item.isConsumed = data.isConsumed;
          }
          if (data.consumedAt !== undefined) {
            item.consumedAt = data.consumedAt;
          }
          challengeStore.set(where.id, item);
          return Promise.resolve({ ...item });
        }),
      },
    };

    const redisStore = new Map<string, any>();
    mockRedis = {
      setWithNx: jest.fn().mockImplementation((key: string) => {
        if (redisStore.has(key)) return Promise.resolve(false);
        redisStore.set(key, true);
        return Promise.resolve(true);
      }),
      incrementWithWindow: jest.fn().mockImplementation((key: string) => {
        const count = (redisStore.get(key) || 0) + 1;
        redisStore.set(key, count);
        return Promise.resolve({ current: count, isFirst: count === 1 });
      }),
      del: jest.fn().mockImplementation((key: string) => {
        redisStore.delete(key);
        return Promise.resolve();
      }),
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'OTP_PEPPER')
          return 'test_server_side_otp_pepper_secret_1234567890';
        if (key === 'OTP_EXPIRY_SECONDS') return 300;
        if (key === 'OTP_MAX_ATTEMPTS') return 3;
        return null;
      }),
    };

    mockSms = {
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    otpService = new OtpService(mockPrisma, mockRedis, mockConfig, mockSms);
  });

  describe('HMAC Construction', () => {
    it('should compute HMAC-SHA256 bound to challengeId, otp, and server pepper', () => {
      const challengeId = 'test-challenge-123';
      const otp = '123456';
      const hash1 = otpService.computeOtpHmac(challengeId, otp);
      const hash2 = otpService.computeOtpHmac(challengeId, otp);

      expect(hash1).toBeDefined();
      expect(hash1).toEqual(hash2);

      // Changing challengeId or OTP must result in a different HMAC hash
      const differentHash = otpService.computeOtpHmac(
        'different-challenge-id',
        otp,
      );
      expect(hash1).not.toEqual(differentHash);
    });
  });

  describe('requestOtp', () => {
    it('should create an OTP challenge in PostgreSQL and dispatch via SMS provider', async () => {
      const result = await otpService.requestOtp('9876543210');

      expect(result.challengeId).toBeDefined();
      expect(result.expiresIn).toBe(300);
      expect(mockPrisma.otpChallenge.create).toHaveBeenCalledTimes(1);
      expect(mockSms.sendOtp).toHaveBeenCalledTimes(1);

      const stored = challengeStore.get(result.challengeId);
      expect(stored).toBeDefined();
      expect(stored.phoneNumber).toBe('+919876543210');
      expect(stored.isConsumed).toBe(false);
      expect(stored.attemptsCount).toBe(0);
    });

    it('should reject invalid phone numbers', async () => {
      await expect(otpService.requestOtp('invalid-phone')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should enforce atomic 60-second cooldown per phone number', async () => {
      // First request succeeds
      await otpService.requestOtp('9876543210');

      // Immediate second request fails with 429
      await expect(otpService.requestOtp('9876543210')).rejects.toThrow(
        new HttpException(
          'Please wait 60 seconds before requesting another OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });

    it('should enforce volume rate limiting (max 3 per 10 minutes)', async () => {
      // Bypass cooldown mock for volume test
      mockRedis.setWithNx.mockResolvedValue(true);

      await otpService.requestOtp('9876543210');
      await otpService.requestOtp('9876543210');
      await otpService.requestOtp('9876543210');

      // 4th request must fail with 429
      await expect(otpService.requestOtp('9876543210')).rejects.toThrow(
        new HttpException(
          'Too many OTP requests for this phone number. Please try again in 10 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });
  });

  describe('verifyOtp', () => {
    let challengeId: string;
    const testOtp = '654321';

    beforeEach(() => {
      challengeId = 'valid-challenge-id';
      const otpHash = otpService.computeOtpHmac(challengeId, testOtp);
      challengeStore.set(challengeId, {
        id: challengeId,
        phoneNumber: '+919876543210',
        otpHash,
        expiresAt: new Date(Date.now() + 300 * 1000),
        attemptsCount: 0,
        maxAttempts: 3,
        isConsumed: false,
      });
    });

    it('should successfully verify valid OTP and mark challenge as consumed', async () => {
      const result = await otpService.verifyOtp(challengeId, testOtp);

      expect(result.isValid).toBe(true);
      expect(result.phoneNumber).toBe('+919876543210');

      const updated = challengeStore.get(challengeId);
      expect(updated.isConsumed).toBe(true);
      expect(updated.consumedAt).toBeDefined();
    });

    it('should reject incorrect OTP and decrement remaining attempts', async () => {
      const result = await otpService.verifyOtp(challengeId, '000000');

      expect(result.isValid).toBe(false);
      expect(result.attemptsRemaining).toBe(2);
      expect(result.error).toContain('2 attempt(s) remaining');

      const updated = challengeStore.get(challengeId);
      expect(updated.attemptsCount).toBe(1);
      expect(updated.isConsumed).toBe(false);
    });

    it('should invalidate challenge when max attempts (3) are exhausted', async () => {
      await otpService.verifyOtp(challengeId, '000001'); // Attempt 1
      await otpService.verifyOtp(challengeId, '000002'); // Attempt 2
      const result3 = await otpService.verifyOtp(challengeId, '000003'); // Attempt 3

      expect(result3.isValid).toBe(false);
      expect(result3.attemptsRemaining).toBe(0);
      expect(result3.error).toContain('Maximum verification attempts exceeded');

      // Attempt 4 is rejected immediately
      const result4 = await otpService.verifyOtp(challengeId, testOtp);
      expect(result4.isValid).toBe(false);
      expect(result4.error).toContain('Maximum verification attempts exceeded');
    });

    it('should reject expired OTP challenge', async () => {
      const expiredId = 'expired-challenge-id';
      challengeStore.set(expiredId, {
        id: expiredId,
        phoneNumber: '+919876543210',
        otpHash: otpService.computeOtpHmac(expiredId, testOtp),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        attemptsCount: 0,
        maxAttempts: 3,
        isConsumed: false,
      });

      const result = await otpService.verifyOtp(expiredId, testOtp);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('OTP has expired');
    });

    it('should prevent OTP reuse (replay prevention)', async () => {
      // First verification succeeds
      const result1 = await otpService.verifyOtp(challengeId, testOtp);
      expect(result1.isValid).toBe(true);

      // Second verification attempt with same valid OTP must fail
      const result2 = await otpService.verifyOtp(challengeId, testOtp);
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('already been used');
    });
  });
});
