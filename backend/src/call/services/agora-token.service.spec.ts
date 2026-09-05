import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgoraTokenService } from './agora-token.service';

describe('AgoraTokenService', () => {
  let service: AgoraTokenService;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AGORA_APP_ID') return 'mock_app_id_12345';
        if (key === 'AGORA_APP_CERTIFICATE') return 'mock_app_cert_67890';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgoraTokenService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AgoraTokenService>(AgoraTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid RTC token with expiration', () => {
    const channelName = 'test_channel_123';
    const uid = 1001;
    const result = service.generateRtcToken(channelName, uid, 1, 3600);

    expect(result).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should generate fallback mock token if app credentials are missing', async () => {
    const unconfiguredModule = await Test.createTestingModule({
      providers: [
        AgoraTokenService,
        { provide: ConfigService, useValue: { get: () => null } },
      ],
    }).compile();

    const unconfiguredService = unconfiguredModule.get<AgoraTokenService>(AgoraTokenService);
    const result = unconfiguredService.generateRtcToken('test_chan', 2002);

    expect(result.token).toContain('mock_rtc_token_test_chan');
  });
});
