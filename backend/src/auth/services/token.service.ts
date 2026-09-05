import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

export interface JwtAccessPayload {
  sub: string;
  sessionId: string;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string; // Raw opaque token returned to client
  refreshTokenHash: string; // SHA-256 hash persisted in database
  expiresIn: number; // Access token expiry in seconds
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly accessExpiresInSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'default_dev_jwt_access_secret_never_use_in_production_1234567890';
    this.accessExpiresIn =
      this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN') || '15m';
    this.accessExpiresInSeconds = this.parseDurationToSeconds(
      this.accessExpiresIn,
    );
  }

  /**
   * Generates a short-lived access JWT and a cryptographically random opaque refresh token.
   */
  async generateTokens(
    userId: string,
    sessionId: string,
  ): Promise<GeneratedTokens> {
    const payload: JwtAccessPayload = { sub: userId, sessionId };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });

    // Generate 256-bit cryptographically secure opaque refresh token
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenHash,
      expiresIn: this.accessExpiresInSeconds,
    };
  }

  /**
   * Computes SHA-256 hash of an opaque refresh token.
   */
  hashRefreshToken(refreshToken: string): string {
    return crypto
      .createHash('sha256')
      .update(refreshToken.trim())
      .digest('hex');
  }

  /**
   * Verifies an access token JWT.
   */
  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    return this.jwtService.verifyAsync<JwtAccessPayload>(token, {
      secret: this.accessSecret,
    });
  }

  private parseDurationToSeconds(duration: string): number {
    if (duration.endsWith('m')) {
      return parseInt(duration.slice(0, -1), 10) * 60;
    }
    if (duration.endsWith('h')) {
      return parseInt(duration.slice(0, -1), 10) * 3600;
    }
    if (duration.endsWith('d')) {
      return parseInt(duration.slice(0, -1), 10) * 86400;
    }
    if (duration.endsWith('s')) {
      return parseInt(duration.slice(0, -1), 10);
    }
    return 900; // Default 15 minutes
  }
}
