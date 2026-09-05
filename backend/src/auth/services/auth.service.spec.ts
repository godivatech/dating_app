import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockOtpService: any;
  let mockSessionService: any;

  const userStore = new Map<string, User>();

  beforeEach(() => {
    userStore.clear();

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve(userStore.get(where.id) || null);
          if (where.phoneNumber) {
            for (const user of userStore.values()) {
              if (user.phoneNumber === where.phoneNumber) {
                return Promise.resolve({ ...user });
              }
            }
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const user: User = {
            id: `user-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          userStore.set(user.id, user);
          return Promise.resolve(user);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const user = userStore.get(where.id);
          if (!user) return Promise.resolve(null);
          Object.assign(user, data);
          userStore.set(where.id, user);
          return Promise.resolve({ ...user });
        }),
      },
    };

    mockOtpService = {
      requestOtp: jest
        .fn()
        .mockResolvedValue({ challengeId: 'challenge-123', expiresIn: 300 }),
      verifyOtp: jest
        .fn()
        .mockImplementation((challengeId: string, otp: string) => {
          if (otp === '123456') {
            return Promise.resolve({
              isValid: true,
              phoneNumber: '+919876543210',
            });
          }
          return Promise.resolve({
            isValid: false,
            phoneNumber: '+919876543210',
            error: 'Incorrect OTP',
          });
        }),
    };

    mockSessionService = {
      createSession: jest.fn().mockImplementation((user: User) => {
        return Promise.resolve({
          user,
          accessToken: 'mock_jwt_access_token',
          refreshToken: 'mock_opaque_refresh_token',
          expiresIn: 900,
        });
      }),
      rotateSession: jest.fn().mockResolvedValue({
        user: {
          id: 'user-123',
          phoneNumber: '+919876543210',
          phoneVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
        },
        accessToken: 'new_mock_jwt_access_token',
        refreshToken: 'new_mock_opaque_refresh_token',
        expiresIn: 900,
      }),
      revokeSession: jest.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService(
      mockPrisma,
      mockOtpService,
      mockSessionService,
    );
  });

  describe('requestOtp', () => {
    it('should delegate to OtpService without modifying user or lastLoginAt', async () => {
      const result = await authService.requestOtp('+919876543210');
      expect(result.challengeId).toBe('challenge-123');
      expect(mockOtpService.requestOtp).toHaveBeenCalledWith(
        '+919876543210',
        undefined,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should create new account and update lastLoginAt upon first successful OTP verification', async () => {
      const result = await authService.verifyOtp('challenge-123', '123456');

      expect(result.user).toBeDefined();
      expect(result.user.phoneNumber).toBe('+919876543210');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
      expect(result.user.lastLoginAt).toBeDefined();
      expect(result.accessToken).toBe('mock_jwt_access_token');
      expect(result.refreshToken).toBe('mock_opaque_refresh_token');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should update lastLoginAt for existing active user upon login', async () => {
      const existingUser: User = {
        id: 'existing-user-1',
        phoneNumber: '+919876543210',
        phoneVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        createdAt: new Date(Date.now() - 100000),
        updatedAt: new Date(),
        lastLoginAt: null,
      };
      userStore.set(existingUser.id, existingUser);

      const result = await authService.verifyOtp('challenge-123', '123456');
      expect(result.user.id).toBe('existing-user-1');
      expect(result.user.lastLoginAt).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should reject login if user account is SUSPENDED', async () => {
      const suspendedUser: User = {
        id: 'suspended-user',
        phoneNumber: '+919876543210',
        phoneVerifiedAt: new Date(),
        status: UserStatus.SUSPENDED,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };
      userStore.set(suspendedUser.id, suspendedUser);

      await expect(
        authService.verifyOtp('challenge-123', '123456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject verification if OTP is invalid', async () => {
      await expect(
        authService.verifyOtp('challenge-123', '000000'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMe', () => {
    it('should return safe user profile without security hashes or tokens', async () => {
      const user: User = {
        id: 'user-safe-1',
        phoneNumber: '+919876543210',
        phoneVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };
      userStore.set(user.id, user);

      const me = await authService.getMe('user-safe-1');
      expect(me.id).toBe('user-safe-1');
      expect(me.phoneNumber).toBe('+919876543210');
      expect((me as any).refreshTokenHash).toBeUndefined();
      expect((me as any).otpHash).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      await expect(authService.getMe('non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
