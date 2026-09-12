import { ActionsService } from './actions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { StorageService } from '../../media/storage/storage.interface';
import { ActionType, MatchStatus } from '../../../../shared/src/types';
import {
  UserStatus,
  ProfileStatus,
  ProfileVisibility,
  Gender,
  PhotoStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ActionsService', () => {
  let service: ActionsService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockStorage: any;
  let mockEntitlement: any;
  let mockCredit: any;

  const requestingUser = {
    id: 'user-a',
    status: UserStatus.ACTIVE,
    profile: {
      id: 'profile-a',
      userId: 'user-a',
      displayName: 'Alice',
      status: ProfileStatus.READY,
      photos: [{ status: PhotoStatus.APPROVED }],
    },
  };

  const targetProfile = {
    id: 'profile-b',
    userId: 'user-b',
    displayName: 'Bob',
    dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Explorer and coffee enthusiast.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    status: ProfileStatus.READY,
    visibility: ProfileVisibility.VISIBLE,
    user: { id: 'user-b', status: UserStatus.ACTIVE },
    photos: [
      {
        id: 'photo-b1',
        profileId: 'profile-b',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/b/thumb.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    interests: [],
    preferences: null,
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(requestingUser),
      },
      datingProfile: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'profile-a')
            return Promise.resolve({
              ...requestingUser.profile,
              user: { id: 'user-a', status: UserStatus.ACTIVE },
              visibility: ProfileVisibility.VISIBLE,
            });
          if (where.id === 'profile-b') return Promise.resolve(targetProfile);
          return Promise.resolve(null);
        }),
      },
      $transaction: jest.fn().mockImplementation((callback) => {
        return callback(mockPrisma);
      }),
      userAction: {
        upsert: jest.fn().mockResolvedValue({ id: 'action-1' }),
        findUnique: jest.fn().mockResolvedValue(null), // By default, no reciprocal like
      },
      match: {
        upsert: jest.fn().mockResolvedValue({
          id: 'match-123',
          user1Id: 'user-a',
          user2Id: 'user-b',
          status: MatchStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
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

    const mockSafetyPolicy = {
      canInteract: jest.fn().mockResolvedValue({ allowed: true }),
    };

    const mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    mockEntitlement = {
      hasEntitlement: jest.fn().mockResolvedValue(true), // Unlimited by default in test
    };

    const mockContentFilter = {
      validateOrThrow: jest.fn(),
      scanText: jest.fn().mockReturnValue({ isClean: true, violations: [] }),
    };

    const mockDiscipline = {
      recordViolation: jest.fn().mockResolvedValue({ strikeNumber: 1, actionTaken: 'WARNING' }),
      getActiveRestrictions: jest.fn().mockResolvedValue({ isMuted: false, isShadowBanned: false }),
    };

    mockCredit = {
      deductDirectNote: jest.fn().mockResolvedValue(true),
      getUserCreditDto: jest.fn().mockResolvedValue({
        coins: 0,
        directNotes: 0,
        profileBoosts: 0,
        callPassMinutes: 0,
        boostExpiresAt: null,
      }),
      deductCoins: jest.fn().mockResolvedValue(false),
    };

    const mockChatGateway = {
      server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
    };

    service = new ActionsService(
      mockPrisma as PrismaService,
      mockRedis as RedisService,
      mockSafetyPolicy as any,
      mockNotifications as any,
      mockEntitlement as any,
      mockCredit as any,
      mockStorage as StorageService,
      mockContentFilter as any,
      mockDiscipline as any,
      mockChatGateway as any,
    );
  });

  it('should record LIKE without reciprocal like and return matched: false', async () => {
    const result = await service.recordAction('user-a', {
      targetProfileId: 'profile-b',
      actionType: ActionType.LIKE,
    });

    expect(result.action).toBe(ActionType.LIKE);
    expect(result.matched).toBe(false);
    expect(result.match).toBeUndefined();
    expect(mockPrisma.userAction.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.match.upsert).not.toHaveBeenCalled();
  });

  it('should record LIKE with reciprocal like and return matched: true with canonical pair ordering', async () => {
    // Simulate Bob previously liked Alice
    mockPrisma.userAction.findUnique.mockResolvedValue({
      id: 'action-reciprocal',
      actorUserId: 'user-b',
      targetProfileId: 'profile-a',
      actionType: 'LIKE',
    });

    const result = await service.recordAction('user-a', {
      targetProfileId: 'profile-b',
      actionType: ActionType.LIKE,
    });

    expect(result.action).toBe(ActionType.LIKE);
    expect(result.matched).toBe(true);
    expect(result.match).toBeDefined();
    expect(result.match?.id).toBe('match-123');
    expect(result.match?.matchedProfile.displayName).toBe('Bob');
    expect(mockPrisma.match.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.match.upsert).toHaveBeenCalledWith({
      where: {
        user1Id_user2Id: {
          user1Id: 'user-a', // 'user-a' < 'user-b'
          user2Id: 'user-b',
        },
      },
      create: {
        user1Id: 'user-a',
        user2Id: 'user-b',
        status: MatchStatus.ACTIVE,
      },
      update: {
        status: MatchStatus.ACTIVE,
        unmatchedByUserId: null,
        unmatchedAt: null,
      },
    });
  });

  it('should record PASS and return matched: false', async () => {
    const result = await service.recordAction('user-a', {
      targetProfileId: 'profile-b',
      actionType: ActionType.PASS,
    });

    expect(result.action).toBe(ActionType.PASS);
    expect(result.matched).toBe(false);
    expect(mockPrisma.userAction.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.match.upsert).not.toHaveBeenCalled();
  });

  it('should reject action if user attempts to like self', async () => {
    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'profile-a',
        actionType: ActionType.LIKE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject action if target profile is hidden', async () => {
    mockPrisma.datingProfile.findUnique.mockResolvedValue({
      ...targetProfile,
      visibility: ProfileVisibility.HIDDEN,
    });

    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'profile-b',
        actionType: ActionType.LIKE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject action if target profile is not found', async () => {
    mockPrisma.datingProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'non-existent',
        actionType: ActionType.LIKE,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject action if rate limit is exceeded', async () => {
    mockRedis.incrementWithWindow.mockResolvedValue({ current: 150 });

    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'profile-b',
        actionType: ActionType.LIKE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should enforce daily like quota for free users', async () => {
    mockEntitlement.hasEntitlement.mockResolvedValue(false);
    mockRedis.get = jest.fn().mockResolvedValue('25'); // already used 25 likes

    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'profile-b',
        actionType: ActionType.LIKE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow pass rewind when user has REWIND_PASS entitlement', async () => {
    mockEntitlement.hasEntitlement.mockResolvedValue(true);
    mockPrisma.userAction.findFirst = jest.fn().mockResolvedValue({
      id: 'action-pass-1',
      actorUserId: 'user-a',
      targetProfileId: 'profile-b',
      actionType: ActionType.PASS,
    });
    mockPrisma.userAction.delete = jest.fn().mockResolvedValue({ id: 'action-pass-1' });

    const result = await service.undoLastPass('user-a');
    expect(result.success).toBe(true);
    expect(result.rewoundProfileId).toBe('profile-b');
  });

  it('should reject pass rewind when user lacks REWIND_PASS entitlement', async () => {
    mockEntitlement.hasEntitlement.mockResolvedValue(false);

    let thrownError: any = null;
    try {
      await service.undoLastPass('user-a');
    } catch (err: any) {
      thrownError = err;
    }
    expect(thrownError).toBeInstanceOf(ForbiddenException);
  });

  it('should reject direct notes exceeding 150 characters', async () => {
    const longNote = 'A'.repeat(151);

    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'profile-b',
        actionType: ActionType.LIKE,
        note: longNote,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should enforce 5 free direct note quota for free users', async () => {
    mockEntitlement.hasEntitlement.mockResolvedValue(false);
    mockCredit.deductDirectNote.mockResolvedValue(false);
    mockPrisma.userAction.count = jest.fn().mockResolvedValue(5); // already sent 5 notes

    await expect(
      service.recordAction('user-a', {
        targetProfileId: 'profile-b',
        actionType: ActionType.LIKE,
        note: 'Hey Bob, love your bio!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should suppress reciprocal match formation if requesting user is shadowbanned', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...requestingUser,
      shadowBannedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    mockPrisma.userAction.findUnique = jest.fn().mockResolvedValue({
      actionType: 'LIKE',
    });

    const response = await service.recordAction('user-a', {
      targetProfileId: 'profile-b',
      actionType: ActionType.LIKE,
    });

    expect(response.matched).toBe(false);
    expect(mockPrisma.match.upsert).not.toHaveBeenCalled();
  });
});
