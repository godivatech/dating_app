import { Test, TestingModule } from '@nestjs/testing';
import { SafetyPolicyService } from './safety-policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserStatus,
  MatchStatus,
  ProfileVisibility,
  ProfileStatus,
} from '@prisma/client';

describe('SafetyPolicyService', () => {
  let service: SafetyPolicyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      block: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      datingProfile: {
        findUnique: jest.fn(),
      },
      conversation: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyPolicyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SafetyPolicyService>(SafetyPolicyService);
  });

  describe('getMutualBlockedUserIds', () => {
    it('should return symmetric blocked user IDs', async () => {
      prisma.block.findMany.mockResolvedValue([
        { blockerUserId: 'user-1', blockedUserId: 'user-2' },
        { blockerUserId: 'user-3', blockedUserId: 'user-1' },
      ]);

      const result = await service.getMutualBlockedUserIds('user-1');

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('user-2')).toBe(true);
      expect(result.has('user-3')).toBe(true);
      expect(result.has('user-1')).toBe(false);
    });
  });

  describe('canInteract', () => {
    it('should reject self-interaction', async () => {
      const result = await service.canInteract('user-1', 'user-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Self-interaction');
    });

    it('should reject if a block exists in either direction', async () => {
      prisma.block.findFirst.mockResolvedValue({ id: 'block-1' });

      const result = await service.canInteract('user-1', 'user-2');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked by safety policy');
    });

    it('should reject if either user is not active (suspended/banned)', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.SUSPENDED },
      ]);

      const result = await service.canInteract('user-1', 'user-2');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Target account is not active');
    });

    it('should allow interaction when both users are active and no blocks exist', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);

      const result = await service.canInteract('user-1', 'user-2');
      expect(result.allowed).toBe(true);
    });
  });

  describe('canDiscover', () => {
    it('should return false if target profile is hidden or incomplete', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);
      prisma.datingProfile.findUnique.mockResolvedValue({
        visibility: ProfileVisibility.HIDDEN,
        status: ProfileStatus.READY,
      });

      const result = await service.canDiscover('user-1', 'user-2');
      expect(result).toBe(false);
    });

    it('should return true if candidate is visible and ready and unblocked', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);
      prisma.datingProfile.findUnique.mockResolvedValue({
        visibility: ProfileVisibility.VISIBLE,
        status: ProfileStatus.READY,
      });

      const result = await service.canDiscover('user-1', 'user-2');
      expect(result).toBe(true);
    });

    it('should return false if candidate is shadowbanned', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        shadowBannedUntil: new Date(Date.now() + 100000),
      });

      const result = await service.canDiscover('user-1', 'user-2');
      expect(result).toBe(false);
    });
  });

  describe('canMessage', () => {
    it('should reject if sender has active messaging restriction (mute cooldown)', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        messagingRestrictedUntil: new Date(Date.now() + 100000),
      });

      const result = await service.canMessage('user-1', 'user-2', 'conv-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('messaging privileges are temporarily suspended');
    });

    it('should reject if underlying match is unmatched', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        match: { status: MatchStatus.UNMATCHED },
      });

      const result = await service.canMessage('user-1', 'user-2', 'conv-1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('match has ended');
    });

    it('should allow messaging when active match exists and both active', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', status: UserStatus.ACTIVE },
        { id: 'user-2', status: UserStatus.ACTIVE },
      ]);
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        match: { status: MatchStatus.ACTIVE },
      });

      const result = await service.canMessage('user-1', 'user-2', 'conv-1');
      expect(result.allowed).toBe(true);
    });
  });
});
