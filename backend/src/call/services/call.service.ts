import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AgoraTokenService } from './agora-token.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { InitiateCallDto, AcceptCallDto, RejectCallDto, EndCallDto } from '../dto/call.dto';
import {
  CallStatus,
  CallType,
  CallEndReason,
  MatchStatus,
  UserStatus,
} from '@prisma/client';
import { NotificationType } from '../../../../shared/src/types';

export const CALL_TIMEOUT_SECONDS = 35;

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly agoraTokenService: AgoraTokenService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
      throw new BadRequestException('You are already in an active call session.');
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
      this.logger.log(`[CALL_BUSY] Receiver ${dto.receiverUserId} is already on call ${receiverActiveCallId}`);
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
    const callerAvatarUrl = callerProfile?.photos?.[0]?.thumbnailKey || null;

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

    return {
      callId: updated.id,
      matchId: updated.matchId,
      channelName: updated.channelName,
      callType: updated.callType,
      status: CallStatus.ACCEPTED,
      connectedAt: connectedAt.toISOString(),
      caller: {
        userId: callLog.callerUserId,
        agoraUid: callerUid,
        agoraToken: callerToken.token,
      },
      receiver: {
        userId: callLog.receiverUserId,
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

    this.logger.log(`[CALL_ENDED] Call ${callLog.id} ended. Duration: ${durationSeconds}s. Reason: ${endReason}`);

    return {
      callId: updated.id,
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
