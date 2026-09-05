import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockPrisma: any;
  let mockTokenService: any;
  let mockConfigService: any;

  const sessionStore = new Map<string, any>();
  let mockUser: User;

  beforeEach(() => {
    sessionStore.clear();

    mockUser = {
      id: 'user-123',
      phoneNumber: '+919876543210',
      phoneVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };

    mockTokenService = {
      generateTokens: jest.fn().mockImplementation((userId: string) => {
        const rawRefreshToken = `mock_refresh_${Date.now()}_${Math.random()}`;
        return Promise.resolve({
          accessToken: `mock_jwt_access_${userId}`,
          refreshToken: rawRefreshToken,
          refreshTokenHash: `hash_${rawRefreshToken}`,
          expiresIn: 900,
        });
      }),
      hashRefreshToken: jest.fn((token: string) => `hash_${token}`),
    };

    mockPrisma = {
      authSession: {
        create: jest.fn().mockImplementation(({ data }) => {
          const session = {
            id: `session-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          sessionStore.set(session.id, session);
          return Promise.resolve(session);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const session = sessionStore.get(where.id);
          if (!session) return Promise.resolve(null);
          Object.assign(session, data);
          sessionStore.set(where.id, session);
          return Promise.resolve(session);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id)
            return Promise.resolve(sessionStore.get(where.id) || null);
          if (where.refreshTokenHash) {
            for (const session of sessionStore.values()) {
              if (session.refreshTokenHash === where.refreshTokenHash) {
                return Promise.resolve({ ...session, user: mockUser });
              }
            }
          }
          return Promise.resolve(null);
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let count = 0;
          for (const session of sessionStore.values()) {
            if (where.id && session.id === where.id) {
              Object.assign(session, data);
              count++;
            }
            if (where.userId && session.userId === where.userId) {
              Object.assign(session, data);
              count++;
            }
          }
          return Promise.resolve({ count });
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        const res = callback({
          authSession: {
            findUnique: jest.fn().mockImplementation(({ where }) => {
              for (const session of sessionStore.values()) {
                if (session.refreshTokenHash === where.refreshTokenHash) {
                  return Promise.resolve({ ...session, user: mockUser });
                }
              }
              return Promise.resolve(null);
            }),
            update: jest.fn().mockImplementation(({ where, data }) => {
              const session = sessionStore.get(where.id);
              if (session) {
                Object.assign(session, data);
                sessionStore.set(where.id, session);
              }
              return Promise.resolve(session);
            }),
          },
        });
        return await res;
      }),
    };

    mockConfigService = {
      get: jest.fn(() => 30),
    };

    sessionService = new SessionService(
      mockPrisma,
      mockTokenService,
      mockConfigService,
    );
  });

  describe('createSession', () => {
    it('should create an active session for active user', async () => {
      const result = await sessionService.createSession(mockUser);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
      expect(mockPrisma.authSession.create).toHaveBeenCalled();
    });

    it('should reject session creation for inactive/suspended users', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      await expect(sessionService.createSession(suspendedUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('rotateSession', () => {
    it('should rotate valid refresh token atomically and return new tokens', async () => {
      const created = await sessionService.createSession(mockUser);
      const rotated = await sessionService.rotateSession(created.refreshToken);

      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toEqual(created.refreshToken);
    });

    it('should prevent concurrent refresh attempts for the same token', async () => {
      const created = await sessionService.createSession(mockUser);

      // First rotation succeeds
      await sessionService.rotateSession(created.refreshToken);

      // Attempting to rotate with the old token again must be rejected
      await expect(
        sessionService.rotateSession(created.refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject rotation for revoked sessions', async () => {
      const created = await sessionService.createSession(mockUser);

      // Revoke the session
      for (const session of sessionStore.values()) {
        session.revokedAt = new Date();
      }

      await expect(
        sessionService.rotateSession(created.refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject rotation for expired sessions', async () => {
      const created = await sessionService.createSession(mockUser);

      // Expire the session
      for (const session of sessionStore.values()) {
        session.expiresAt = new Date(Date.now() - 1000);
      }

      await expect(
        sessionService.rotateSession(created.refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should block refresh if user status has transitioned to BANNED or SUSPENDED', async () => {
      const created = await sessionService.createSession(mockUser);

      // Change user status
      mockUser.status = UserStatus.BANNED;

      await expect(
        sessionService.rotateSession(created.refreshToken),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeSession', () => {
    it('should mark session as revoked in PostgreSQL', async () => {
      await sessionService.createSession(mockUser);
      const sessionId = Array.from(sessionStore.keys())[0];

      await sessionService.revokeSession(sessionId);

      const stored = sessionStore.get(sessionId);
      expect(stored.revokedAt).toBeDefined();
    });
  });
});
