import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PUSH_NOTIFICATION_PROVIDER } from '../providers/push-notification.provider';
import { NotificationType, DevicePlatform } from '../../../../shared/src/types';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let pushProvider: any;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: NotificationType.NEW_MATCH,
    referenceId: 'match-1',
    title: "It's a Match! 🎉",
    body: 'You matched with Priya!',
    metadata: { matchId: 'match-1' },
    isRead: false,
    readAt: null,
    idempotencyKey: 'match:match-1:user:user-1',
    createdAt: new Date('2026-08-31T12:00:00Z'),
    updatedAt: new Date('2026-08-31T12:00:00Z'),
  };

  const mockDevice = {
    id: 'dev-1',
    userId: 'user-1',
    token: 'push-token-123',
    platform: DevicePlatform.IOS,
    deviceModel: 'iPhone 15',
    isActive: true,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      deviceRegistration: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    pushProvider = {
      sendPush: jest.fn().mockResolvedValue({ sentCount: 1, failedTokens: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: PUSH_NOTIFICATION_PROVIDER,
          useValue: pushProvider,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('createNotification', () => {
    it('creates a new notification and dispatches push to active devices', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.deviceRegistration.findMany.mockResolvedValue([mockDevice]);

      const result = await service.createNotification(
        'user-1',
        {
          type: NotificationType.NEW_MATCH,
          title: "It's a Match! 🎉",
          body: 'You matched with Priya!',
          referenceId: 'match-1',
        },
        'match:match-1:user:user-1',
      );

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(pushProvider.sendPush).toHaveBeenCalledWith(
        ['push-token-123'],
        expect.objectContaining({
          title: "It's a Match! 🎉",
        }),
      );
      expect(result.id).toBe('notif-1');
      expect(result.type).toBe(NotificationType.NEW_MATCH);
    });

    it('returns existing notification without inserting on idempotency duplicate', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await service.createNotification(
        'user-1',
        {
          type: NotificationType.NEW_MATCH,
          title: "It's a Match! 🎉",
          body: 'You matched with Priya!',
        },
        'match:match-1:user:user-1',
      );

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(pushProvider.sendPush).not.toHaveBeenCalled();
      expect(result.id).toBe('notif-1');
    });

    it('does not fail notification creation if push dispatch throws an error', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.deviceRegistration.findMany.mockResolvedValue([mockDevice]);
      pushProvider.sendPush.mockRejectedValue(
        new Error('Push Gateway Offline'),
      );

      const result = await service.createNotification('user-1', {
        type: NotificationType.NEW_MATCH,
        title: "It's a Match! 🎉",
        body: 'You matched with Priya!',
      });

      expect(result.id).toBe('notif-1');
    });
  });

  describe('listNotifications', () => {
    it('returns cursor-paginated notifications with unread count', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.listNotifications('user-1', { limit: 10 });

      expect(result.notifications).toHaveLength(1);
      expect(result.unreadCount).toBe(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('markAsRead and markAllAsRead', () => {
    it('marks a single notification as read', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.isRead).toBe(true);
    });

    it('throws NotFoundException if notification does not exist', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('marks all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updatedCount).toBe(5);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.getUnreadCount('user-1');

      expect(result.unreadCount).toBe(3);
    });
  });

  describe('registerDevice and unregisterDevice', () => {
    it('registers or updates a device push token', async () => {
      prisma.deviceRegistration.upsert.mockResolvedValue(mockDevice);

      const result = await service.registerDevice('user-1', {
        token: 'push-token-123',
        platform: DevicePlatform.IOS,
        deviceModel: 'iPhone 15',
      });

      expect(result.token || result.platform).toBe(DevicePlatform.IOS);
      expect(result.isActive).toBe(true);
    });

    it('deactivates a device token upon unregistration', async () => {
      prisma.deviceRegistration.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.unregisterDevice('user-1', 'push-token-123');

      expect(result.success).toBe(true);
    });
  });
});
