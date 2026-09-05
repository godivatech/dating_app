import { Test, TestingModule } from '@nestjs/testing';
import { SpamDetectionService } from './spam-detection.service';
import { RedisService } from '../../redis/redis.service';

describe('SpamDetectionService', () => {
  let service: SpamDetectionService;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let store: Map<string, string>;

  beforeEach(async () => {
    store = new Map<string, string>();

    redisService = {
      incrementWithWindow: jest.fn().mockImplementation(async (_key, _window) => {
        return { current: 1, isFirst: true };
      }),
      get: jest.fn().mockImplementation(async (key: string) => {
        return store.get(key) || null;
      }),
      set: jest.fn().mockImplementation(async (key: string, value: string) => {
        store.set(key, value);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpamDetectionService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<SpamDetectionService>(SpamDetectionService);
  });

  it('allows single messages to different recipients', async () => {
    const res = await service.checkSpam('user1', 'user2', 'Hey, how are you doing today?');
    expect(res.isSpam).toBe(false);
    expect(res.distinctRecipientsCount).toBe(1);
  });

  it('detects mass copy-pasted message to 5+ distinct recipients', async () => {
    const copyPasteText = 'Check out my profile and follow my instagram account!';

    for (let i = 1; i <= 4; i++) {
      const res = await service.checkSpam('spammer', `target-${i}`, copyPasteText);
      expect(res.isSpam).toBe(false);
    }

    // 5th distinct recipient triggers mass spam
    const res5 = await service.checkSpam('spammer', 'target-5', copyPasteText);
    expect(res5.isSpam).toBe(true);
    expect(res5.distinctRecipientsCount).toBe(5);
    expect(res5.reason).toContain('Mass copy-pasting');
  });

  it('detects message velocity limit', async () => {
    (redisService.incrementWithWindow as jest.Mock).mockResolvedValueOnce({
      current: 30, // Exceeds MAX_MESSAGES_PER_MINUTE (25)
      isFirst: false,
    });

    const res = await service.checkSpam('spammer', 'target-1', 'Rapid message');
    expect(res.isSpam).toBe(true);
    expect(res.reason).toContain('too rapidly');
  });
});
