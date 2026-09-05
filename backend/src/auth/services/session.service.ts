import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService, GeneratedTokens } from './token.service';

export interface SessionAuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshExpiresInDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {
    this.refreshExpiresInDays =
      Number(this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN_DAYS')) ||
      30;
  }

  /**
   * Creates an initial authenticated session for a user.
   */
  async createSession(
    user: User,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionAuthResult> {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(`Account is not active (${user.status}).`);
    }

    const sessionId = (
      await this.prisma.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: `temp_init_${Date.now()}_${Math.random()}`,
          expiresAt: new Date(
            Date.now() + this.refreshExpiresInDays * 24 * 60 * 60 * 1000,
          ),
          userAgent: metadata?.userAgent,
          ipAddress: metadata?.ipAddress,
        },
      })
    ).id;

    const tokens = await this.tokenService.generateTokens(user.id, sessionId);

    // Update with real refreshTokenHash
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: tokens.refreshTokenHash,
      },
    });

    this.logger.log(
      `[SESSION_CREATED] Session ${sessionId} created for user ${user.id}`,
    );

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Atomically rotates an opaque refresh token and issues a new access token.
   * Enforces account status checks and prevents concurrent double-rotation.
   */
  async rotateSession(
    rawRefreshToken: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionAuthResult> {
    const targetHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { refreshTokenHash: targetHash },
        include: { user: true },
      });

      if (!session) {
        this.logger.warn(
          '[SESSION_ROTATION_FAILED] Refresh token not found (potential reuse or invalid token)',
        );
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (session.revokedAt) {
        this.logger.warn(
          `[SESSION_REVOKED_ATTEMPT] Attempted to refresh revoked session ${session.id}`,
        );
        throw new UnauthorizedException(
          'Session has been revoked. Please log in again.',
        );
      }

      if (session.expiresAt <= new Date()) {
        this.logger.warn(
          `[SESSION_EXPIRED] Attempted to refresh expired session ${session.id}`,
        );
        throw new UnauthorizedException(
          'Refresh token has expired. Please log in again.',
        );
      }

      if (session.user.status !== UserStatus.ACTIVE) {
        this.logger.warn(
          `[AUTH_BLOCKED] User status ${session.user.status} blocked for session ${session.id}`,
        );
        throw new ForbiddenException(
          `Account is not active (${session.user.status}).`,
        );
      }

      // Generate new tokens
      const newTokens: GeneratedTokens = await this.tokenService.generateTokens(
        session.userId,
        session.id,
      );

      const updatedExpiresAt = new Date(
        Date.now() + this.refreshExpiresInDays * 24 * 60 * 60 * 1000,
      );

      // Atomically update session in PostgreSQL
      await tx.authSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: newTokens.refreshTokenHash,
          lastUsedAt: new Date(),
          expiresAt: updatedExpiresAt,
          userAgent: metadata?.userAgent || session.userAgent,
          ipAddress: metadata?.ipAddress || session.ipAddress,
        },
      });

      this.logger.log(
        `[SESSION_REFRESHED] Session ${session.id} rotated successfully for user ${session.userId}`,
      );

      return {
        user: session.user,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      };
    });
  }

  /**
   * Revokes a session by session ID.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    this.logger.log(`[SESSION_REVOKED] Session ${sessionId} revoked.`);
  }

  /**
   * Revokes all active sessions for a user (e.g. on security reset).
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    this.logger.log(
      `[ALL_SESSIONS_REVOKED] All sessions revoked for user ${userId}`,
    );
  }
}
