import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EntitlementService } from '../../billing/services/entitlement.service';
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
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    private readonly contentFilterService: ContentFilterService,
    private readonly disciplineService: DisciplineService,
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
        const todayKey = `billing:daily-likes:${userId}:${new Date().toISOString().slice(0, 10)}`;
        if (typeof this.redisService.get === 'function') {
          const currentLikesStr = await this.redisService.get(todayKey);
          const currentLikes = currentLikesStr ? parseInt(currentLikesStr, 10) : 0;

          if (currentLikes >= DAILY_FREE_LIKES_LIMIT) {
            throw new BadRequestException(
              `Daily free like limit reached (${DAILY_FREE_LIKES_LIMIT}/day). Upgrade to Spark Plus for unlimited likes.`,
            );
          }

          if (typeof this.redisService.set === 'function') {
            await this.redisService.set(todayKey, (currentLikes + 1).toString(), 86400);
          }
        }
      }
    }

    // 4. Direct Note Quota & Safety Check (Max 150 chars, 5 free notes for free tier)
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

      // Content Moderation check on Direct Note
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

      const hasUnlimitedNotes = await this.entitlementService.hasEntitlement(
        userId,
        EntitlementKey.UNLIMITED_DIRECT_NOTES,
      );

      if (!hasUnlimitedNotes) {
        const notesSentCount = await this.prisma.userAction.count({
          where: {
            actorUserId: userId,
            note: { not: null },
          },
        });

        const FREE_DIRECT_NOTES_LIMIT = 5;
        if (notesSentCount >= FREE_DIRECT_NOTES_LIMIT) {
          throw new BadRequestException(
            `You have used all ${FREE_DIRECT_NOTES_LIMIT} free direct notes. Upgrade to Spark Gold or buy a Note Pack to send more direct messages.`,
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
      } catch (notifErr: any) {
        this.logger.warn(
          `[NOTIF_MATCH_FAILED] Failed to dispatch match notification: ${notifErr.message}`,
        );
      }
    } else if (
      !result.matched &&
      dto.actionType === ActionType.LIKE &&
      cleanNote &&
      !isShadowBanned
    ) {
      try {
        await this.notificationsService.createNotification(
          targetProfile.userId,
          {
            type: NotificationType.SYSTEM,
            title: `New Note from ${requesterProfile.displayName} 💌`,
            body: `"${cleanNote.slice(0, 80)}${cleanNote.length > 80 ? '...' : ''}"`,
            metadata: {
              type: 'DIRECT_NOTE',
              actorProfileId: requesterProfile.id,
              actorDisplayName: requesterProfile.displayName,
              note: cleanNote,
            },
          },
          `direct_note:${userId}:${targetProfile.id}`,
        );
      } catch (err: any) {
        this.logger.warn(`Could not dispatch direct note notification: ${err.message}`);
      }
    }

    return result;
  }

  private mapToSafeCandidate(candidate: any): DiscoveryCandidate {
    const age = calculateAge(candidate.dateOfBirth);
    const photos: SafeProfilePhoto[] = (candidate.photos || []).map(
      (photo: any) => ({
        id: photo.id,
        profileId: photo.profileId,
        status: photo.status,
        position: photo.position,
        isPrimary:
          photo.position === 0 && photo.status === PhotoStatus.APPROVED,
        thumbnailUrl: photo.thumbnailKey
          ? this.storageService.getPublicUrl(photo.thumbnailKey)
          : null,
        mediumUrl: photo.mediumKey
          ? this.storageService.getPublicUrl(photo.mediumKey)
          : null,
        largeUrl: photo.largeKey
          ? this.storageService.getPublicUrl(photo.largeKey)
          : null,
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
      }),
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
