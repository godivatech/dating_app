import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { ActionType, UserStatus } from '@prisma/client';
import { NotificationType } from '../../../../shared/src/types';

export interface RetentionRunResult {
  scannedUsers: number;
  notificationsSent: number;
  skippedQuietHours: boolean;
  skippedActiveRecently: number;
  skippedCapped: number;
  breakdown: {
    unrepliedMessages: number;
    pendingLikes: number;
    freshFeed: number;
    incompleteProfile: number;
  };
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Checks if current time is within Quiet Hours (10:00 PM to 10:00 AM IST).
   * Indian Standard Time is UTC + 5:30.
   */
  isQuietHours(date: Date = new Date()): boolean {
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const totalIstMinutes = (utcHours * 60 + utcMinutes + 330) % 1440;

    // Active window: 10:00 AM (600 mins) to 9:30 PM (1290 mins)
    // Outside this window is Quiet Hours
    return totalIstMinutes < 600 || totalIstMinutes > 1290;
  }

  /**
   * Enforces 24-hour frequency cap.
   * Returns true if user has received a re-engagement or system notification in the last 24h.
   */
  async hasReceivedRecentNotification(userId: string, hours = 24): Promise<boolean> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const count = await this.prisma.notification.count({
      where: {
        userId,
        createdAt: { gte: cutoff },
        OR: [
          { idempotencyKey: { startsWith: 'reengage:' } },
          { type: NotificationType.SYSTEM },
        ],
      },
    });
    return count > 0;
  }

  /**
   * Executes the priority-ranked retention campaigns across inactive users.
   */
  async runRetentionCampaigns(force = false): Promise<RetentionRunResult> {
    const result: RetentionRunResult = {
      scannedUsers: 0,
      notificationsSent: 0,
      skippedQuietHours: false,
      skippedActiveRecently: 0,
      skippedCapped: 0,
      breakdown: {
        unrepliedMessages: 0,
        pendingLikes: 0,
        freshFeed: 0,
        incompleteProfile: 0,
      },
    };

    // 1. Quiet hours check
    if (!force && this.isQuietHours()) {
      this.logger.log('[RETENTION_CRON] Skipped execution: Quiet hours currently active (10 PM - 10 AM IST).');
      result.skippedQuietHours = true;
      return result;
    }

    const now = new Date();
    const activeThreshold = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const dateKey = now.toISOString().split('T')[0]; // e.g. "2026-09-09"

    // 2. Fetch active users with registered devices who have been inactive for > 6 hours
    const candidateUsers = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        deviceRegistrations: {
          some: { isActive: true },
        },
        OR: [
          { lastLoginAt: { lt: activeThreshold } },
          { lastLoginAt: null },
        ],
      },
      include: {
        profile: {
          include: {
            photos: true,
          },
        },
      },
      take: 200, // Batch limit for safe DB load
    });

    result.scannedUsers = candidateUsers.length;
    this.logger.log(`[RETENTION_CRON] Scanning ${candidateUsers.length} inactive user candidates.`);

    for (const user of candidateUsers) {
      try {
        // Enforce 24-hour frequency cap
        const isCapped = await this.hasReceivedRecentNotification(user.id, 24);
        if (isCapped) {
          result.skippedCapped++;
          continue;
        }

        // -------------------------------------------------------------
        // Priority 1: Unreplied Conversation Nudge (12h - 72h)
        // -------------------------------------------------------------
        const unrepliedConv = await this.findUnrepliedConversation(user.id, twelveHoursAgo);
        if (unrepliedConv) {
          const senderName = unrepliedConv.senderDisplayName;
          await this.notificationsService.createNotification(
            user.id,
            {
              type: NotificationType.SYSTEM,
              referenceId: unrepliedConv.conversationId,
              title: `Don't leave ${senderName} hanging! 💬`,
              body: `${senderName} sent you a message. Reply before the spark fades!`,
              metadata: {
                screen: `/chat/${unrepliedConv.conversationId}`,
                conversationId: unrepliedConv.conversationId,
                campaign: 'UNREPLIED_MESSAGE',
              },
            },
            `reengage:unreplied:${unrepliedConv.conversationId}:${dateKey}`,
          );
          result.notificationsSent++;
          result.breakdown.unrepliedMessages++;
          continue;
        }

        // -------------------------------------------------------------
        // Priority 2: Unviewed Likes & Matches (24h - 48h)
        // -------------------------------------------------------------
        const pendingLikesCount = await this.countPendingLikes(user.id);
        if (pendingLikesCount > 0) {
          const city = user.profile?.locationCity || 'your area';
          const title =
            pendingLikesCount === 1
              ? `Someone near ${city} liked your profile! 💖`
              : `${pendingLikesCount} people near ${city} liked your profile! 💖`;

          await this.notificationsService.createNotification(
            user.id,
            {
              type: NotificationType.SYSTEM,
              referenceId: 'matches',
              title,
              body: 'Open TrueLove to see who wants to connect with you today.',
              metadata: {
                screen: '/matches',
                campaign: 'PENDING_LIKES',
              },
            },
            `reengage:likes:${user.id}:${dateKey}`,
          );
          result.notificationsSent++;
          result.breakdown.pendingLikes++;
          continue;
        }

        // -------------------------------------------------------------
        // Priority 3: Fresh Feed / Weekend Re-activation (> 48h inactive)
        // -------------------------------------------------------------
        const isInactive48h = !user.lastLoginAt || user.lastLoginAt < fortyEightHoursAgo;
        if (isInactive48h && user.profile?.status === 'READY') {
          const city = user.profile.locationCity || 'Tamil Nadu';
          await this.notificationsService.createNotification(
            user.id,
            {
              type: NotificationType.SYSTEM,
              referenceId: 'discovery',
              title: `New verified singles active near ${city}! 🔥`,
              body: 'Fresh profiles match your preferences. Discover your next match today.',
              metadata: {
                screen: '/discovery',
                campaign: 'FRESH_FEED',
              },
            },
            `reengage:feed:${user.id}:${dateKey}`,
          );
          result.notificationsSent++;
          result.breakdown.freshFeed++;
          continue;
        }

        // -------------------------------------------------------------
        // Priority 4: Incomplete Profile Nudge
        // -------------------------------------------------------------
        if (user.profile && user.profile.status !== 'READY') {
          await this.notificationsService.createNotification(
            user.id,
            {
              type: NotificationType.SYSTEM,
              referenceId: 'profile',
              title: 'Complete your profile to get matches 📸',
              body: 'Add your photos to get 4x more attention from verified singles nearby.',
              metadata: {
                screen: '/profile/edit',
                campaign: 'INCOMPLETE_PROFILE',
              },
            },
            `reengage:profile:${user.id}:${dateKey}`,
          );
          result.notificationsSent++;
          result.breakdown.incompleteProfile++;
          continue;
        }
      } catch (userErr: any) {
        this.logger.warn(`[RETENTION_USER_ERROR] Error evaluating user ${user.id}: ${userErr.message}`);
      }
    }

    this.logger.log(
      `[RETENTION_COMPLETE] Sent: ${result.notificationsSent}, Skipped Capped: ${result.skippedCapped}`,
    );
    return result;
  }

  /**
   * Helper to find the latest unreplied message conversation for a user.
   */
  private async findUnrepliedConversation(
    userId: string,
    olderThan: Date,
  ): Promise<{ conversationId: string; senderDisplayName: string } | null> {
    const participantState = await this.prisma.conversationParticipantState.findFirst({
      where: {
        userId,
        conversation: {
          lastMessageAt: { lt: olderThan },
        },
      },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { sequence: 'desc' },
              take: 1,
            },
            match: {
              include: {
                user1: { include: { profile: true } },
                user2: { include: { profile: true } },
              },
            },
          },
        },
      },
    });

    if (!participantState) return null;

    const lastMessage = participantState.conversation.messages[0];
    if (!lastMessage) return null;

    // Is the last message from the OTHER person?
    if (lastMessage.senderUserId === userId) return null;

    // Has user not read up to this sequence?
    if (participantState.lastReadSequence >= lastMessage.sequence) return null;

    const match = participantState.conversation.match;
    const partner = match.user1Id === userId ? match.user2 : match.user1;
    const senderDisplayName = partner.profile?.displayName?.split(' ')[0] || 'Your match';

    return {
      conversationId: participantState.conversationId,
      senderDisplayName,
    };
  }

  /**
   * Helper to count real unreciprocated likes received by a user.
   */
  private async countPendingLikes(userId: string): Promise<number> {
    const userProfile = await this.prisma.datingProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!userProfile) return 0;

    // Likes sent to this user's profile
    const incomingLikes = await this.prisma.userAction.findMany({
      where: {
        targetProfileId: userProfile.id,
        actionType: ActionType.LIKE,
      },
      select: { actorUserId: true },
    });

    if (incomingLikes.length === 0) return 0;

    const actorUserIds = incomingLikes.map((a) => a.actorUserId);

    // Fetch dating profile IDs for these actors to check if user swiped back
    const actorProfiles = await this.prisma.datingProfile.findMany({
      where: { userId: { in: actorUserIds } },
      select: { id: true, userId: true },
    });

    const targetProfileIdToUserId = new Map<string, string>();
    actorProfiles.forEach((p) => targetProfileIdToUserId.set(p.id, p.userId));

    const existingUserActions = await this.prisma.userAction.findMany({
      where: {
        actorUserId: userId,
        targetProfileId: { in: Array.from(targetProfileIdToUserId.keys()) },
      },
      select: { targetProfileId: true },
    });

    const alreadySwipedActorUserIds = new Set<string>();
    existingUserActions.forEach((a) => {
      const actorId = targetProfileIdToUserId.get(a.targetProfileId);
      if (actorId) alreadySwipedActorUserIds.add(actorId);
    });

    const unreciprocated = incomingLikes.filter(
      (a) => !alreadySwipedActorUserIds.has(a.actorUserId),
    );

    return unreciprocated.length;
  }
}
