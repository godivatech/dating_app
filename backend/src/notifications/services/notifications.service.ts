import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PUSH_NOTIFICATION_PROVIDER,
  type PushNotificationProvider,
} from '../providers/push-notification.provider';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationsQueryDto } from '../dto/notifications-query.dto';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import {
  SafeNotification,
  NotificationsListResponse,
  UnreadCountResponse,
  DeviceRegistrationResponse,
  NotificationType,
  DevicePlatform,
} from '../../../../shared/src/types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: PushNotificationProvider,
  ) {}

  private mapToSafeNotification(notification: any): SafeNotification {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type as NotificationType,
      referenceId: notification.referenceId || undefined,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata || undefined,
      isRead: notification.isRead,
      readAt: notification.readAt
        ? new Date(notification.readAt).toISOString()
        : undefined,
      createdAt: new Date(notification.createdAt).toISOString(),
    };
  }

  /**
   * Idempotently creates and stores a user notification, then dispatches push notifications.
   */
  async createNotification(
    userId: string,
    dto: CreateNotificationDto,
    idempotencyKey?: string,
  ): Promise<SafeNotification> {
    // 1. Check idempotency key if provided
    if (idempotencyKey) {
      const existing = await this.prisma.notification.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        this.logger.debug(
          `[NOTIFICATION_DEDUPED] Notification for key ${idempotencyKey} already exists.`,
        );
        return this.mapToSafeNotification(existing);
      }
    }

    // 2. Persist notification in database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        referenceId: dto.referenceId || null,
        title: dto.title,
        body: dto.body,
        metadata: dto.metadata || undefined,
        idempotencyKey: idempotencyKey || null,
      },
    });

    this.logger.log(
      `[NOTIFICATION_CREATED] User ${userId} received notification ${notification.id} (${dto.type})`,
    );

    // 3. Dispatch Push Notification (Safe Post-Persistence Boundary)
    try {
      const devices = await this.prisma.deviceRegistration.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (devices.length > 0) {
        const tokens = devices.map((d) => d.token);

        // Intelligent channel and priority routing (Zomato/Swiggy pattern)
        let channelId = 'default';
        let priority: 'high' | 'normal' = 'high';
        if (
          dto.type === NotificationType.NEW_MATCH ||
          (dto.type as any) === 'LIKE_RECEIVED'
        ) {
          channelId = 'matches';
          priority = 'high';
        } else if (dto.type === NotificationType.NEW_MESSAGE) {
          channelId = 'messages';
          priority = 'high';
        } else if (dto.type === NotificationType.SAFETY_UPDATE) {
          channelId = 'default';
          priority = 'high';
        } else if (dto.type === NotificationType.SYSTEM) {
          channelId = 'default';
          priority = 'normal';
        }

        // Calculate current unread count for real-time mobile app badge synchronization
        const unreadCount = await this.prisma.notification.count({
          where: { userId, isRead: false },
        });

        const pushResult = await this.pushProvider.sendPush(tokens, {
          title: dto.title,
          body: dto.body,
          sound: 'default',
          priority,
          channelId,
          badge: unreadCount,
          data: {
            notificationId: notification.id,
            type: dto.type,
            referenceId: dto.referenceId,
            ...(dto.metadata || {}),
          },
        });

        // Enterprise Token Hygiene: prune deactivated or uninstalled device tokens
        if (pushResult && pushResult.failedTokens && pushResult.failedTokens.length > 0) {
          await this.prisma.deviceRegistration.updateMany({
            where: { token: { in: pushResult.failedTokens } },
            data: { isActive: false },
          });
          this.logger.log(
            `[TOKEN_HYGIENE] Deactivated ${pushResult.failedTokens.length} dead token(s) for user ${userId}`,
          );
        }
      }
    } catch (pushErr: any) {
      // Push failure must NEVER compromise notification persistence or core caller flows
      this.logger.warn(
        `[PUSH_FAILED] Failed to dispatch push for user ${userId}: ${pushErr.message}`,
      );
    }

    return this.mapToSafeNotification(notification);
  }

  /**
   * Lists notifications for a user with cursor pagination and calculates unread counts.
   */
  async listNotifications(
    userId: string,
    query: NotificationsQueryDto,
  ): Promise<NotificationsListResponse> {
    const limit = query.limit || 20;

    let cursorDate: Date | undefined;
    if (query.cursor) {
      const cursorRecord = await this.prisma.notification.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true },
      });
      if (cursorRecord) {
        cursorDate = cursorRecord.createdAt;
      }
    }

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    const hasMore = items.length > limit;
    const records = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && records.length > 0 ? records[records.length - 1].id : null;

    return {
      notifications: records.map((n) => this.mapToSafeNotification(n)),
      unreadCount,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<SafeNotification> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    if (existing.isRead) {
      return this.mapToSafeNotification(existing);
    }

    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.mapToSafeNotification(updated);
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Returns current unread count for badge indicators.
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Registers or updates a device push token for a user.
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceRegistrationResponse> {
    const device = await this.prisma.deviceRegistration.upsert({
      where: {
        userId_token: {
          userId,
          token: dto.token,
        },
      },
      update: {
        platform: dto.platform,
        deviceModel: dto.deviceModel || null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceModel: dto.deviceModel || null,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    this.logger.log(
      `[DEVICE_REGISTERED] User ${userId} registered ${dto.platform} device (${device.id})`,
    );

    return {
      id: device.id,
      userId: device.userId,
      platform: device.platform as DevicePlatform,
      deviceModel: device.deviceModel || undefined,
      isActive: device.isActive,
      createdAt: device.createdAt.toISOString(),
    };
  }

  /**
   * Deactivates a device push token upon logout.
   */
  async unregisterDevice(
    userId: string,
    token: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.deviceRegistration.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });

    return { success: true };
  }
}
