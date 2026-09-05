import { MessagesService } from './messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  MatchStatus,
  UserStatus,
  MessageType,
  MessageDeliveryStatus,
} from '@prisma/client';

describe('MessagesService', () => {
  let service: MessagesService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockSafetyPolicy: any;
  let paginationService: DiscoveryPaginationService;

  const conversationRecord = {
    id: 'conv-1',
    matchId: 'match-1',
    lastSequence: 5,
    match: {
      id: 'match-1',
      user1Id: 'user-a',
      user2Id: 'user-b',
      status: MatchStatus.ACTIVE,
      user1: { id: 'user-a', status: UserStatus.ACTIVE },
      user2: { id: 'user-b', status: UserStatus.ACTIVE },
    },
  };

  beforeEach(() => {
    mockPrisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue(conversationRecord),
        update: jest.fn().mockResolvedValue({
          ...conversationRecord,
          lastSequence: 6,
        }),
      },
      message: {
        findUnique: jest.fn().mockResolvedValue(null), // By default, not existing
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'msg-6',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      conversationParticipantState: {
        findUnique: jest.fn().mockResolvedValue({ lastReadSequence: 4 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation((callback) => {
        return callback(mockPrisma);
      }),
    };

    mockRedis = {
      incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
    };

    mockSafetyPolicy = {
      canMessage: jest.fn().mockResolvedValue({ allowed: true }),
    };

    const mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    paginationService = new DiscoveryPaginationService();

    const mockContentFilter = {
      validateOrThrow: jest.fn(),
      scanText: jest.fn().mockReturnValue({ isClean: true, violations: [] }),
    };

    const mockSpamDetection = {
      checkSpam: jest.fn().mockResolvedValue({ isSpam: false }),
    };

    const mockDiscipline = {
      recordViolation: jest.fn().mockResolvedValue({ strikeNumber: 1, actionTaken: 'WARNING' }),
    };

    service = new MessagesService(
      mockPrisma as PrismaService,
      mockRedis as RedisService,
      mockSafetyPolicy,
      mockNotifications as any,
      paginationService,
      mockContentFilter as any,
      mockSpamDetection as any,
      mockDiscipline as any,
    );
  });

  it('should send a message with concurrency-safe sequence allocation', async () => {
    const res = await service.sendMessage('user-a', 'conv-1', {
      clientMessageId: 'cli-unique-1',
      body: 'Hello Bob!',
    });

    expect(res.message.id).toBe('msg-6');
    expect(res.message.sequence).toBe(6);
    expect(res.message.body).toBe('Hello Bob!');
    expect(res.recipientUserId).toBe('user-b');
  });

  it('should return existing message without creating duplicate if same clientMessageId is sent', async () => {
    const existingMsg = {
      id: 'msg-existing',
      conversationId: 'conv-1',
      senderUserId: 'user-a',
      clientMessageId: 'cli-duplicate-1',
      sequence: 3,
      body: 'Exact same body',
      type: MessageType.TEXT,
      deliveryStatus: MessageDeliveryStatus.SENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.message.findUnique.mockResolvedValue(existingMsg);

    const res = await service.sendMessage('user-a', 'conv-1', {
      clientMessageId: 'cli-duplicate-1',
      body: 'Exact same body',
    });

    expect(res.message.id).toBe('msg-existing');
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });

  it('should reject if same clientMessageId is reused with a different body', async () => {
    const existingMsg = {
      id: 'msg-existing',
      conversationId: 'conv-1',
      senderUserId: 'user-a',
      clientMessageId: 'cli-duplicate-1',
      sequence: 3,
      body: 'Original body',
      type: MessageType.TEXT,
      deliveryStatus: MessageDeliveryStatus.SENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.message.findUnique.mockResolvedValue(existingMsg);

    await expect(
      service.sendMessage('user-a', 'conv-1', {
        clientMessageId: 'cli-duplicate-1',
        body: 'Altered different body',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject message send if match status is UNMATCHED', async () => {
    mockSafetyPolicy.canMessage.mockResolvedValue({
      allowed: false,
      reason: 'This match has ended. Messaging is no longer available.',
    });

    await expect(
      service.sendMessage('user-a', 'conv-1', {
        clientMessageId: 'cli-unmatched',
        body: 'Are you there?',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject message send if sender account is SUSPENDED', async () => {
    mockSafetyPolicy.canMessage.mockResolvedValue({
      allowed: false,
      reason: 'Requesting account is not active.',
    });

    await expect(
      service.sendMessage('user-a', 'conv-1', {
        clientMessageId: 'cli-suspended',
        body: 'Hello',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject message send if rate limit exceeded', async () => {
    mockRedis.incrementWithWindow.mockResolvedValue({ current: 100 });

    await expect(
      service.sendMessage('user-a', 'conv-1', {
        clientMessageId: 'cli-rate-limited',
        body: 'Spamming',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should acknowledge message delivery up to a sequence number', async () => {
    mockPrisma.message.findUnique.mockResolvedValue({
      id: 'msg-6',
      conversationId: 'conv-1',
      senderUserId: 'user-a',
      deliveryStatus: MessageDeliveryStatus.SENT,
      sequence: 6,
      conversation: { match: { user1Id: 'user-a', user2Id: 'user-b' } },
    });

    const res = await service.acknowledgeDelivery(
      'user-b',
      'conv-1',
      'msg-6',
      6,
    );

    expect(res).toBeDefined();
    expect(res?.messageId).toBe('msg-6');
    expect(mockPrisma.message.update).toHaveBeenCalledWith({
      where: {
        id: 'msg-6',
      },
      data: { deliveryStatus: MessageDeliveryStatus.DELIVERED },
    });
  });

  it('should mark messages as read up to sequence and update participant state', async () => {
    const res = await service.markMessagesRead('user-b', 'conv-1', 5);

    expect(res.throughSequence).toBe(5);
    expect(mockPrisma.conversationParticipantState.upsert).toHaveBeenCalled();
  });
});
