import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from './retention.service';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus, NotificationType } from '@prisma/client';

describe('RetentionService', () => {
  let service: RetentionService;
  let prisma: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
      },
      notification: {
        count: jest.fn(),
      },
      conversationParticipantState: {
        findFirst: jest.fn(),
      },
      datingProfile: {
        findUnique: jest.fn(),
      },
      userAction: {
        findMany: jest.fn(),
      },
    };

    notificationsService = {
      createNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  describe('isQuietHours', () => {
    it('should allow notifications during afternoon hours (1:30 PM IST / 08:00 UTC)', () => {
      // 08:00 UTC = 13:30 IST (1:30 PM) -> Allowed
      const date = new Date('2026-09-09T08:00:00.000Z');
      expect(service.isQuietHours(date)).toBe(false);
    });

    it('should block notifications during deep night (2:00 AM IST / 20:30 UTC previous day)', () => {
      // 20:30 UTC = 02:00 IST -> Quiet Hours
      const date = new Date('2026-09-08T20:30:00.000Z');
      expect(service.isQuietHours(date)).toBe(true);
    });

    it('should allow notifications during evening peak (7:30 PM IST / 14:00 UTC)', () => {
      // 14:00 UTC = 19:30 IST (7:30 PM) -> Allowed
      const date = new Date('2026-09-09T14:00:00.000Z');
      expect(service.isQuietHours(date)).toBe(false);
    });
  });

  describe('hasReceivedRecentNotification', () => {
    it('should return true if user already received re-engagement notification in 24h', async () => {
      prisma.notification.count.mockResolvedValue(1);
      const isCapped = await service.hasReceivedRecentNotification('user-1', 24);
      expect(isCapped).toBe(true);
    });

    it('should return false if user has no recent notifications', async () => {
      prisma.notification.count.mockResolvedValue(0);
      const isCapped = await service.hasReceivedRecentNotification('user-2', 24);
      expect(isCapped).toBe(false);
    });
  });

  describe('runRetentionCampaigns', () => {
    it('should skip execution if quiet hours are active and force is false', async () => {
      jest.spyOn(service, 'isQuietHours').mockReturnValue(true);

      const result = await service.runRetentionCampaigns(false);
      expect(result.skippedQuietHours).toBe(true);
      expect(result.notificationsSent).toBe(0);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should execute if force is true even during quiet hours', async () => {
      jest.spyOn(service, 'isQuietHours').mockReturnValue(true);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.runRetentionCampaigns(true);
      expect(result.skippedQuietHours).toBe(false);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should send Priority 1 unreplied conversation reminder if found', async () => {
      jest.spyOn(service, 'isQuietHours').mockReturnValue(false);
      jest.spyOn(service, 'hasReceivedRecentNotification').mockResolvedValue(false);

      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-inactive-1',
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date('2026-09-08T00:00:00.000Z'),
          profile: {
            displayName: 'Karthik',
            locationCity: 'Chennai',
            status: 'READY',
          },
        },
      ]);

      prisma.conversationParticipantState.findFirst.mockResolvedValue({
        userId: 'user-inactive-1',
        conversationId: 'conv-123',
        lastReadSequence: 1,
        conversation: {
          lastMessageAt: new Date('2026-09-08T10:00:00.000Z'),
          messages: [
            {
              id: 'msg-99',
              senderUserId: 'user-other',
              sequence: 2,
              body: 'Hey Karthik!',
            },
          ],
          match: {
            user1Id: 'user-inactive-1',
            user2: { profile: { displayName: 'Priya Raman' } },
          },
        },
      });

      const result = await service.runRetentionCampaigns(true);

      expect(result.notificationsSent).toBe(1);
      expect(result.breakdown.unrepliedMessages).toBe(1);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        'user-inactive-1',
        expect.objectContaining({
          type: NotificationType.SYSTEM,
          title: expect.stringContaining('Priya'),
          metadata: expect.objectContaining({
            screen: '/chat/conv-123',
            campaign: 'UNREPLIED_MESSAGE',
          }),
        }),
        expect.stringContaining('reengage:unreplied:conv-123'),
      );
    });
  });
});
