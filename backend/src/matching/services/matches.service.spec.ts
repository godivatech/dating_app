import { MatchesService } from './matches.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { StorageService } from '../../media/storage/storage.interface';
import { MatchStatus, Gender, PhotoStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('MatchesService', () => {
  let service: MatchesService;
  let mockPrisma: any;
  let paginationService: DiscoveryPaginationService;
  let mockStorage: any;

  const userA = {
    id: 'user-a',
    profile: {
      id: 'prof-a',
      displayName: 'Alice',
      dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
      gender: Gender.WOMAN,
      photos: [
        {
          id: 'pa',
          status: PhotoStatus.APPROVED,
          position: 0,
          thumbnailKey: 'a.webp',
        },
      ],
      interests: [],
    },
  };

  const userB = {
    id: 'user-b',
    profile: {
      id: 'prof-b',
      displayName: 'Bob',
      dateOfBirth: new Date('1998-01-01T00:00:00.000Z'),
      gender: Gender.MAN,
      photos: [
        {
          id: 'pb',
          status: PhotoStatus.APPROVED,
          position: 0,
          thumbnailKey: 'b.webp',
        },
      ],
      interests: [],
    },
  };

  const matchRecord = {
    id: 'match-1',
    user1Id: 'user-a',
    user2Id: 'user-b',
    user1: userA,
    user2: userB,
    status: MatchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      match: {
        findMany: jest.fn().mockResolvedValue([matchRecord]),
        findUnique: jest.fn().mockResolvedValue(matchRecord),
        update: jest.fn().mockResolvedValue({
          ...matchRecord,
          status: MatchStatus.UNMATCHED,
        }),
      },
    };

    paginationService = new DiscoveryPaginationService();
    mockStorage = {
      getPublicUrl: jest.fn().mockImplementation((k) => `https://cdn/${k}`),
    };

    const mockEntitlement = {
      hasEntitlement: jest.fn().mockResolvedValue(false),
    };

    mockPrisma.datingProfile = {
      findUnique: jest.fn().mockResolvedValue(userA.profile),
    };
    mockPrisma.userAction = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'action-1',
          actorUserId: 'user-b',
          createdAt: new Date(),
          actorUser: userB,
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    };

    service = new MatchesService(
      mockPrisma as PrismaService,
      paginationService,
      mockEntitlement as any,
      mockStorage as StorageService,
    );
  });

  it('should list active matches and map the opposite participant profile', async () => {
    const res = await service.getMatches('user-a', { limit: 20 });

    expect(res.matches.length).toBe(1);
    expect(res.matches[0].id).toBe('match-1');
    expect(res.matches[0].matchedProfile.displayName).toBe('Bob');
    expect(res.matches[0].status).toBe(MatchStatus.ACTIVE);
  });

  it('should return match detail for participant', async () => {
    const res = await service.getMatchDetail('user-a', 'match-1');

    expect(res.id).toBe('match-1');
    expect(res.matchedProfile.displayName).toBe('Bob');
  });

  it('should throw NotFoundException if requesting user is not a participant', async () => {
    await expect(
      service.getMatchDetail('unauthorized-user', 'match-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should unmatch an active match successfully', async () => {
    const res = await service.unmatch('user-a', 'match-1');

    expect(res.success).toBe(true);
    expect(mockPrisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        status: MatchStatus.UNMATCHED,
        unmatchedByUserId: 'user-a',
      }),
    });
  });

  it('should return blurred incoming likes for free users without SEE_LIKES', async () => {
    (service as any).entitlementService.hasEntitlement.mockResolvedValue(false);

    const res = await service.getIncomingLikes('user-a', { limit: 20 });
    expect(res.totalCount).toBe(1);
    expect(res.unlocked).toBe(false);
    expect((res.likes[0].candidate as any).blurred).toBe(true);
    expect(res.likes[0].candidate.displayName).toBe('Someone new');
  });

  it('should return unmasked incoming likes for users with SEE_LIKES', async () => {
    (service as any).entitlementService.hasEntitlement.mockResolvedValue(true);

    const res = await service.getIncomingLikes('user-a', { limit: 20 });
    expect(res.totalCount).toBe(1);
    expect(res.unlocked).toBe(true);
    expect((res.likes[0].candidate as any).blurred).toBeUndefined();
    expect(res.likes[0].candidate.displayName).toBe('Bob');
  });

  it('should query incoming likes with shadowban exclusion filter', async () => {
    await service.getIncomingLikes('user-a', { limit: 20 });
    expect(mockPrisma.userAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorUser: expect.objectContaining({
            status: 'ACTIVE',
            OR: [
              { shadowBannedUntil: null },
              { shadowBannedUntil: { lte: expect.any(Date) } },
            ],
          }),
        }),
      }),
    );
  });

  it('should retrieve incoming notes with shadowban exclusion filter', async () => {
    mockPrisma.userAction.findMany.mockImplementation(({ where }: any) => {
      if (where?.note) {
        return Promise.resolve([
          {
            id: 'action-note-1',
            actorUserId: 'user-b',
            note: 'Loved your travel photos!',
            createdAt: new Date(),
            actorUser: userB,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await service.getIncomingNotes('user-a');
    expect(res.totalCount).toBe(1);
    expect(res.notes[0].note).toBe('Loved your travel photos!');
    expect(res.notes[0].senderProfile.displayName).toBe('Bob');
  });
});
