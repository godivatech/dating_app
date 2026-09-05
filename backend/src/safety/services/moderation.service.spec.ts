import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { NotFoundException } from '@nestjs/common';
import { ModerationActionType } from '../../../../shared/src/types';
import { UserStatus, ProfileVisibility } from '@prisma/client';

describe('ModerationService', () => {
  let service: ModerationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        updateMany: jest.fn(),
      },
      datingProfile: {
        update: jest.fn(),
      },
      profilePhoto: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
      report: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
      moderationAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        DiscoveryPaginationService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  describe('applyModeratorAction', () => {
    it('should reject if target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.applyModeratorAction('mod-1', {
          targetUserId: 'user-unknown',
          actionType: ModerationActionType.SUSPEND_ACCOUNT,
          reason: 'Policy violation',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should suspend account, revoke sessions, update report and create audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        profile: { id: 'profile-2' },
      });
      prisma.moderationAuditLog.create.mockResolvedValue({
        id: 'log-1',
        moderatorUserId: 'mod-1',
        targetUserId: 'user-2',
        actionType: ModerationActionType.SUSPEND_ACCOUNT,
        reason: 'Severe harassment',
        reportId: 'report-1',
        createdAt: new Date(),
      });

      const result = await service.applyModeratorAction('mod-1', {
        targetUserId: 'user-2',
        actionType: ModerationActionType.SUSPEND_ACCOUNT,
        reason: 'Severe harassment',
        reportId: 'report-1',
      });

      expect(result.id).toBe('log-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { status: UserStatus.SUSPENDED },
      });
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-2', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({
            reviewedByUserId: 'mod-1',
            resolutionNotes: 'Severe harassment',
          }),
        }),
      );
    });

    it('should hide profile on HIDE_PROFILE action', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        profile: { id: 'profile-2' },
      });
      prisma.moderationAuditLog.create.mockResolvedValue({
        id: 'log-2',
        moderatorUserId: 'mod-1',
        targetUserId: 'user-2',
        actionType: ModerationActionType.HIDE_PROFILE,
        reason: 'Inappropriate bio',
        createdAt: new Date(),
      });

      const result = await service.applyModeratorAction('mod-1', {
        targetUserId: 'user-2',
        actionType: ModerationActionType.HIDE_PROFILE,
        reason: 'Inappropriate bio',
      });

      expect(result.id).toBe('log-2');
      expect(prisma.datingProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-2' },
        data: { visibility: ProfileVisibility.HIDDEN },
      });
    });
  });
});
