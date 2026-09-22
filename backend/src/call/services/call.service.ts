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
  CoinTransactionType,
} from '@prisma/client';
import { NotificationType } from '../../../../shared/src/types';
import { CreditService } from '../../billing/services/credit.service';

export const CALL_TIMEOUT_SECONDS = 35;

/**
 * Standard calling economics as mandated by institutional review:
 * Audio: 15 coins for 15 minutes (900s)
 * Video: 50 coins for 15 minutes (900s)
 */
export const CALL_CONFIG = {
  AUDIO: { coins: 15, durationSeconds: 900 },
  VIDEO: { coins: 50, durationSeconds: 900 },
  VIBE_CHECK: { coins: 0, durationSeconds: 60 },
};

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
   * Evaluates calling tier with strict caller authorization and anti-abuse vibe check quota.
   * Eliminates passive deduction of receiver's coins.
   */
  async evaluateCallingTier(
    callerUserId: string,
    receiverUserId: string,
    callType: CallType = CallType.VIDEO,
    agreedCoins?: number,
    isVibeCheckRequested?: boolean,
  ): Promise<{
    isVibeCheck: boolean;
    maxDurationSeconds: number;
    payerUserId?: string;
    requiredCoins: number;
  }> {
    const requiredEntitlement =
      callType === CallType.AUDIO
        ? EntitlementKey.AUDIO_CALL
        : EntitlementKey.VIDEO_CALL;
    const now = new Date();

    // 1. Check if caller has Gold VIP (caller's own subscription pays)
    const callerEntitlement = await this.prisma.userEntitlement.findFirst({
      where: {
        userId: callerUserId,
        entitlementKey: { in: [requiredEntitlement, EntitlementKey.VIDEO_CALL] },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    if (callerEntitlement) {
      // Authorized 15-minute VIP call segment under monthly pool
      return {
        isVibeCheck: false,
        maxDurationSeconds: 900,
        payerUserId: callerUserId,
        requiredCoins: 0,
      };
    }

    const config = callType === CallType.AUDIO ? CALL_CONFIG.AUDIO : CALL_CONFIG.VIDEO;

    // 2. If caller agreed to paid call or requested extended call
    if (agreedCoins !== undefined && agreedCoins >= config.coins) {
      const balance = await this.creditService.getOrCreateBalance(callerUserId);
      if (balance.coins < config.coins) {
        throw new BadRequestException(
          `Insufficient coins. This ${callType.toLowerCase()} call requires ${config.coins} coins. You have ${balance.coins} coins.`,
        );
      }

      return {
        isVibeCheck: false,
        maxDurationSeconds: config.durationSeconds,
        payerUserId: callerUserId,
        requiredCoins: config.coins,
      };
    }

    // 3. Free Vibe Check Check: Enforce strictly 1 free vibe check per matched pair per 24 hours
    const pairKey = [callerUserId, receiverUserId].sort().join(':');
    const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const dailyVibeKey = `call:vibe_check:${pairKey}:${istDate}`;

    const alreadyUsed = await this.redisService.get(dailyVibeKey);
    if (alreadyUsed) {
      throw new BadRequestException(
        `You have already used your free 1-minute vibe check with this match today. Unlock an extended 15-minute call for ${config.coins} coins or upgrade to Gold VIP.`,
      );
    }

    return {
      isVibeCheck: true,
      maxDurationSeconds: CALL_CONFIG.VIBE_CHECK.durationSeconds,
      requiredCoins: 0,
    };
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
    const callingTier = await this.evaluateCallingTier(
      callerUserId,
      dto.receiverUserId,
      callType,
      dto.agreedCoins,
      dto.isVibeCheck,
    );

    // Atomically reserve escrow coins if caller initiated a paid call
    let isEscrowHeld = false;
    if (callingTier.requiredCoins > 0) {
      const reserved = await this.creditService.reserveCoins(
        callerUserId,
        callingTier.requiredCoins,
        dto.matchId,
        `Escrow hold for ${callType.toLowerCase()} call`,
      );
      if (!reserved) {
        throw new BadRequestException(
          `Failed to reserve ${callingTier.requiredCoins} coins for this call. Please recharge your wallet.`,
        );
      }
      isEscrowHeld = true;
    }

    const callLog = await this.prisma.callLog.create({
      data: {
        matchId: dto.matchId,
        callerUserId,
        receiverUserId: dto.receiverUserId,
        callType,
        status: CallStatus.RINGING,
        channelName,
        agreedCoins: callingTier.requiredCoins > 0 ? callingTier.requiredCoins : null,
        payerUserId: callingTier.payerUserId || null,
        isEscrowHeld,
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

    // 8. Dispatch Real-Time Push Notification to Receiver (Does NOT write a persistent row to Notification inbox)
    const callerProfile = callLog.callerUser.profile;
    const callerName = callerProfile?.displayName || 'Someone';
    const callerPhotoKey = callerProfile?.photos?.[0]?.thumbnailKey || callerProfile?.photos?.[0]?.objectKey || null;
    const callerAvatarUrl = callerPhotoKey ? this.storageService.getPublicUrl(callerPhotoKey) : null;

    try {
      await this.notificationsService.sendPushOnly(dto.receiverUserId, {
        title: `Incoming ${callType === CallType.VIDEO ? 'video' : 'audio'} call`,
        body: `${callerName} is calling you`,
        priority: 'high',
        channelId: 'default',
        data: {
          type: 'INCOMING_CALL',
          callId: callLog.id,
          matchId: dto.matchId,
          callerUserId,
          callerName,
          callerAvatarUrl,
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

    // Determine authorized duration:
    // If escrow was held, duration is 900s (15 mins). If free vibe check, 60s.
    const maxDurationSeconds = callLog.isEscrowHeld || callLog.agreedCoins
      ? 900
      : 60;

    // Deterministic UIDs: caller = 1001, receiver = 2002
    const callerUid = 1001;
    const receiverUid = 2002;

    // Lock Agora edge token expiration strictly to the authorized call window + 30s buffer
    const tokenTtl = maxDurationSeconds + 30;
    const callerToken = this.agoraTokenService.generateRtcToken(
      callLog.channelName,
      callerUid,
      undefined,
      tokenTtl,
    );
    const receiverToken = this.agoraTokenService.generateRtcToken(
      callLog.channelName,
      receiverUid,
      undefined,
      tokenTtl,
    );

    const connectedAt = new Date();

    const updated = await this.prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        status: CallStatus.ACCEPTED,
        connectedAt,
      },
    });

    // Refresh Redis state TTL for active call
    await this.redisService.set(`user:call_state:${callLog.callerUserId}`, callLog.id, maxDurationSeconds + 60);
    await this.redisService.set(`user:call_state:${callLog.receiverUserId}`, callLog.id, maxDurationSeconds + 60);

    return {
      callId: updated.id,
      matchId: updated.matchId,
      channelName: updated.channelName,
      callType: updated.callType,
      status: CallStatus.ACCEPTED,
      connectedAt: connectedAt.toISOString(),
      isVibeCheck: maxDurationSeconds <= 60,
      maxDurationSeconds,

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
   * Rejects an incoming call and immediately releases any escrowed coins.
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

    // If caller had coins held in escrow, release them immediately
    if (callLog.isEscrowHeld && callLog.agreedCoins && callLog.payerUserId) {
      await this.creditService.releaseCoins(
        callLog.payerUserId,
        callLog.agreedCoins,
        callLog.id,
        'Refund: Call was rejected by receiver',
      );
      await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: { isEscrowHeld: false },
      });
    }

    return {
      callId: updated.id,
      callerUserId: callLog.callerUserId,
      receiverUserId: callLog.receiverUserId,
      status: CallStatus.REJECTED,
      reason: dto.reason || 'Call rejected by user.',
    };
  }

  /**
   * Handles ringing timeout (call unanswered). Releases escrowed coins.
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
    await this.redisService.del(`call:glare:${callLog.callerUserId}:${callLog.receiverUserId}`);

    // Release escrow
    if (callLog.isEscrowHeld && callLog.agreedCoins && callLog.payerUserId) {
      await this.creditService.releaseCoins(
        callLog.payerUserId,
        callLog.agreedCoins,
        callLog.id,
        'Refund: Call timed out without answer',
      );
      await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: { isEscrowHeld: false },
      });
    }

    return updated;
  }

  /**
   * Ends an active or ongoing call and settles escrow.
   */
  async endCall(userId: string, dto: EndCallDto) {
    const callLog = await this.prisma.callLog.findUnique({
      where: { id: dto.callId },
    });

    if (!callLog) {
      throw new NotFoundException('Call session not found.');
    }

    // Idempotency: If already ended, return existing status
    if (callLog.status === CallStatus.ENDED) {
      return {
        callId: callLog.id,
        callerUserId: callLog.callerUserId,
        receiverUserId: callLog.receiverUserId,
        status: CallStatus.ENDED,
        durationSeconds: callLog.durationSeconds,
      };
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

    // 2-Phase Escrow Settlement:
    if (callLog.isEscrowHeld && callLog.agreedCoins && callLog.payerUserId) {
      if (durationSeconds > 60) {
        // Connected beyond free trial threshold -> permanently capture agreed coins
        await this.creditService.captureCoins(
          callLog.payerUserId,
          callLog.agreedCoins,
          callLog.id,
          `Captured ${callLog.agreedCoins} coins for ${callLog.callType.toLowerCase()} call (${Math.ceil(durationSeconds / 60)} mins)`,
        );
      } else {
        // Did not reach connected threshold (hung up before 60s or failed to connect) -> release back to user
        await this.creditService.releaseCoins(
          callLog.payerUserId,
          callLog.agreedCoins,
          callLog.id,
          'Refund: Call ended within free threshold',
        );
      }

      await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: { isEscrowHeld: false },
      });
    } else if (!callLog.connectedAt && callLog.isEscrowHeld && callLog.payerUserId && callLog.agreedCoins) {
      await this.creditService.releaseCoins(
        callLog.payerUserId,
        callLog.agreedCoins,
        callLog.id,
        'Refund: Unconnected call ended',
      );
      await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: { isEscrowHeld: false },
      });
    }

    // If it was a free vibe check, record into Redis to prevent repeated free calls in 24h
    if (!callLog.agreedCoins && durationSeconds >= 30) {
      const pairKey = [callLog.callerUserId, callLog.receiverUserId].sort().join(':');
      const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      const dailyVibeKey = `call:vibe_check:${pairKey}:${istDate}`;
      await this.redisService.set(dailyVibeKey, '1', 86400);
    }


    // If call was never connected and caller hung up, record missed call for receiver
    if (!callLog.connectedAt && isCaller) {
      await this.dispatchMissedCallNotification(callLog);
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
   * Persists a clean, actionable Missed Call notification for the receiver.
   */
  private async dispatchMissedCallNotification(callLog: any) {
    try {
      const callerProfile = await this.prisma.datingProfile.findUnique({
        where: { userId: callLog.callerUserId },
        select: { displayName: true },
      });
      const callerName = callerProfile?.displayName || 'Your match';
      const callTypeLabel = callLog.callType === CallType.VIDEO ? 'video' : 'audio';

      const conversation = await this.prisma.conversation.findFirst({
        where: { matchId: callLog.matchId },
        select: { id: true },
      });

      await this.notificationsService.createNotification(
        callLog.receiverUserId,
        {
          type: NotificationType.MISSED_CALL,
          referenceId: conversation?.id || callLog.matchId,
          title: `Missed ${callTypeLabel} call`,
          body: `You missed a call from ${callerName}`,
          metadata: {
            type: 'MISSED_CALL',
            callId: callLog.id,
            matchId: callLog.matchId,
            conversationId: conversation?.id,
            callerUserId: callLog.callerUserId,
            callType: callLog.callType,
          },
        },
        `missed_call:${callLog.id}`,
      );
    } catch (notifErr: any) {
      this.logger.warn(`Failed to dispatch missed call notification: ${notifErr.message}`);
    }
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
