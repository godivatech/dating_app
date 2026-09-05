import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService();
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET')
          return 'test_jwt_access_secret_1234567890';
        if (key === 'ACCESS_TOKEN_EXPIRES_IN') return '15m';
        return null;
      }),
    } as unknown as ConfigService;

    tokenService = new TokenService(jwtService, configService);
  });

  it('should generate short-lived JWT access token and 256-bit opaque refresh token with SHA-256 hash', async () => {
    const userId = 'user-123';
    const sessionId = 'session-456';

    const tokens = await tokenService.generateTokens(userId, sessionId);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.refreshToken.length).toBe(64); // 32 bytes hex = 64 characters
    expect(tokens.refreshTokenHash).toBeDefined();
    expect(tokens.expiresIn).toBe(900); // 15m = 900s

    // Verify hash matches
    const computedHash = tokenService.hashRefreshToken(tokens.refreshToken);
    expect(computedHash).toEqual(tokens.refreshTokenHash);

    // Verify access token payload
    const decoded = await tokenService.verifyAccessToken(tokens.accessToken);
    expect(decoded.sub).toBe(userId);
    expect(decoded.sessionId).toBe(sessionId);
  });
});
