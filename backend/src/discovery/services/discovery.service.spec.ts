import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DiscoveryEligibilityService } from './discovery-eligibility.service';
import { ProfileCompletionService } from '../../profile/services/profile-completion.service';
import { MutualCompatibilityService } from './mutual-compatibility.service';
import { CandidateGeneratorService } from './candidate-generator.service';
import { ExclusionService } from './exclusion.service';
import { BaselineRankingStrategy } from '../strategies/baseline-ranking.strategy';
import { DiversityService } from './diversity.service';
import { DiscoveryPaginationService } from './discovery-pagination.service';
import { StorageService } from '../../media/storage/storage.interface';
import {
  UserStatus,
  ProfileStatus,
  ProfileVisibility,
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
  PhotoStatus,
} from '@prisma/client';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockStorage: any;

  const validRequester = {
    id: 'user-requester',
    status: UserStatus.ACTIVE,
    profile: {
      id: 'profile-requester',
      userId: 'user-requester',
      displayName: 'Alice',
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'), // 28
      gender: Gender.WOMAN,
      bio: 'Coffee lover and traveler from Bengaluru enjoying life.',
      locationCity: 'Bengaluru',
      locationRegion: 'Karnataka',
      locationCountry: 'IN',
      visibility: ProfileVisibility.VISIBLE,
      status: ProfileStatus.READY,
      preferences: {
        preferredGenderMode: PreferredGenderMode.SELECTED,
        preferredGenders: [Gender.MAN],
        minAge: 24,
        maxAge: 32,
        relationshipIntent: RelationshipIntent.LONG_TERM,
      },
      interests: [
        { interestId: 'hiking', interest: { name: 'Hiking' } },
        { interestId: 'coffee', interest: { name: 'Coffee' } },
        { interestId: 'travel', interest: { name: 'Travel' } },
      ],
      photos: [
        {
          id: 'p-1',
          status: PhotoStatus.APPROVED,
          position: 0,
          thumbnailKey: 'profiles/p1/thumb.webp',
        },
      ],
    },
  };

  const validCandidate = {
    id: 'profile-candidate',
    userId: 'user-candidate',
    displayName: 'Bob',
    dateOfBirth: new Date('1997-08-20T00:00:00.000Z'), // 29
    gender: Gender.MAN,
    bio: 'Software engineer who loves weekend treks and brewing coffee.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    user: { id: 'user-candidate', status: UserStatus.ACTIVE },
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.WOMAN],
      minAge: 25,
      maxAge: 30,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [{ interestId: 'hiking', interest: { name: 'Hiking' } }],
    photos: [
      {
        id: 'cp-1',
        profileId: 'profile-candidate',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/cp1/thumb.webp',
        mediumKey: 'profiles/cp1/med.webp',
        largeKey: 'profiles/cp1/large.webp',
        width: 1080,
        height: 1440,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(validRequester),
      },
      datingProfile: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where?.user?.entitlements) {
            return Promise.resolve([]);
          }
          return Promise.resolve([validCandidate]);
        }),
      },
      discoveryImpression: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userAction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockRedis = {
      incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
    };

    mockStorage = {
      getPublicUrl: jest
        .fn()
        .mockImplementation((key) => `https://cdn.datingapp.com/${key}`),
    };

    const eligibilityService = new DiscoveryEligibilityService(
      new ProfileCompletionService(),
    );
    const mutualComp = new MutualCompatibilityService();
    const candidateGen = new CandidateGeneratorService(
      mockPrisma as PrismaService,
    );
    const mockSafetyPolicy = {
      getMutualBlockedUserIds: jest.fn().mockResolvedValue(new Set()),
    };
    const exclusion = new ExclusionService(
      mockPrisma as PrismaService,
      mockSafetyPolicy as any,
    );
    const featureExtractor = {
      extractFeatures: jest.fn().mockReturnValue({
        ageProximity: 0.9,
        interestOverlap: 0.8,
        sharedInterestsCount: 1,
        locationMatch: 1.0,
        intentMatch: 1.0,
        qualityScore: 0.9,
        freshnessScore: 1.0,
      }),
    };
    const rankingStrategy = new BaselineRankingStrategy(
      featureExtractor as any,
    );
    const diversity = new DiversityService();
    const pagination = new DiscoveryPaginationService();

    service = new DiscoveryService(
      mockPrisma as PrismaService,
      mockRedis as RedisService,
      eligibilityService,
      mutualComp,
      candidateGen,
      exclusion,
      rankingStrategy,
      diversity,
      pagination,
      mockStorage as StorageService,
    );
  });

  it('should return discovery candidate feed for eligible requesting user', async () => {
    const feed = await service.getDiscoveryFeed('user-requester', {
      limit: 20,
    });

    expect(feed.eligibility.eligible).toBe(true);
    expect(feed.candidates.length).toBe(1);
    expect(feed.candidates[0].displayName).toBe('Bob');
    expect(feed.candidates[0].age).toBe(29);
    expect(feed.candidates[0].photos[0].isPrimary).toBe(true);
    expect(feed.candidates[0].photos[0].thumbnailUrl).toContain(
      'https://cdn.datingapp.com/',
    );
    expect(feed.algorithmVersion).toBe('baseline-v1');
  });

  it('should return PROFILE_HIDDEN if requesting user has visibility HIDDEN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...validRequester,
      profile: {
        ...validRequester.profile,
        visibility: ProfileVisibility.HIDDEN,
      },
    });

    const feed = await service.getDiscoveryFeed('user-requester', {
      limit: 20,
    });
    expect(feed.eligibility.eligible).toBe(false);
    expect(feed.eligibility.reason).toBe('PROFILE_HIDDEN');
    expect(feed.candidates.length).toBe(0);
  });

  it('should recycle unswiped candidates when soft recent impressions would otherwise empty the deck', async () => {
    // Simulate candidate had a recent impression, but was never swiped (no userAction)
    mockPrisma.discoveryImpression.findMany.mockResolvedValue([
      { targetProfileId: 'profile-candidate' },
    ]);

    const feed = await service.getDiscoveryFeed('user-requester', {
      limit: 20,
    });

    expect(feed.eligibility.eligible).toBe(true);
    expect(feed.candidates.length).toBe(1);
    expect(feed.candidates[0].profileId).toBe('profile-candidate');
  });
});
