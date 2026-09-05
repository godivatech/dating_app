import { Test, TestingModule } from '@nestjs/testing';
import { BlocksService } from './blocks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';

describe('BlocksService', () => {
  let service: BlocksService;
  let prisma: any;
  let storageService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      block: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    // Transaction mock
    prisma.block.upsert = jest.fn();
    prisma.match = {
      updateMany: jest.fn(),
    };

    storageService = {
      getPublicUrl: jest.fn((k) => `https://r2.example.com/${k}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        DiscoveryPaginationService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storageService },
      ],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
  });

  describe('blockUser', () => {
    it('should reject self-blocking', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.blockUser('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upsert block record and terminate active match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        profile: {
          id: 'profile-2',
          userId: 'user-2',
          displayName: 'Target User',
          dateOfBirth: new Date('1998-05-15'),
          gender: 'WOMAN',
          bio: 'Bio',
          locationCity: 'Mumbai',
          locationCountry: 'IN',
          photos: [],
          interests: [],
        },
      });

      prisma.block.upsert.mockResolvedValue({
        id: 'block-1',
        blockerUserId: 'user-1',
        blockedUserId: 'user-2',
        reason: 'Harassment',
        createdAt: new Date(),
      });

      const result = await service.blockUser('user-1', 'user-2', 'Harassment');

      expect(result.id).toBe('block-1');
      expect(result.blockedUserId).toBe('user-2');
      expect(prisma.match.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MatchStatus.UNMATCHED,
            unmatchedByUserId: 'user-1',
          }),
        }),
      );
    });
  });

  describe('unblockUser', () => {
    it('should reject self-unblock', async () => {
      await expect(service.unblockUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete block record', async () => {
      prisma.block.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.unblockUser('user-1', 'user-2');
      expect(result.success).toBe(true);
      expect(prisma.block.deleteMany).toHaveBeenCalledWith({
        where: {
          blockerUserId: 'user-1',
          blockedUserId: 'user-2',
        },
      });
    });
  });
});
