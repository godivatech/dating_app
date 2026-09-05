import { Test, TestingModule } from '@nestjs/testing';
import { DisciplineService } from './discipline.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrikeSeverity, UserStatus } from '@prisma/client';

describe('DisciplineService', () => {
  let service: DisciplineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      userSafetyStrike: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisciplineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DisciplineService>(DisciplineService);
  });

  describe('Progressive Strike Escalation', () => {
    it('issues WARNING on Strike 1', async () => {
      prisma.userSafetyStrike.count.mockResolvedValue(0);

      const result = await service.recordViolation(
        'user-1',
        'Abusive language in chat',
        'sample bad word',
        StrikeSeverity.LOW,
      );

      expect(result.strikeNumber).toBe(1);
      expect(result.actionTaken).toBe('WARNING');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.userSafetyStrike.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            strikeNumber: 1,
            actionTaken: 'WARNING',
          }),
        }),
      );
    });

    it('issues 24H MUTE on Strike 2', async () => {
      prisma.userSafetyStrike.count.mockResolvedValue(1);

      const result = await service.recordViolation(
        'user-1',
        'Repeated profanity',
        'evidence text',
      );

      expect(result.strikeNumber).toBe(2);
      expect(result.actionTaken).toBe('MUTE_24H');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            messagingRestrictedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('issues 7D SHADOWBAN on Strike 3', async () => {
      prisma.userSafetyStrike.count.mockResolvedValue(2);

      const result = await service.recordViolation(
        'user-1',
        'Continued harassment',
      );

      expect(result.strikeNumber).toBe(3);
      expect(result.actionTaken).toBe('SHADOWBAN_7D');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            messagingRestrictedUntil: expect.any(Date),
            shadowBannedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('PERMANENTLY BANS and revokes sessions on Strike 4', async () => {
      prisma.userSafetyStrike.count.mockResolvedValue(3);

      const result = await service.recordViolation(
        'user-1',
        'Critical abuse violation',
      );

      expect(result.strikeNumber).toBe(4);
      expect(result.actionTaken).toBe('SUSPENDED');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { status: UserStatus.BANNED },
        }),
      );
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('getActiveRestrictions', () => {
    it('accurately identifies active mute cooldown', async () => {
      prisma.user.findUnique.mockResolvedValue({
        messagingRestrictedUntil: new Date(Date.now() + 60000), // in future
        shadowBannedUntil: null,
      });

      const res = await service.getActiveRestrictions('user-1');
      expect(res.isMuted).toBe(true);
      expect(res.isShadowBanned).toBe(false);
    });

    it('returns false if restrictions expired in the past', async () => {
      prisma.user.findUnique.mockResolvedValue({
        messagingRestrictedUntil: new Date(Date.now() - 60000), // in past
        shadowBannedUntil: null,
      });

      const res = await service.getActiveRestrictions('user-1');
      expect(res.isMuted).toBe(false);
      expect(res.isShadowBanned).toBe(false);
    });
  });

  describe('getUserSafetyStatus', () => {
    it('returns GOOD standing for users with zero strikes and no restrictions', async () => {
      prisma.userSafetyStrike.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({
        status: UserStatus.ACTIVE,
        messagingRestrictedUntil: null,
        shadowBannedUntil: null,
      });

      const status = await service.getUserSafetyStatus('user-1');
      expect(status.standing).toBe('GOOD');
      expect(status.activeStrikes).toBe(0);
      expect(status.isMuted).toBe(false);
      expect(status.isShadowBanned).toBe(false);
    });

    it('returns RESTRICTED standing for muted users', async () => {
      prisma.userSafetyStrike.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue({
        status: UserStatus.ACTIVE,
        messagingRestrictedUntil: new Date(Date.now() + 86400000),
        shadowBannedUntil: null,
      });

      const status = await service.getUserSafetyStatus('user-1');
      expect(status.standing).toBe('RESTRICTED');
      expect(status.activeStrikes).toBe(1);
      expect(status.isMuted).toBe(true);
    });
  });
});
