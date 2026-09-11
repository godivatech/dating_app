import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AgoraTokenService } from './agora-token.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { InitiateCallDto, AcceptCallDto, RejectCallDto, EndCallDto } from '../dto/call.dto';
import {
  CallStatus,
  CallType,
  CallEndReason,
  MatchStatus,
  UserStatus,
  EntitlementKey,
} from '@prisma/client';
import { NotificationType } from '../../../../shared/src/types';
import { CreditService } from '../../billing/services/credit.service';

export const CALL_TIMEOUT_SECONDS = 35;

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly agoraTokenService: AgoraTokenService,
    private readonly notificationsService: NotificationsService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    private readonly creditService: CreditService,
  ) {}

  /**
   * Evaluates if caller or receiver has VIP calling status (Truelove Gold or 15+ min call pass).
   * Asymmetric rule: If EITHER party is Gold or has an active Call Pass, the room is upgraded to full duration.
   */
  async evaluateCallingTier(
    callerUserId: string,
    receiverUserId: string,
    callType: CallType = CallType.VIDEO,
  ): Promise<{ isVibeCheck: boolean; maxDurationSeconds: number; payerUserId?: string }> {
    const requiredEntitlement =
      callType === CallType.AUDIO
        ? EntitlementKey.AUDIO_CALL
        : EntitlementKey.VIDEO_CALL;
    const now = new Date();

    // Check Truelove Gold active entitlements (either party unlocks full room)
    const activeEntitlements = await this.prisma.userEntitlement.findMany({
      where: {
        userId: { in: [callerUserId, receiverUserId] },
        entitlementKey: { in: [requiredEntitlement, EntitlementKey.VIDEO_CALL] },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    if (activeEntitlements.length > 0) {
      return { isVibeCheck: false, maxDurationSeconds: 3600 };
    }

    // Check Call Pass consumable balances (>= 15 minutes)
    const balances = await this.prisma.userCreditBalance.findMany({
      where: {
        userId: { in: [callerUserId, receiverUserId] },
        callPassMinutes: { gte: 15 },
      },
      orderBy: { callPassMinutes: 'desc' },
    });

    if (balances.length > 0) {
      return {
        isVibeCheck: false,
        maxDurationSeconds: 3600,
        payerUserId: balances[0].userId,
      };
    }

    // Free 1-Minute Vibe Check
    return { isVibeCheck: true, maxDurationSeconds: 60 };
  }

  /**
   * Initiates an outgoing audio or video call.
   */
  async initiateCall(callerUserId: string, dto: InitiateCallDto) {
    if (callerUserId === dto.receiverUserId) {
      throw new BadRequestException('You cannot initiate a call with yourself.');
    }

    // 0. Verify caller active status and safety restrictions
    if (this.prisma.user) {
      const caller = await this.prisma.user.findUnique({
        where: { id: callerUserId },
        select: { messagingRestrictedUntil: true, status: true },
      });
      if (caller) {
        if (caller.status !== UserStatus.ACTIVE) {
          throw new ForbiddenException('Your account is not permitted to initiate calls.');
        }
        if (
          caller.messagingRestrictedUntil &&
          caller.messagingRestrictedUntil > new Date()
        ) {
          throw new ForbiddenException(
            'Your calling privileges are temporarily suspended due to community safety violations.',
          );
        }
      }
    }

    // 1. Check if caller already has an active call
    const callerActiveCallId = await this.redisService.get(`user:call_state:${callerUserId}`);
    if (callerActiveCallId) {
      const activeCall = await this.prisma.callLog.findUnique({
        where: { id: callerActiveCallId },
        select: { id: true, status: true, callerUserId: true, receiverUserId: true },
      });
      if (
        !activeCall ||
        activeCall.status === CallStatus.ENDED ||
        activeCall.status === CallStatus.REJECTED ||
        activeCall.status === CallStatus.MISSED ||
        activeCall.status === CallStatus.BUSY
      ) {
        this.logger.warn(
          `[CALL_STALE_CLEANUP] Clearing stale caller call state ${callerActiveCallId} for user ${callerUserId}`,
        );
        await this.redisService.del(`user:call_state:${callerUserId}`);
      } else {
        // The caller is explicitly initiating a new call.
        // Instead of rejecting the user with "already in call", gracefully terminate the previous call
        // (handling race conditions where the user just hung up or is redialing/switching call types).
        this.logger.log(
          `[CALL_REPLACE] Caller ${callerUserId} initiating new call while prior call ${callerActiveCallId} active. Auto-terminating prior call.`,
        );
        try {
          await this.endCall(callerUserId, { callId: callerActiveCallId, reason: CallEndReason.CALLER_HANGUP });
        } catch {
          await this.redisService.del(`user:call_state:${callerUserId}`);
        }
      }
    }

    // 2. Validate Match & Participant Safety
    const match = await this.prisma.match.findUnique({
      where: { id: dto.matchId },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
      },
    });

    if (!match || match.status !== MatchStatus.ACTIVE) {
      throw new ForbiddenException('Calls are only permitted between actively matched profiles.');
    }

    const isCallerInMatch = match.user1Id === callerUserId || match.user2Id === callerUserId;
    const isReceiverInMatch = match.user1Id === dto.receiverUserId || match.user2Id === dto.receiverUserId;

    if (!isCallerInMatch || !isReceiverInMatch) {
      throw new ForbiddenException('Invalid match participants for calling.');
    }

    // 3. Verify neither user has blocked the other
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerUserId: callerUserId, blockedUserId: dto.receiverUserId },
          { blockerUserId: dto.receiverUserId, blockedUserId: callerUserId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException('Cannot call a blocked user.');
    }

    // 4. Check if receiver is already in an active call (Busy state)
    const receiverActiveCallId = await this.redisService.get(`user:call_state:${dto.receiverUserId}`);
    if (receiverActiveCallId) {
      const activeCall = await this.prisma.callLog.findUnique({
        where: { id: receiverActiveCallId },
        select: { id: true, status: true, callerUserId: true, receiverUserId: true },
      });
      if (
        !activeCall ||
        activeCall.status === CallStatus.ENDED ||
        activeCall.status === CallStatus.REJECTED ||
        activeCall.status === CallStatus.MISSED ||
        activeCall.status === CallStatus.BUSY
      ) {
        this.logger.warn(
          `[CALL_STALE_CLEANUP] Clearing stale receiver call state ${receiverActiveCallId} for user ${dto.receiverUserId}`,
        );
        await this.redisService.del(`user:call_state:${dto.receiverUserId}`);
      } else if (
        (activeCall.callerUserId === callerUserId && activeCall.receiverUserId === dto.receiverUserId) ||
        (activeCall.callerUserId === dto.receiverUserId && activeCall.receiverUserId === callerUserId)
      ) {
        // The receiver was in a prior call with the SAME caller (e.g. caller just hung up and is redialing/switching to video).
        this.logger.log(
          `[CALL_REPLACE] Receiver ${dto.receiverUserId} was in prior call ${receiverActiveCallId} with same caller ${callerUserId}. Auto-terminating prior call session.`,
        );
        try {
          await this.endCall(callerUserId, { callId: receiverActiveCallId, reason: CallEndReason.CALLER_HANGUP });
        } catch {
          await this.redisService.del(`user:call_state:${dto.receiverUserId}`);
        }
      } else {
        this.logger.log(`[CALL_BUSY] Receiver ${dto.receiverUserId} is genuinely on call ${receiverActiveCallId}`);
        const busyCall = await this.prisma.callLog.create({
          data: {
            matchId: dto.matchId,
            callerUserId,
            receiverUserId: dto.receiverUserId,
            callType: dto.callType || CallType.VIDEO,
            status: CallStatus.BUSY,
            channelName: `busy_${Date.now()}`,
            endReason: CallEndReason.BUSY,
          },
        });

        return {
          callId: busyCall.id,
          status: CallStatus.BUSY,
          message: 'The user is currently busy on another call.',
        };
      }
    }

    // 5. Glare Condition Check: Did receiver initiate a call to caller in last 10 seconds?
    const glareCallId = await this.redisService.get(`call:glare:${dto.receiverUserId}:${callerUserId}`);
    if (glareCallId) {
      this.logger.log(`[CALL_GLARE_DETECTED] Merging simultaneous calls between ${callerUserId} and ${dto.receiverUserId}`);
      return this.acceptCall(callerUserId, { callId: glareCallId });
    }

    // 6. Generate Channel Name and Unique Session
    const cleanMatch = dto.matchId.replace(/-/g, '').slice(0, 12);
    const channelName = `spark_call_${cleanMatch}_${Date.now()}`;
    const callType = dto.callType || CallType.VIDEO;
    const callingTier = await this.evaluateCallingTier(callerUserId, dto.receiverUserId, callType);

    const callLog = await this.prisma.callLog.create({
      data: {
        matchId: dto.matchId,
        callerUserId,
        receiverUserId: dto.receiverUserId,
        callType,
        status: CallStatus.RINGING,
        channelName,
      },
      include: {
        callerUser: {
          include: {
            profile: {
              include: {
                photos: { where: { status: 'APPROVED' }, orderBy: { position: 'asc' }, take: 1 },
              },
            },
          },
        },
      },
    });

    // 7. Store call state in Redis (with 5 minute safety TTL)
    await this.redisService.set(`user:call_state:${callerUserId}`, callLog.id, 300);
    await this.redisService.set(`user:call_state:${dto.receiverUserId}`, callLog.id, 300);
    await this.redisService.set(`call:glare:${callerUserId}:${dto.receiverUserId}`, callLog.id, 30);

    // 8. Dispatch Push Notification to Receiver
    const callerProfile = callLog.callerUser.profile;
    const callerName = callerProfile?.displayName || 'Someone';
    const callerPhotoKey = callerProfile?.photos?.[0]?.thumbnailKey || callerProfile?.photos?.[0]?.objectKey || null;
    const callerAvatarUrl = callerPhotoKey ? this.storageService.getPublicUrl(callerPhotoKey) : null;

    try {
      await this.notificationsService.createNotification(dto.receiverUserId, {
        type: NotificationType.SYSTEM,
        referenceId: callLog.id,
        title: `Incoming ${callType === CallType.VIDEO ? 'Video' : 'Audio'} Call`,
        body: `${callerName} is calling you...`,
        metadata: {
          callId: callLog.id,
          matchId: dto.matchId,
          callerUserId,
          callerName,
          callType,
          channelName,
          isVibeCheck: callingTier.isVibeCheck,
          maxDurationSeconds: callingTier.maxDurationSeconds,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Push notification dispatch failed for call ${callLog.id}: ${err.message}`);
    }

    return {
      callId: callLog.id,
      matchId: dto.matchId,
      callerUserId,
      receiverUserId: dto.receiverUserId,
      callerName,
      callerAvatarUrl,
      callType,
      channelName,
      status: CallStatus.RINGING,
      startedAt: callLog.startedAt.toISOString(),
      isVibeCheck: callingTier.isVibeCheck,
      maxDurationSeconds: callingTier.maxDurationSeconds,
    };
  }

  /**
   * Accepts an incoming call and issues Agora tokens for both participants.
   */
  async acceptCall(receiverUserId: string, dto: AcceptCallDto) {
    const callLog = await this.prisma.callLog.findUnique({
      where: { id: dto.callId },
      include: {
        callerUser: { include: { profile: true } },
        receiverUser: { include: { profile: true } },
      },
    });

    if (!callLog) {
      throw new NotFoundException('Call session not found.');
    }

    if (callLog.receiverUserId !== receiverUserId && callLog.callerUserId !== receiverUserId) {
      throw new ForbiddenException('You are not a participant of this call.');
    }

    if (callLog.status !== CallStatus.INITIATED && callLog.status !== CallStatus.RINGING) {
      throw new BadRequestException(`Call is no longer active (status: ${callLog.status}).`);
    }

    // Deterministic UIDs: caller = 1001, receiver = 2002
    const callerUid = 1001;
    const receiverUid = 2002;

    const callerToken = this.agoraTokenService.generateRtcToken(callLog.channelName, callerUid);
    const receiverToken = this.agoraTokenService.generateRtcToken(callLog.channelName, receiverUid);

    const connectedAt = new Date();

    const updated = await this.prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        status: CallStatus.ACCEPTED,
        connectedAt,
      },
    });

    // Refresh Redis state TTL for 2 hours active call
    await this.redisService.set(`user:call_state:${callLog.callerUserId}`, callLog.id, 7200);
    await this.redisService.set(`user:call_state:${callLog.receiverUserId}`, callLog.id, 7200);

    const callingTier = await this.evaluateCallingTier(
      callLog.callerUserId,
      callLog.receiverUserId,
      callLog.callType,
    );

    return {
      callId: updated.id,
      matchId: updated.matchId,
      channelName: updated.channelName,
      callType: updated.callType,
      status: CallStatus.ACCEPTED,
      connectedAt: connectedAt.toISOString(),
      isVibeCheck: callingTier.isVibeCheck,
      maxDurationSeconds: callingTier.maxDurationSeconds,
      caller: {
        userId: callLog.callerUserId,
        rtcUid: callerUid,
        rtcToken: callerToken.token,
        agoraUid: callerUid,
        agoraToken: callerToken.token,
      },
      receiver: {
        userId: callLog.receiverUserId,
        rtcUid: receiverUid,
        rtcToken: receiverToken.token,
        agoraUid: receiverUid,
        agoraToken: receiverToken.token,
      },
    };
  }

  /**
   * Rejects an incoming call.
   */
  async rejectCall(userId: string, dto: RejectCallDto) {
    const callLog = await this.prisma.callLog.findUnique({
      where: { id: dto.callId },
    });

    if (!callLog) {
      throw new NotFoundException('Call session not found.');
    }

    const updated = await this.prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        status: CallStatus.REJECTED,
        endedAt: new Date(),
        endReason: CallEndReason.REJECTED,
      },
    });

    // Clean up Redis call state
    await this.redisService.del(`user:call_state:${callLog.callerUserId}`);
    await this.redisService.del(`user:call_state:${callLog.receiverUserId}`);
    await this.redisService.del(`call:glare:${callLog.callerUserId}:${callLog.receiverUserId}`);

    return {
      callId: updated.id,
      callerUserId: callLog.callerUserId,
      receiverUserId: callLog.receiverUserId,
      status: CallStatus.REJECTED,
      reason: dto.reason || 'Call rejected by user.',
    };
  }

  /**
   * Ends an active or ongoing call.
   */
  async endCall(userId: string, dto: EndCallDto) {
    const callLog = await this.prisma.callLog.findUnique({
      where: { id: dto.callId },
    });

    if (!callLog) {
      throw new NotFoundException('Call session not found.');
    }

    const now = new Date();
    let durationSeconds = 0;

    if (callLog.connectedAt) {
      durationSeconds = Math.max(0, Math.floor((now.getTime() - callLog.connectedAt.getTime()) / 1000));
    }

    const isCaller = callLog.callerUserId === userId;
    const endReason =
      dto.reason ||
      (callLog.connectedAt
        ? isCaller
          ? CallEndReason.CALLER_HANGUP
          : CallEndReason.RECEIVER_HANGUP
        : CallEndReason.CALLER_HANGUP);

    const updated = await this.prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        status: CallStatus.ENDED,
        endedAt: now,
        durationSeconds,
        endReason,
      },
    });

    // Clean up Redis
    await this.redisService.del(`user:call_state:${callLog.callerUserId}`);
    await this.redisService.del(`user:call_state:${callLog.receiverUserId}`);
    await this.redisService.del(`call:glare:${callLog.callerUserId}:${callLog.receiverUserId}`);

    // If call duration exceeded 60 seconds (extended call), deduct call pass minutes if applicable
    if (durationSeconds > 60) {
      const minutesUsed = Math.ceil(durationSeconds / 60);
      const goldUser = await this.prisma.userEntitlement.findFirst({
        where: {
          userId: { in: [callLog.callerUserId, callLog.receiverUserId] },
          entitlementKey: { in: [EntitlementKey.VIDEO_CALL, EntitlementKey.AUDIO_CALL] },
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      if (!goldUser) {
        const passUser = await this.prisma.userCreditBalance.findFirst({
          where: {
            userId: { in: [callLog.callerUserId, callLog.receiverUserId] },
            callPassMinutes: { gte: 1 },
          },
          orderBy: { callPassMinutes: 'desc' },
        });

        if (passUser) {
          const deductAmount = Math.min(minutesUsed, passUser.callPassMinutes);
          await this.creditService.deductCallMinutes(passUser.userId, deductAmount);
          this.logger.log(
            `[CALL_PASS_DEDUCTED] User ${passUser.userId} charged ${deductAmount} call pass minutes for call ${callLog.id}`,
          );
        }
      }
    }

    this.logger.log(`[CALL_ENDED] Call ${callLog.id} ended. Duration: ${durationSeconds}s. Reason: ${endReason}`);

    return {
      callId: updated.id,
      callerUserId: callLog.callerUserId,
      receiverUserId: callLog.receiverUserId,
      durationSeconds,
      endReason,
      status: CallStatus.ENDED,
    };
  }

  /**
   * Handles call timeout when ringing without answer for > 35s.
   */
  async handleTimeout(callId: string) {
    const callLog = await this.prisma.callLog.findUnique({
      where: { id: callId },
    });

    if (!callLog || callLog.status !== CallStatus.RINGING) {
      return null;
    }

    const updated = await this.prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        status: CallStatus.MISSED,
        endedAt: new Date(),
        endReason: CallEndReason.MISSED_TIMEOUT,
      },
    });

    await this.redisService.del(`user:call_state:${callLog.callerUserId}`);
    await this.redisService.del(`user:call_state:${callLog.receiverUserId}`);

    return {
      callId: updated.id,
      status: CallStatus.MISSED,
      endReason: CallEndReason.MISSED_TIMEOUT,
    };
  }

  /**
   * Retrieves active call ID for user if stored in Redis.
   */
  async getActiveCallIdForUser(userId: string): Promise<string | null> {
    return this.redisService.get(`user:call_state:${userId}`);
  }

  /**
   * Retrieves user's call history logs.
   */
  async getCallHistory(userId: string, limit = 20) {
    const logs = await this.prisma.callLog.findMany({
      where: {
        OR: [{ callerUserId: userId }, { receiverUserId: userId }],
      },
      include: {
        callerUser: { include: { profile: { include: { photos: true } } } },
        receiverUser: { include: { profile: { include: { photos: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return logs.map((log) => {
      const isCaller = log.callerUserId === userId;
      const partner = isCaller ? log.receiverUser : log.callerUser;
      const partnerPhoto = partner.profile?.photos?.[0];

      return {
        id: log.id,
        matchId: log.matchId,
        callerUserId: log.callerUserId,
        receiverUserId: log.receiverUserId,
        isOutgoing: isCaller,
        callType: log.callType,
        status: log.status,
        durationSeconds: log.durationSeconds,
        endReason: log.endReason,
        createdAt: log.createdAt.toISOString(),
        partner: {
          userId: partner.id,
          displayName: partner.profile?.displayName || 'Match',
          avatarUrl: partnerPhoto?.thumbnailKey || null,
        },
      };
    });
  }
}
