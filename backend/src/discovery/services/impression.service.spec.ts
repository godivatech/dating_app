import { ImpressionService } from './impression.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BadRequestException } from '@nestjs/common';

describe('ImpressionService', () => {
  let service: ImpressionService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      datingProfile: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'cand-1' }, { id: 'cand-2' }]),
      },
      discoveryImpression: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    mockRedis = {
      incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
    };

    service = new ImpressionService(
      mockPrisma as PrismaService,
      mockRedis as RedisService,
    );
  });

  it('should record valid impressions idempotently', async () => {
    const result = await service.recordImpressions('user-1', {
      impressions: [
        { candidateProfileId: 'cand-1', position: 0 },
        { candidateProfileId: 'cand-2', position: 1 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.recordedCount).toBe(2);
    expect(mockPrisma.discoveryImpression.createMany).toHaveBeenCalledTimes(1);
  });

  it('should skip already recently recorded impressions (idempotent)', async () => {
    mockPrisma.discoveryImpression.findMany.mockResolvedValue([
      { targetProfileId: 'cand-1' },
    ]);
    mockPrisma.discoveryImpression.createMany.mockResolvedValue({ count: 1 });

    const result = await service.recordImpressions('user-1', {
      impressions: [
        { candidateProfileId: 'cand-1', position: 0 },
        { candidateProfileId: 'cand-2', position: 1 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.recordedCount).toBe(1);
  });

  it('should throw BadRequestException if rate limit is exceeded', async () => {
    mockRedis.incrementWithWindow.mockResolvedValue({ current: 65 }); // Exceeds limit

    await expect(
      service.recordImpressions('user-1', {
        impressions: [{ candidateProfileId: 'cand-1', position: 0 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
