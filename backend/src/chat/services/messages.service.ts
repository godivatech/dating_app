import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessagesQueryDto } from '../dto/messages-query.dto';
import {
  SafeMessage,
  MessagesListResponse,
  MessageType,
  MessageDeliveryStatus,
  NotificationType,
} from '../../../../shared/src/types';
import { MessageDeliveryStatus as PrismaDeliveryStatus } from '@prisma/client';

import { ContentFilterService } from '../../safety/services/content-filter.service';
import { SpamDetectionService } from '../../safety/services/spam-detection.service';
import { DisciplineService } from '../../safety/services/discipline.service';

export const CHAT_RATE_WINDOW_SECONDS = 60;
export const MAX_MESSAGES_PER_WINDOW = 60;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly safetyPolicyService: SafetyPolicyService,
    private readonly notificationsService: NotificationsService,
    private readonly paginationService: DiscoveryPaginationService,
    private readonly contentFilterService: ContentFilterService,
    private readonly spamDetectionService: SpamDetectionService,
    private readonly disciplineService: DisciplineService,
  ) {}

  /**
   * Persists a message atomically to PostgreSQL with concurrency-safe sequence allocation
   * and clientMessageId idempotency.
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<{ message: SafeMessage; recipientUserId: string }> {
    // 1. Anti-Abuse Rate Limiting via Redis
    const rateKey = `chat:message-rate:${userId}`;
    const rate = await this.redisService.incrementWithWindow(
      rateKey,
      CHAT_RATE_WINDOW_SECONDS,
    );
    if (rate.current > MAX_MESSAGES_PER_WINDOW) {
      throw new BadRequestException(
        'Message rate limit exceeded. Please slow down.',
      );
    }

    // 2. Validate Conversation, Match & Account States
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        match: {
          include: {
            user1: true,
            user2: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const match = conversation.match;

    // Check membership
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new NotFoundException('Conversation not found.');
    }

    const recipient = match.user1Id === userId ? match.user2 : match.user1;

    // Authoritative Safety Gate Check
    const safetyCheck = await this.safetyPolicyService.canMessage(
      userId,
      recipient.id,
      conversationId,
    );

    if (!safetyCheck.allowed) {
      throw new ForbiddenException(
        safetyCheck.reason || 'Messaging is blocked by safety policy.',
      );
    }

    // 3. Spam & Copy-Paste Blast Detection
    const spamCheck = await this.spamDetectionService.checkSpam(
      userId,
      recipient.id,
      dto.body,
    );
    if (spamCheck.isSpam) {
      await this.disciplineService.recordViolation(
        userId,
        spamCheck.reason || 'Mass copy-paste spam detected',
        dto.body,
      );
      throw new BadRequestException(spamCheck.reason);
    }

    // 4. Multi-Language Content Moderation (EN, TA, HI profanity, contacts, scams)
    try {
      this.contentFilterService.validateOrThrow(dto.body, 'CHAT');
    } catch (filterError: any) {
      await this.disciplineService.recordViolation(
        userId,
        filterError.message || 'Prohibited content in chat',
        dto.body,
      );
      throw filterError;
    }

    // 5. PostgreSQL Transaction with Atomic Row-Lock Sequence Increment
    const result = await this.prisma.$transaction(async (tx) => {
      // Idempotency Check: Has this clientMessageId already been persisted?
      const existingMessage = await tx.message.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId,
            clientMessageId: dto.clientMessageId,
          },
        },
      });

      if (existingMessage) {
        if (existingMessage.body !== dto.body) {
          throw new BadRequestException(
            'clientMessageId already used with different content.',
          );
        }
        return existingMessage;
      }

      // Concurrency-Safe Sequence Allocation:
      // Atomic increment on Conversation row takes an exclusive row-level lock in PostgreSQL
      const updatedConv = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastSequence: { increment: 1 },
          lastMessageAt: new Date(),
        },
        select: { lastSequence: true },
      });

      const allocatedSequence = updatedConv.lastSequence;

      // Insert Message with assigned monotonic sequence
      const createdMessage = await tx.message.create({
        data: {
          conversationId,
          senderUserId: userId,
          clientMessageId: dto.clientMessageId,
          sequence: allocatedSequence,
          body: dto.body,
          type: MessageType.TEXT,
          deliveryStatus: PrismaDeliveryStatus.SENT,
        },
      });

      // Update sender's lastReadSequence to this allocated sequence
      await tx.conversationParticipantState.upsert({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        create: {
          conversationId,
          userId,
          lastReadSequence: allocatedSequence,
          lastReadAt: new Date(),
        },
        update: {
          lastReadSequence: allocatedSequence,
          lastReadAt: new Date(),
        },
      });

      return createdMessage;
    });

    this.logger.log(
      `[MESSAGE_CREATED] Message ${result.id} (seq: ${result.sequence}) created in conversation ${conversationId} by ${userId}`,
    );

    // 7. Decoupled Post-Transaction Notification Dispatch (Safe event boundary)
    try {
      if (recipient.id !== userId) {
        const senderProfile = await this.prisma.datingProfile.findUnique({
          where: { userId },
          select: { displayName: true },
        });
        const senderDisplayName = senderProfile?.displayName || 'Your match';

        // Clear previous unread notification for this conversation to prevent inbox spam/duplication
        await this.prisma.notification.deleteMany({
          where: {
            userId: recipient.id,
            referenceId: conversationId,
            type: NotificationType.NEW_MESSAGE,
            isRead: false,
          },
        });

        await this.notificationsService.createNotification(
          recipient.id,
          {
            type: NotificationType.NEW_MESSAGE,
            referenceId: conversationId,
            title: `New message from ${senderDisplayName}`,
            body: 'Sent you a message',
            metadata: { conversationId, senderUserId: userId },
          },
          `msg:${result.id}:user:${recipient.id}`,
        );
      }
    } catch (notifErr: any) {
      this.logger.warn(
        `[NOTIF_MESSAGE_FAILED] Failed to dispatch message notification: ${notifErr.message}`,
      );
    }

    return {
      message: this.mapToSafeMessage(result, userId),
      recipientUserId: recipient.id,
    };
  }

  /**
   * Retrieves message history for a conversation with cursor pagination.
   */
  async getMessagesHistory(
    userId: string,
    conversationId: string,
    query: MessagesQueryDto,
  ): Promise<MessagesListResponse> {
    const limit = query.limit || 30;
    const direction = query.direction || 'before';

    // Verify conversation access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { match: true },
    });

    if (
      !conversation ||
      (conversation.match.user1Id !== userId &&
        conversation.match.user2Id !== userId)
    ) {
      throw new NotFoundException('Conversation not found.');
    }

    const { offset } = this.paginationService.decodeCursor(query.cursor);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sequence: direction === 'before' ? 'desc' : 'asc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    // Return in chronological sequence (ascending) for chat display
    const sorted = direction === 'before' ? items.reverse() : items;

    return {
      messages: sorted.map((m) => this.mapToSafeMessage(m, userId)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Acknowledges messages read up to a particular sequence number.
   */
  async markMessagesRead(
    userId: string,
    conversationId: string,
    throughSequence: number,
  ): Promise<{ throughSequence: number; recipientUserId: string }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { match: true },
    });

    if (
      !conversation ||
      (conversation.match.user1Id !== userId &&
        conversation.match.user2Id !== userId)
    ) {
      throw new NotFoundException('Conversation not found.');
    }

    const recipientUserId =
      conversation.match.user1Id === userId
        ? conversation.match.user2Id
        : conversation.match.user1Id;

    // Update participant state
    const current = await this.prisma.conversationParticipantState.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    const newSeq = Math.max(current?.lastReadSequence || 0, throughSequence);

    await this.prisma.conversationParticipantState.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      create: {
        conversationId,
        userId,
        lastReadSequence: newSeq,
        lastReadAt: new Date(),
      },
      update: {
        lastReadSequence: newSeq,
        lastReadAt: new Date(),
      },
    });

    // Update unread messages sent by the other user to READ status
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        sequence: { lte: newSeq },
        senderUserId: { not: userId },
        deliveryStatus: { not: PrismaDeliveryStatus.READ },
      },
      data: {
        deliveryStatus: PrismaDeliveryStatus.READ,
      },
    });

    this.logger.log(
      `[MESSAGE_READ] User ${userId} marked conversation ${conversationId} read through seq ${newSeq}`,
    );

    // Synchronize in-app notification center: mark conversation notifications read
    try {
      await this.notificationsService.markConversationNotificationsRead(userId, conversationId);
    } catch (_notifErr) {}

    return {
      throughSequence: newSeq,
      recipientUserId,
    };
  }

  /**
   * Acknowledges delivery of a message to the recipient's client.
   */
  async acknowledgeDelivery(
    userId: string,
    conversationId: string,
    messageId: string,
    _sequence: number,
  ): Promise<{
    messageId: string;
    sequence: number;
    senderUserId: string;
  } | null> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { match: true } } },
    });

    if (!message || message.conversationId !== conversationId) return null;

    // Only the recipient may acknowledge delivery
    if (message.senderUserId === userId) return null;

    if (message.deliveryStatus === PrismaDeliveryStatus.SENT) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { deliveryStatus: PrismaDeliveryStatus.DELIVERED },
      });

      this.logger.log(
        `[MESSAGE_DELIVERED] Message ${messageId} marked delivered in conversation ${conversationId}`,
      );
    }

    return {
      messageId: message.id,
      sequence: message.sequence,
      senderUserId: message.senderUserId,
    };
  }

  /**
   * Recovers missed messages after a known sequence on reconnect.
   */
  async syncMissedMessages(
    userId: string,
    conversationId: string,
    sinceSequence: number,
  ): Promise<SafeMessage[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { match: true },
    });

    if (
      !conversation ||
      (conversation.match.user1Id !== userId &&
        conversation.match.user2Id !== userId)
    ) {
      throw new NotFoundException('Conversation not found.');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        sequence: { gt: sinceSequence },
      },
      orderBy: { sequence: 'asc' },
      take: 100,
    });

    return messages.map((m) => this.mapToSafeMessage(m, userId));
  }

  private mapToSafeMessage(msg: any, requestingUserId: string): SafeMessage {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderUserId: msg.senderUserId,
      clientMessageId: msg.clientMessageId,
      sequence: msg.sequence,
      body: msg.body,
      type: msg.type as MessageType,
      deliveryStatus: msg.deliveryStatus as MessageDeliveryStatus,
      createdAt: (msg.createdAt
        ? new Date(msg.createdAt)
        : new Date()
      ).toISOString(),
      isMine: msg.senderUserId === requestingUserId,
    };
  }
}
