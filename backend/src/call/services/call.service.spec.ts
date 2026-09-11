import { Test, TestingModule } from '@nestjs/testing';
import { CallService } from './call.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AgoraTokenService } from './agora-token.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CallStatus, CallType, MatchStatus, CallEndReason, UserStatus } from '@prisma/client';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { CreditService } from '../../billing/services/credit.service';

describe('CallService', () => {
  let service: CallService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockAgora: any;
  let mockNotifications: any;

  const callerId = 'user-caller-111';
  const receiverId = 'user-receiver-222';
  const matchId = 'match-uuid-333';

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          status: UserStatus.ACTIVE,
          messagingRestrictedUntil: null,
        }),
      },
      match: { findUnique: jest.fn() },
      block: { findFirst: jest.fn() },
      callLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      userEntitlement: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userCreditBalance: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockAgora = {
      generateRtcToken: jest.fn().mockReturnValue({
        token: 'test_token_xyz',
        expiresAt: 1780000000,
      }),
    };

    mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: AgoraTokenService, useValue: mockAgora },
        { provide: NotificationsService, useValue: mockNotifications },
        {
          provide: STORAGE_SERVICE,
          useValue: { getPublicUrl: jest.fn().mockReturnValue('https://example.com/photo.jpg') },
        },
        {
          provide: CreditService,
          useValue: { deductCallMinutes: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<CallService>(CallService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fail if caller calls themselves', async () => {
    await expect(
      service.initiateCall(callerId, { matchId, receiverUserId: callerId, callType: CallType.VIDEO }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should auto-terminate prior call if caller is already in an active call', async () => {
    mockRedis.get.mockImplementation(async (key: string) => {
      if (key === `user:call_state:${callerId}`) return 'active-call-id';
      return null;
    });

    mockPrisma.callLog.findUnique.mockResolvedValue({
      id: 'active-call-id',
      status: CallStatus.CONNECTED,
      callerUserId: callerId,
      receiverUserId: 'other-user',
      startedAt: new Date(),
      matchId,
    });

    mockPrisma.callLog.update.mockResolvedValue({
      id: 'active-call-id',
      status: CallStatus.ENDED,
      endReason: CallEndReason.CALLER_HANGUP,
    });

    mockPrisma.match.findUnique.mockResolvedValue({
      id: matchId,
      status: MatchStatus.ACTIVE,
      user1Id: callerId,
      user2Id: receiverId,
      user1: { profile: { displayName: 'Caller' } },
      user2: { profile: { displayName: 'Receiver' } },
    });
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.callLog.create.mockResolvedValue({
      id: 'new-call-id',
      status: CallStatus.RINGING,
      channelName: 'spark_call_123',
      callType: CallType.VIDEO,
      startedAt: new Date(),
      callerUser: { profile: { displayName: 'Caller' } },
      isVibeCheck: true,
      maxDurationSeconds: 60,
    });

    const endCallSpy = jest.spyOn(service, 'endCall');

    const result = await service.initiateCall(callerId, {
      matchId,
      receiverUserId: receiverId,
      callType: CallType.VIDEO,
    });

    expect(endCallSpy).toHaveBeenCalledWith(callerId, {
      callId: 'active-call-id',
      reason: CallEndReason.CALLER_HANGUP,
    });
    expect(result.callId).toBe('new-call-id');
  });

  it('should reject call initiation if caller is muted for community safety violations', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      messagingRestrictedUntil: new Date(Date.now() + 86400000),
    });

    await expect(
      service.initiateCall(callerId, { matchId, receiverUserId: receiverId, callType: CallType.VIDEO }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should fail if match is inactive or non-existent', async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);

    await expect(
      service.initiateCall(callerId, { matchId, receiverUserId: receiverId, callType: CallType.VIDEO }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should return BUSY status if receiver is currently on another call', async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: matchId,
      status: MatchStatus.ACTIVE,
      user1Id: callerId,
      user2Id: receiverId,
    });
    mockPrisma.block.findFirst.mockResolvedValue(null);

    mockRedis.get.mockImplementation(async (key: string) => {
      if (key === `user:call_state:${receiverId}`) return 'existing-call-999';
      return null;
    });

    mockPrisma.callLog.findUnique.mockResolvedValue({
      id: 'existing-call-999',
      status: CallStatus.CONNECTED,
      callerUserId: 'third-party-user',
      receiverUserId: receiverId,
    });

    mockPrisma.callLog.create.mockResolvedValue({
      id: 'busy-call-123',
      status: CallStatus.BUSY,
    });

    const result = await service.initiateCall(callerId, {
      matchId,
      receiverUserId: receiverId,
      callType: CallType.VIDEO,
    });

    expect(result.status).toBe(CallStatus.BUSY);
    expect(result.message).toContain('busy');
  });

  it('should successfully initiate call when conditions are met', async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: matchId,
      status: MatchStatus.ACTIVE,
      user1Id: callerId,
      user2Id: receiverId,
    });
    mockPrisma.block.findFirst.mockResolvedValue(null);

    mockPrisma.callLog.create.mockResolvedValue({
      id: 'call-123',
      matchId,
      callerUserId: callerId,
      receiverUserId: receiverId,
      callType: CallType.VIDEO,
      status: CallStatus.RINGING,
      startedAt: new Date(),
      callerUser: {
        profile: {
          displayName: 'Priya',
          photos: [{ thumbnailKey: 'photo.webp' }],
        },
      },
    });

    const result = await service.initiateCall(callerId, {
      matchId,
      receiverUserId: receiverId,
      callType: CallType.VIDEO,
    });

    expect(result.callId).toBe('call-123');
    expect(result.status).toBe(CallStatus.RINGING);
    expect(mockNotifications.createNotification).toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it('should accept call and issue Agora tokens for both users', async () => {
    mockPrisma.callLog.findUnique.mockResolvedValue({
      id: 'call-123',
      matchId,
      callerUserId: callerId,
      receiverUserId: receiverId,
      channelName: 'spark_channel_test',
      callType: CallType.VIDEO,
      status: CallStatus.RINGING,
      callerUser: { profile: { displayName: 'Priya' } },
      receiverUser: { profile: { displayName: 'Rahul' } },
    });

    mockPrisma.callLog.update.mockResolvedValue({
      id: 'call-123',
      matchId,
      channelName: 'spark_channel_test',
      callType: CallType.VIDEO,
      status: CallStatus.ACCEPTED,
    });

    const result = await service.acceptCall(receiverId, { callId: 'call-123' });

    expect(result.channelName).toBe('spark_channel_test');
    expect(result.caller.agoraToken).toBe('test_token_xyz');
    expect(result.receiver.agoraToken).toBe('test_token_xyz');
    expect(mockAgora.generateRtcToken).toHaveBeenCalledTimes(2);
  });

  it('should reject call and clean up Redis state', async () => {
    mockPrisma.callLog.findUnique.mockResolvedValue({
      id: 'call-123',
      callerUserId: callerId,
      receiverUserId: receiverId,
    });

    mockPrisma.callLog.update.mockResolvedValue({
      id: 'call-123',
      status: CallStatus.REJECTED,
    });

    const result = await service.rejectCall(receiverId, { callId: 'call-123' });

    expect(result.status).toBe(CallStatus.REJECTED);
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('should end active call and compute duration correctly', async () => {
    const connectedAt = new Date(Date.now() - 45000); // 45 seconds ago
    mockPrisma.callLog.findUnique.mockResolvedValue({
      id: 'call-123',
      callerUserId: callerId,
      receiverUserId: receiverId,
      connectedAt,
    });

    mockPrisma.callLog.update.mockImplementation(({ data }: any) => ({
      id: 'call-123',
      durationSeconds: data.durationSeconds,
      endReason: data.endReason,
      status: CallStatus.ENDED,
    }));

    const result = await service.endCall(callerId, {
      callId: 'call-123',
      reason: CallEndReason.CALLER_HANGUP,
    });

    expect(result.status).toBe(CallStatus.ENDED);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(44);
    expect(result.endReason).toBe(CallEndReason.CALLER_HANGUP);
    expect(mockRedis.del).toHaveBeenCalled();
  });
});
