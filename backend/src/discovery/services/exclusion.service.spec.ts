import { ExclusionService } from './exclusion.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';

describe('ExclusionService', () => {
  let service: ExclusionService;
  let mockPrisma: any;
  let mockSafetyPolicy: any;

  beforeEach(() => {
    mockPrisma = {
      discoveryImpression: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { targetProfileId: 'seen-profile-1' },
            { targetProfileId: 'seen-profile-2' },
          ]),
      },
      userAction: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ targetProfileId: 'liked-profile-1' }]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            user1: { profile: { id: 'my-profile-id' } },
            user2: { profile: { id: 'matched-profile-1' } },
          },
        ]),
      },
      datingProfile: {
        findMany: jest.fn().mockResolvedValue([{ id: 'blocked-profile-1' }]),
      },
    };

    mockSafetyPolicy = {
      getMutualBlockedUserIds: jest
        .fn()
        .mockResolvedValue(new Set(['blocked-user-1'])),
    };

    service = new ExclusionService(
      mockPrisma as PrismaService,
      mockSafetyPolicy as SafetyPolicyService,
    );
  });

  it('should query suppressed profile IDs from impressions, actions, matches, and mutual blocks', async () => {
    const suppressed = await service.getSuppressedProfileIds('user-1', 7);
    expect(suppressed.has('seen-profile-1')).toBe(true);
    expect(suppressed.has('seen-profile-2')).toBe(true);
    expect(suppressed.has('liked-profile-1')).toBe(true);
    expect(suppressed.has('matched-profile-1')).toBe(true);
    expect(suppressed.has('blocked-profile-1')).toBe(true);
    expect(suppressed.has('unseen-profile')).toBe(false);
  });

  it('should categorize suppression data into hard exclusions and soft recent impressions', async () => {
    const data = await service.getSuppressionData('user-1', 30);
    expect(data.hardExcludedIds.has('liked-profile-1')).toBe(true);
    expect(data.hardExcludedIds.has('matched-profile-1')).toBe(true);
    expect(data.hardExcludedIds.has('blocked-profile-1')).toBe(true);
    expect(data.hardExcludedIds.has('seen-profile-1')).toBe(false);
    expect(data.recentImpressionIds.has('seen-profile-1')).toBe(true);
    expect(data.recentImpressionIds.has('seen-profile-2')).toBe(true);
  });

  it('should filter out self and all suppressed profiles', () => {
    const suppressed = new Set([
      'seen-profile-1',
      'liked-profile-1',
      'matched-profile-1',
    ]);
    const candidates = [
      { id: 'my-profile-id', userId: 'user-1' },
      { id: 'seen-profile-1', userId: 'user-2' },
      { id: 'liked-profile-1', userId: 'user-3' },
      { id: 'matched-profile-1', userId: 'user-4' },
      { id: 'valid-candidate-1', userId: 'user-5' },
    ];

    const result = service.filterExclusions(
      candidates,
      'user-1',
      'my-profile-id',
      suppressed,
    );

    expect(result.length).toBe(1);
    expect(result[0].id).toBe('valid-candidate-1');
  });

  it('should filter out shadowbanned candidate profiles', () => {
    const suppressed = new Set<string>();
    const candidates = [
      {
        id: 'candidate-normal',
        userId: 'user-normal',
        user: { shadowBannedUntil: null },
      },
      {
        id: 'candidate-shadowbanned',
        userId: 'user-banned',
        user: {
          shadowBannedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      {
        id: 'candidate-expired-shadowban',
        userId: 'user-expired',
        user: {
          shadowBannedUntil: new Date(Date.now() - 60 * 1000),
        },
      },
    ];

    const result = service.filterExclusions(
      candidates,
      'user-requester',
      'profile-requester',
      suppressed,
    );

    expect(result.length).toBe(2);
    expect(result.map((c) => c.id)).toEqual([
      'candidate-normal',
      'candidate-expired-shadowban',
    ]);
  });
});
