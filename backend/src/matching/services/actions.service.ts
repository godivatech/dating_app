import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EntitlementService } from '../../billing/services/entitlement.service';
import { CreditService } from '../../billing/services/credit.service';
import { DAILY_FREE_LIKES_LIMIT } from '../../billing/services/subscription.service';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { calculateAge } from '../../profile/utils/age.util';
import { RecordActionDto } from '../dto/record-action.dto';
import {
  ActionType,
  MatchStatus,
  RecordActionResponse,
  SafeMatch,
  DiscoveryCandidate,
  SafeProfilePhoto,
  NotificationType,
} from '../../../../shared/src/types';
import {
  UserStatus,
  ProfileStatus,
  ProfileVisibility,
  PhotoStatus,
  EntitlementKey,
} from '@prisma/client';

import { ContentFilterService } from '../../safety/services/content-filter.service';
import { DisciplineService } from '../../safety/services/discipline.service';
import { ChatGateway } from '../../chat/gateways/chat.gateway';

export const ACTION_RATE_WINDOW_SECONDS = 60;
export const MAX_ACTIONS_PER_WINDOW = 100;

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly safetyPolicyService: SafetyPolicyService,
    private readonly notificationsService: NotificationsService,
    private readonly entitlementService: EntitlementService,
    private readonly creditService: CreditService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    private readonly contentFilterService: ContentFilterService,
    private readonly disciplineService: DisciplineService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Records an explicit dating action (LIKE or PASS) and atomically establishes a Match
   * if a reciprocal active LIKE exists.
   */
  async recordAction(
    userId: string,
    dto: RecordActionDto,
  ): Promise<RecordActionResponse> {
    // 1. Redis Anti-Abuse Rate Limiting
    const rateKey = `matching:actions-rate:${userId}`;
    const rate = await this.redisService.incrementWithWindow(
      rateKey,
      ACTION_RATE_WINDOW_SECONDS,
    );
    if (rate.current > MAX_ACTIONS_PER_WINDOW) {
      throw new BadRequestException(
        'Action rate limit exceeded. Please slow down.',
      );
    }

    // 2. Validate Requesting User
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            preferences: true,
            photos: {
              where: { status: PhotoStatus.APPROVED },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!requestingUser || requestingUser.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Your account is not active.');
    }

    if (
      !requestingUser.profile ||
      requestingUser.profile.status !== ProfileStatus.READY
    ) {
      throw new BadRequestException(
        'Your profile must be 100% complete before you can like or pass.',
      );
    }

    const requesterProfile = requestingUser.profile;
    const isShadowBanned =
      !!requestingUser.shadowBannedUntil &&
      new Date(requestingUser.shadowBannedUntil) > new Date();

    // 3. Revalidate Target Profile
    const targetProfile = await this.prisma.datingProfile.findUnique({
      where: { id: dto.targetProfileId },
      include: {
        user: true,
        preferences: true,
        interests: {
          include: { interest: true },
        },
        photos: {
          where: { status: PhotoStatus.APPROVED },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!targetProfile) {
      throw new NotFoundException('Target profile not found.');
    }

    if (
      targetProfile.userId === userId ||
      targetProfile.id === requesterProfile.id
    ) {
      throw new BadRequestException(
        'You cannot like or pass your own profile.',
      );
    }

    const safetyCheck = await this.safetyPolicyService.canInteract(
      userId,
      targetProfile.userId,
    );
    if (!safetyCheck.allowed) {
      throw new BadRequestException(
        safetyCheck.reason || 'Action blocked by safety policy.',
      );
    }

    if (
      targetProfile.status !== ProfileStatus.READY ||
      targetProfile.visibility !== ProfileVisibility.VISIBLE ||
      targetProfile.photos.length === 0
    ) {
      throw new BadRequestException(
        'This profile is no longer available for interaction.',
      );
    }

    // 4. Entitlement & Daily Like Quota Check for LIKE actions
    if (dto.actionType === ActionType.LIKE) {
      const hasUnlimitedLikes = await this.entitlementService.hasEntitlement(
        userId,
        EntitlementKey.UNLIMITED_LIKES,
      );

      if (!hasUnlimitedLikes) {
        const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
        const todayKey = `billing:daily-likes:${userId}:${istDate}`;
        if (typeof this.redisService.get === 'function') {
          const currentLikesStr = await this.redisService.get(todayKey);
          const currentLikes = currentLikesStr ? parseInt(currentLikesStr, 10) : 0;

          if (currentLikes >= DAILY_FREE_LIKES_LIMIT) {
            throw new BadRequestException(
              `Daily free like limit reached (${DAILY_FREE_LIKES_LIMIT}/day). Upgrade to Truelove Plus for unlimited likes.`,
            );
          }

          if (typeof this.redisService.set === 'function') {
            await this.redisService.set(todayKey, (currentLikes + 1).toString(), 86400);
          }
        }
      }
    }

    // 4. Direct Note Quota & Safety Check (Max 150 chars)
    const cleanNote = dto.note?.trim();
    if (cleanNote && dto.actionType === ActionType.LIKE) {
      if (cleanNote.length > 150) {
        throw new BadRequestException('Direct notes cannot exceed 150 characters.');
      }

      // Check user messaging restrictions (Mute cooldown)
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { messagingRestrictedUntil: true },
      });
      if (
        actor?.messagingRestrictedUntil &&
        actor.messagingRestrictedUntil > new Date()
      ) {
        throw new BadRequestException(
          'Your direct note privileges are temporarily suspended due to community safety violations.',
        );
      }

      // Content Moderation check on Direct Note (Fails fast before touching credit balances)
      try {
        this.contentFilterService.validateOrThrow(cleanNote, 'DIRECT_NOTE');
      } catch (filterError: any) {
        await this.disciplineService.recordViolation(
          userId,
          filterError.message || 'Prohibited content in direct note',
          cleanNote,
        );
        throw filterError;
      }

      // Tier 1: Truelove Gold members hold UNLIMITED_DIRECT_NOTES
      const hasUnlimitedNotes = await this.entitlementService.hasEntitlement(
        userId,
        EntitlementKey.UNLIMITED_DIRECT_NOTES,
      );

      let allowedToSendNote = false;

      if (hasUnlimitedNotes) {
        allowedToSendNote = true;
      } else {
        // Tier 2: Truelove Plus members get 5 Direct Notes daily
        const hasPlus = await this.entitlementService.hasEntitlement(
          userId,
          EntitlementKey.REWIND_PASS,
        );

        if (hasPlus) {
          const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
          const dailyNotesKey = `billing:daily-notes:${userId}:${istDate}`;
          if (typeof this.redisService.get === 'function') {
            const currentDailyNotesStr = await this.redisService.get(dailyNotesKey);
            const currentDailyNotes = currentDailyNotesStr ? parseInt(currentDailyNotesStr, 10) : 0;

            if (currentDailyNotes < 5) {
              if (typeof this.redisService.set === 'function') {
                await this.redisService.set(dailyNotesKey, (currentDailyNotes + 1).toString(), 86400);
              }
              allowedToSendNote = true;
            }
          }
        }

        // Tier 3: Consumable Purchased Direct Note Credits
        if (!allowedToSendNote) {
          const deducted = await this.creditService.deductDirectNote(userId);
          if (deducted) {
            allowedToSendNote = true;
          }
        }

        // Tier 4: Lifetime Free Trial (5 free notes total for new members)
        if (!allowedToSendNote) {
          const notesSentCount = await this.prisma.userAction.count({
            where: {
              actorUserId: userId,
              note: { not: null },
            },
          });

          const FREE_DIRECT_NOTES_LIMIT = 5;
          if (notesSentCount < FREE_DIRECT_NOTES_LIMIT) {
            allowedToSendNote = true;
          }
        }

        // Tier 5: All quotas exhausted -> Trigger paywall
        if (!allowedToSendNote) {
          throw new BadRequestException(
            'You have used all free direct notes. Upgrade to Truelove Gold or buy a Note Pack to send more direct messages.',
          );
        }
      }
    }

    // 5. Transactional Action Persistence and Atomic Match Formation
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert UserAction for requester -> target
      await tx.userAction.upsert({
        where: {
          actorUserId_targetProfileId: {
            actorUserId: userId,
            targetProfileId: dto.targetProfileId,
          },
        },
        create: {
          actorUserId: userId,
          targetProfileId: dto.targetProfileId,
          actionType: dto.actionType as any,
          note: cleanNote || null,
          algorithmVersion: dto.algorithmVersion || 'baseline-v1',
        },
        update: {
          actionType: dto.actionType as any,
          note: cleanNote || null,
          algorithmVersion: dto.algorithmVersion || 'baseline-v1',
        },
      });

      this.logger.log(
        `[USER_ACTION_RECORDED] User ${userId} recorded ${dto.actionType} on profile ${dto.targetProfileId} (Note: ${!!cleanNote})`,
      );

      // If action is LIKE, check for reciprocal LIKE from target (suppressed if actor is shadowbanned)
      if (dto.actionType === ActionType.LIKE && !isShadowBanned) {
        const reciprocalAction = await tx.userAction.findUnique({
          where: {
            actorUserId_targetProfileId: {
              actorUserId: targetProfile.userId,
              targetProfileId: requesterProfile.id,
            },
          },
        });

        if (reciprocalAction && reciprocalAction.actionType === 'LIKE') {
          // Reciprocal LIKE confirmed! Establish canonical pair uniqueness
          const [user1Id, user2Id] = [userId, targetProfile.userId].sort();

          const matchRecord = await tx.match.upsert({
            where: {
              user1Id_user2Id: {
                user1Id,
                user2Id,
              },
            },
            create: {
              user1Id,
              user2Id,
              status: MatchStatus.ACTIVE,
            },
            update: {
              status: MatchStatus.ACTIVE,
              unmatchedByUserId: null,
              unmatchedAt: null,
            },
          });

          this.logger.log(
            `[MATCH_CREATED] New match ${matchRecord.id} formed between ${user1Id} and ${user2Id}`,
          );

          const safeMatchedProfile = this.mapToSafeCandidate(targetProfile);

          const safeMatch: SafeMatch = {
            id: matchRecord.id,
            matchedProfile: safeMatchedProfile,
            matchedAt: (matchRecord.createdAt
              ? new Date(matchRecord.createdAt)
              : new Date()
            ).toISOString(),
            status: MatchStatus.ACTIVE,
          };

          return {
            action: ActionType.LIKE,
            matched: true,
            match: safeMatch,
          };
        }
      }

      // No match formed (either action is PASS or waiting for reciprocal LIKE)
      return {
        action: dto.actionType,
        matched: false,
      };
    });

    // 8. Decoupled Post-Transaction Notification Dispatch (Safe event boundary)
    if (result.matched && result.match) {
      const actorId = userId;
      const targetUserId = targetProfile.userId;
      const matchId = result.match.id;

      try {
        const actorProfile = await this.prisma.datingProfile.findUnique({
          where: { userId: actorId },
          select: { displayName: true },
        });
        const targetDisplayName = targetProfile.displayName || 'Someone';
        const actorDisplayName = actorProfile?.displayName || 'Someone';

        await Promise.all([
          this.notificationsService.createNotification(
            actorId,
            {
              type: NotificationType.NEW_MATCH,
              referenceId: matchId,
              title: "It's a Match! 🎉",
              body: `You matched with ${targetDisplayName}!`,
              metadata: { matchId, matchedUserId: targetUserId },
            },
            `match:${matchId}:user:${actorId}`,
          ),
          this.notificationsService.createNotification(
            targetUserId,
            {
              type: NotificationType.NEW_MATCH,
              referenceId: matchId,
              title: "It's a Match! 🎉",
              body: `You matched with ${actorDisplayName}!`,
              metadata: { matchId, matchedUserId: actorId },
            },
            `match:${matchId}:user:${targetUserId}`,
          ),
        ]);

        // Real-time WebSocket emission for immediate celebratory popup on both active client devices
        try {
          const actorPhotoKey = requesterProfile.photos?.[0]?.thumbnailKey || requesterProfile.photos?.[0]?.objectKey;
          const targetPhotoKey = targetProfile.photos?.[0]?.thumbnailKey || targetProfile.photos?.[0]?.objectKey;
          const actorPhotoUrl = actorPhotoKey ? this.storageService.getPublicUrl(actorPhotoKey) : null;
          const targetPhotoUrl = targetPhotoKey ? this.storageService.getPublicUrl(targetPhotoKey) : null;

          this.chatGateway?.server?.to(`user:${actorId}`)?.emit('match.formed', {
            match: result.match,
            matchedUser: {
              displayName: targetDisplayName,
              profileId: targetProfile.id,
              photoUrl: targetPhotoUrl,
            },
          });

          this.chatGateway?.server?.to(`user:${targetUserId}`)?.emit('match.formed', {
            match: result.match,
            matchedUser: {
              displayName: actorDisplayName,
              profileId: requesterProfile.id,
              photoUrl: actorPhotoUrl,
            },
          });
        } catch (wsErr: any) {
          this.logger.warn(`[MATCH_WS_FAILED] Failed to emit match.formed: ${wsErr.message}`);
        }
      } catch (notifErr: any) {
        this.logger.warn(
          `[NOTIF_MATCH_FAILED] Failed to dispatch match notification: ${notifErr.message}`,
        );
      }
    } else if (
      !result.matched &&
      dto.actionType === ActionType.LIKE &&
      !isShadowBanned
    ) {
      try {
        const hasSeeLikes = await this.entitlementService.hasEntitlement(
          targetProfile.userId,
          EntitlementKey.SEE_LIKES,
        );

        const actorName = requesterProfile.displayName || 'Someone';

        if (cleanNote) {
          await this.notificationsService.createNotification(
            targetProfile.userId,
            {
              type: NotificationType.SYSTEM,
              title: `New Note from ${actorName} 💌`,
              body: `"${cleanNote.slice(0, 80)}${cleanNote.length > 80 ? '...' : ''}"`,
              metadata: {
                type: 'DIRECT_NOTE',
                actorProfileId: requesterProfile.id,
                actorDisplayName: actorName,
                note: cleanNote,
              },
            },
            `direct_note:${userId}:${targetProfile.id}`,
          );
        } else {
          await this.notificationsService.createNotification(
            targetProfile.userId,
            {
              type: NotificationType.SYSTEM,
              title: hasSeeLikes
                ? `${actorName} liked your profile! ✨`
                : 'Someone liked your profile! ✨',
              body: hasSeeLikes
                ? `Check out ${actorName}'s profile in your likes.`
                : 'Open Truelove to see your new admirer.',
              metadata: {
                type: 'LIKE_RECEIVED',
                actorProfileId: requesterProfile.id,
                actorDisplayName: hasSeeLikes ? actorName : undefined,
              },
            },
            `like:${userId}:${targetProfile.id}`,
          );
        }

        // Real-time WebSocket event to update badge & notify recipient immediately if online
        try {
          this.chatGateway?.server?.to(`user:${targetProfile.userId}`)?.emit('like.received', {
            hasNote: !!cleanNote,
            note: cleanNote || undefined,
            actorDisplayName: hasSeeLikes || !!cleanNote ? actorName : 'Someone',
            actorProfileId: requesterProfile.id,
          });
        } catch (wsErr: any) {
          this.logger.warn(`[LIKE_WS_FAILED] Failed to emit like.received: ${wsErr.message}`);
        }
      } catch (err: any) {
        this.logger.warn(`Could not dispatch direct note/like notification: ${err.message}`);
      }
    }

    return result;
  }

  private mapToSafeCandidate(candidate: any): DiscoveryCandidate {
    const age = calculateAge(candidate.dateOfBirth);
    const photos: SafeProfilePhoto[] = (candidate.photos || []).map(
      (photo: any) => {
        const isApproved = photo.status === PhotoStatus.APPROVED;
        const fallbackUrl =
          isApproved && photo.objectKey && photo.objectKey !== 'pending'
            ? this.storageService.getPublicUrl(photo.objectKey)
            : null;

        return {
          id: photo.id,
          profileId: photo.profileId,
          status: photo.status,
          position: photo.position,
          isPrimary:
            photo.position === 0 && isApproved,
          thumbnailUrl:
            isApproved && photo.thumbnailKey
              ? this.storageService.getPublicUrl(photo.thumbnailKey)
              : fallbackUrl,
          mediumUrl:
            isApproved && photo.mediumKey
              ? this.storageService.getPublicUrl(photo.mediumKey)
              : fallbackUrl,
          largeUrl:
            isApproved && photo.largeKey
              ? this.storageService.getPublicUrl(photo.largeKey)
              : fallbackUrl,
          width: photo.width,
          height: photo.height,
          createdAt: (photo.createdAt
            ? new Date(photo.createdAt)
            : new Date()
          ).toISOString(),
          updatedAt: (photo.updatedAt
            ? new Date(photo.updatedAt)
            : new Date()
          ).toISOString(),
        };
      },
    );

    const interests = (candidate.interests || []).map((pi: any) => ({
      id: pi.interest?.id || pi.interestId,
      name: pi.interest?.name || 'Interest',
      category: pi.interest?.category || 'General',
      status: pi.interest?.status || 'ACTIVE',
    }));

    return {
      profileId: candidate.id,
      userId: candidate.userId,
      displayName: candidate.displayName,
      age,
      gender: candidate.gender,
      bio: candidate.bio,
      locationCity: candidate.locationCity,
      locationRegion: candidate.locationRegion,
      locationCountry: candidate.locationCountry,
      relationshipIntent: candidate.preferences?.relationshipIntent || null,
      interests,
      photos,
      algorithmVersion: 'baseline-v1',
    };
  }

  /**
   * Undoes the user's most recent PASS action in discovery.
   * Server-authoritatively requires the REWIND_PASS entitlement.
   */
  async undoLastPass(
    userId: string,
  ): Promise<{ success: boolean; rewoundProfileId: string; message: string }> {
    const hasRewind = await this.entitlementService.hasEntitlement(
      userId,
      EntitlementKey.REWIND_PASS,
    );

    if (!hasRewind) {
      throw new ForbiddenException(
        'Rewinding passes requires the Rewind Pass entitlement or Spark Plus.',
      );
    }

    const lastPass = await this.prisma.userAction.findFirst({
      where: {
        actorUserId: userId,
        actionType: ActionType.PASS,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastPass) {
      throw new NotFoundException('No recent pass action found to rewind.');
    }

    await this.prisma.userAction.delete({
      where: { id: lastPass.id },
    });

    this.logger.log(
      `[PASS_REWOUND] User ${userId} rewound pass on profile ${lastPass.targetProfileId}`,
    );

    return {
      success: true,
      rewoundProfileId: lastPass.targetProfileId,
      message: 'Pass successfully rewound. Profile restored to discovery.',
    };
  }
}
