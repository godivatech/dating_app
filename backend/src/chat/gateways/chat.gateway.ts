import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UsePipes,
  ValidationPipe,
  Optional,
  OnModuleDestroy,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { TokenService } from '../../auth/services/token.service';
import { MessagesService } from '../services/messages.service';
import { ConversationsService } from '../services/conversations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SendMessageDto } from '../dto/send-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly activeUserSockets = new Map<string, Set<string>>();

  // Redis presence set TTL in seconds (default: 300s / 5 minutes)
  public presenceTtlSeconds = 300;

  // Background refresh interval in milliseconds (default: 60s / 1 minute)
  public presenceRefreshIntervalMs = 60000;

  private presenceRefreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly tokenService: TokenService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly redisService?: RedisService,
  ) {}

  afterInit(server: Server) {
    this.startPresenceRefreshLoop();
  }

  onModuleDestroy() {
    this.stopPresenceRefreshLoop();
  }

  /**
   * Starts the background interval to refresh Redis presence TTLs
   * for all currently active local sockets.
   */
  startPresenceRefreshLoop(): void {
    if (this.presenceRefreshTimer) return;
    this.presenceRefreshTimer = setInterval(() => {
      this.refreshActivePresenceTtls().catch((err) => {
        this.logger.warn(`Error in presence refresh loop: ${err.message}`);
      });
    }, this.presenceRefreshIntervalMs);

    if (this.presenceRefreshTimer && (this.presenceRefreshTimer as any).unref) {
      (this.presenceRefreshTimer as any).unref();
    }
  }

  /**
   * Cleans up the background refresh interval timer.
   */
  stopPresenceRefreshLoop(): void {
    if (this.presenceRefreshTimer) {
      clearInterval(this.presenceRefreshTimer);
      this.presenceRefreshTimer = null;
    }
  }

  /**
   * Periodically called by background loop or tests to refresh Redis TTL
   * for all users who have active sockets on this server instance.
   * Self-heals keys that may have been lost or evicted in Redis.
   */
  async refreshActivePresenceTtls(): Promise<{ refreshedCount: number }> {
    if (!this.redisService || this.activeUserSockets.size === 0) {
      return { refreshedCount: 0 };
    }

    const activeUserIds: string[] = [];
    for (const [userId, sockets] of this.activeUserSockets.entries()) {
      if (sockets.size > 0) {
        activeUserIds.push(userId);
      }
    }

    if (activeUserIds.length === 0) {
      return { refreshedCount: 0 };
    }

    try {
      if (typeof this.redisService.refreshPresenceTtls === 'function') {
        const { refreshedCount, missingUserIds } =
          await this.redisService.refreshPresenceTtls(
            activeUserIds,
            this.presenceTtlSeconds,
          );

        // Self-heal: Re-populate any active users whose key expired or was evicted in Redis
        if (missingUserIds.length > 0) {
          for (const missingId of missingUserIds) {
            await this.repopulateUserSockets(missingId);
          }
        }

        return { refreshedCount };
      } else {
        // Fallback for custom mocks without refreshPresenceTtls
        let refreshedCount = 0;
        for (const userId of activeUserIds) {
          try {
            const ok = await this.redisService.expire(
              `presence:sockets:${userId}`,
              this.presenceTtlSeconds,
            );
            if (ok) {
              refreshedCount++;
            } else {
              await this.repopulateUserSockets(userId);
            }
          } catch (err: any) {
            this.logger.warn(
              `Error refreshing TTL for ${userId}: ${err.message}`,
            );
          }
        }
        return { refreshedCount };
      }
    } catch (err: any) {
      this.logger.warn(`Failed in refreshActivePresenceTtls: ${err.message}`);
      return { refreshedCount: 0 };
    }
  }

  /**
   * Re-populates a user's active sockets and resets TTL in Redis if the key was lost/evicted.
   */
  async repopulateUserSockets(userId: string): Promise<void> {
    if (!this.redisService) return;
    const sockets = this.activeUserSockets.get(userId);
    if (!sockets || sockets.size === 0) return;

    try {
      for (const socketId of sockets) {
        await this.redisService.sadd(`presence:sockets:${userId}`, socketId);
      }
      await this.redisService.expire(
        `presence:sockets:${userId}`,
        this.presenceTtlSeconds,
      );
      this.logger.log(`[PRESENCE_HEALED] Re-populated Redis sockets for user ${userId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to repopulate sockets for ${userId}: ${err.message}`);
    }
  }

  /**
   * Refreshes the presence TTL for a specific user (e.g. on client heartbeat).
   */
  async refreshUserPresence(userId: string): Promise<void> {
    const localSockets = this.activeUserSockets.get(userId);
    if (!localSockets || localSockets.size === 0) return;
    if (!this.redisService) return;

    try {
      const refreshed = await this.redisService.expire(
        `presence:sockets:${userId}`,
        this.presenceTtlSeconds,
      );
      if (!refreshed) {
        await this.repopulateUserSockets(userId);
      }
    } catch (err: any) {
      this.logger.warn(
        `Error refreshing presence for user ${userId}: ${err.message}`,
      );
    }
  }

  /**
   * Tracks a new socket connection across shared Redis or local memory fallback.
   * Returns whether this is the user's first active socket.
   */
  async recordSocketConnect(
    userId: string,
    socketId: string,
  ): Promise<{ totalSockets: number; isFirstSocket: boolean }> {
    // 1. Local process state
    const userSockets = this.activeUserSockets.get(userId) || new Set<string>();
    userSockets.add(socketId);
    this.activeUserSockets.set(userId, userSockets);

    // 2. Shared Redis state (multi-instance support)
    if (this.redisService && typeof this.redisService.sadd === 'function') {
      try {
        await this.redisService.sadd(`presence:sockets:${userId}`, socketId);
        await this.redisService.expire(
          `presence:sockets:${userId}`,
          this.presenceTtlSeconds,
        );
        const totalSockets = await this.redisService.scard(
          `presence:sockets:${userId}`,
        );
        return { totalSockets, isFirstSocket: totalSockets === 1 };
      } catch (err: any) {
        this.logger.warn(`Redis presence connect error: ${err.message}`);
      }
    }

    return {
      totalSockets: userSockets.size,
      isFirstSocket: userSockets.size === 1,
    };
  }

  /**
   * Removes a disconnecting socket across shared Redis or local memory fallback.
   * Returns whether this was the user's last remaining active socket.
   */
  async recordSocketDisconnect(
    userId: string,
    socketId: string,
  ): Promise<{ remainingSockets: number; isLastSocket: boolean }> {
    // 1. Local process state
    const userSockets = this.activeUserSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.activeUserSockets.delete(userId);
      }
    }

    // 2. Shared Redis state
    if (this.redisService && typeof this.redisService.srem === 'function') {
      try {
        await this.redisService.srem(`presence:sockets:${userId}`, socketId);
        const remainingSockets = await this.redisService.scard(
          `presence:sockets:${userId}`,
        );
        if (remainingSockets === 0) {
          await this.redisService.del(`presence:sockets:${userId}`);
        } else {
          await this.redisService.expire(
            `presence:sockets:${userId}`,
            this.presenceTtlSeconds,
          );
        }
        return {
          remainingSockets,
          isLastSocket: remainingSockets === 0,
        };
      } catch (err: any) {
        this.logger.warn(`Redis presence disconnect error: ${err.message}`);
      }
    }

    const localRemaining = userSockets ? userSockets.size : 0;
    return {
      remainingSockets: localRemaining,
      isLastSocket: localRemaining === 0,
    };
  }

  /**
   * Checks whether a user currently has any active socket connections.
   * Local memory is authoritative for this process; Redis is checked for multi-instance sockets.
   */
  async isUserOnline(userId: string): Promise<boolean> {
    // 1. If active locally on this process, user is definitely online
    if ((this.activeUserSockets.get(userId)?.size || 0) > 0) {
      return true;
    }

    // 2. Query distributed Redis state for sockets on other instances
    if (this.redisService && typeof this.redisService.scard === 'function') {
      try {
        const count = await this.redisService.scard(
          `presence:sockets:${userId}`,
        );
        return count > 0;
      } catch (err: any) {
        this.logger.warn(`Redis isUserOnline error for ${userId}: ${err.message}`);
      }
    }

    return false;
  }

  /**
   * Retrieves user's last seen timestamp from Redis or DB.
   */
  async getUserLastSeen(userId: string): Promise<string | undefined> {
    if (this.redisService && typeof this.redisService.get === 'function') {
      try {
        const lastSeen = await this.redisService.get(`presence:last_seen:${userId}`);
        if (lastSeen) return lastSeen;
      } catch {
        // fallback
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });
    return user?.lastLoginAt?.toISOString();
  }

  /**
   * Stores user's last seen timestamp in Redis.
   */
  async setUserLastSeen(userId: string, timestamp: string): Promise<void> {
    if (this.redisService && typeof this.redisService.set === 'function') {
      try {
        await this.redisService.set(
          `presence:last_seen:${userId}`,
          timestamp,
          86400 * 30,
        );
      } catch (err: any) {
        this.logger.warn(`Redis set lastSeen error: ${err.message}`);
      }
    }
  }

  /**
   * Returns list of user IDs who are authorized to receive presence events for userId.
   * Only active, unblocked match partners may receive presence.
   */
  async getAuthorizedPresencePartners(userId: string): Promise<string[]> {
    const activeMatches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: {
        user1Id: true,
        user2Id: true,
      },
    });

    if (activeMatches.length === 0) {
      return [];
    }

    const partnerIds = activeMatches.map((m) =>
      m.user1Id === userId ? m.user2Id : m.user1Id,
    );

    // Filter out users with active blocks between the parties
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: { in: partnerIds } },
          { blockerUserId: { in: partnerIds }, blockedUserId: userId },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });

    const blockedUserIds = new Set(
      blocks.map((b) =>
        b.blockerUserId === userId ? b.blockedUserId : b.blockerUserId,
      ),
    );

    return partnerIds.filter((id) => !blockedUserIds.has(id));
  }

  /**
   * Validates whether targetUserId is an authorized match partner of userId.
   */
  async isAuthorizedPresencePartner(
    userId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (userId === targetUserId) return true;

    const match = await this.prisma.match.findFirst({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [
          { user1Id: userId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: userId },
        ],
      },
    });

    if (!match) return false;

    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: targetUserId },
          { blockerUserId: targetUserId, blockedUserId: userId },
        ],
      },
    });

    return !block;
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        client.handshake.auth?.token || client.handshake.headers?.authorization;

      if (!authHeader) {
        this.logger.warn(
          `[SOCKET_AUTH_FAILED] No auth token provided on socket ${client.id}`,
        );
        client.disconnect(true);
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      const payload = await this.tokenService.verifyAccessToken(token);

      if (!payload || !payload.sub) {
        this.logger.warn(
          `[SOCKET_AUTH_FAILED] Invalid token on socket ${client.id}`,
        );
        client.disconnect(true);
        return;
      }

      const userId = payload.sub;
      client.data.userId = userId;
      await client.join(`user:${userId}`);

      // Track presence across shared Redis or local fallback
      const { totalSockets, isFirstSocket } = await this.recordSocketConnect(
        userId,
        client.id,
      );

      this.logger.log(
        `[SOCKET_CONNECTED] User ${userId} connected on socket ${client.id} (total active sockets: ${totalSockets})`,
      );

      // Only notify authorized active match partners upon initial transition to online
      if (isFirstSocket) {
        const partners = await this.getAuthorizedPresencePartners(userId);
        for (const partnerId of partners) {
          this.server.to(`user:${partnerId}`).emit('user.presence', {
            userId,
            isOnline: true,
          });
        }
      }

      client.emit('authenticated', { userId });
    } catch (err: any) {
      this.logger.warn(
        `[SOCKET_AUTH_ERROR] Error authenticating socket ${client.id}: ${err.message}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      const { remainingSockets, isLastSocket } =
        await this.recordSocketDisconnect(userId, client.id);

      if (isLastSocket) {
        const lastSeen = new Date().toISOString();
        await this.setUserLastSeen(userId, lastSeen);

        this.logger.log(
          `[USER_OFFLINE] User ${userId} is now offline. Notifying authorized partners.`,
        );

        // Only notify authorized active match partners upon complete disconnect
        const partners = await this.getAuthorizedPresencePartners(userId);
        for (const partnerId of partners) {
          this.server.to(`user:${partnerId}`).emit('user.presence', {
            userId,
            isOnline: false,
            lastSeen,
          });
        }
      } else {
        this.logger.log(
          `[SOCKET_CLOSED] Socket ${client.id} closed for user ${userId}, but ${remainingSockets} socket(s) remain active.`,
        );
      }
    }

    this.logger.log(
      `[SOCKET_DISCONNECTED] Socket ${client.id} disconnected (user: ${client.data?.userId})`,
    );
  }

  @SubscribeMessage('presence.query')
  async handlePresenceQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.targetUserId) return;

    // Verify authorized relationship before revealing presence/lastSeen
    const isAuthorized = await this.isAuthorizedPresencePartner(
      userId,
      data.targetUserId,
    );

    if (!isAuthorized) {
      client.emit('error', {
        event: 'presence.query',
        message: 'Unauthorized: Cannot query presence of non-matched user.',
      });
      return;
    }

    const isOnline = await this.isUserOnline(data.targetUserId);
    const lastSeen = isOnline
      ? undefined
      : await this.getUserLastSeen(data.targetUserId);

    client.emit('presence.result', {
      userId: data.targetUserId,
      isOnline,
      lastSeen,
    });
  }

  @SubscribeMessage('presence.heartbeat')
  async handlePresenceHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (!userId) return;

    await this.refreshUserPresence(userId);
    client.emit('presence.heartbeat_ack', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('room.join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.room) return;

    // Server-side validation: Users may ONLY join their own user room
    if (data.room.startsWith('user:')) {
      const targetUserId = data.room.replace('user:', '');
      if (targetUserId !== userId) {
        client.emit('error', {
          event: 'room.join',
          message: 'Forbidden: You cannot join another user\'s private room.',
        });
        return;
      }
      await client.join(`user:${userId}`);
      client.emit('room.joined', { room: data.room });
      return;
    }

    if (data.room.startsWith('conversation:')) {
      const conversationId = data.room.replace('conversation:', '');
      return this.handleJoinConversation(client, { conversationId });
    }

    client.emit('error', {
      event: 'room.join',
      message: 'Forbidden: Unknown or disallowed room format.',
    });
  }

  @SubscribeMessage('conversation.join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) return;

    try {
      // Authorize that requesting user is participant in conversation
      const conversation = await this.conversationsService.getConversationDetail(
        data.conversationId,
        userId,
      );

      // Active-membership condition: match must be in ACTIVE status
      if (!conversation.isMatchActive) {
        client.emit('error', {
          event: 'conversation.join',
          message: 'Forbidden: Cannot join inactive or unmatched conversation.',
        });
        return;
      }

      await client.join(`conversation:${data.conversationId}`);
      client.emit('conversation.joined', {
        conversationId: data.conversationId,
      });

      this.logger.log(
        `[SOCKET_JOIN_ROOM] User ${userId} joined room conversation:${data.conversationId}`,
      );
    } catch (err: any) {
      client.emit('error', {
        event: 'conversation.join',
        message: err.message || 'Failed to join conversation room.',
      });
    }
  }

  @SubscribeMessage('conversation.leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      await client.leave(`conversation:${data.conversationId}`);
      client.emit('conversation.left', {
        conversationId: data.conversationId,
      });
    }
  }

  @SubscribeMessage('message.send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      clientMessageId: string;
      body: string;
    },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const dto: SendMessageDto = {
        clientMessageId: data.clientMessageId,
        body: data.body,
      };

      const { message, recipientUserId } =
        await this.messagesService.sendMessage(
          userId,
          data.conversationId,
          dto,
        );

      // 1. Authoritative ACK to sender
      client.emit('message.ack', {
        clientMessageId: data.clientMessageId,
        message: { ...message, isMine: true },
      });

      // 2. Real-time broadcast to conversation room & recipient's user room
      // Omit isMine in room broadcast so clients determine ownership by senderUserId
      const broadcastMessage = { ...message };
      delete broadcastMessage.isMine;

      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message.created', {
          conversationId: data.conversationId,
          message: broadcastMessage,
        });

      this.server.to(`user:${recipientUserId}`).emit('conversation.activity', {
        conversationId: data.conversationId,
        message: broadcastMessage,
      });
    } catch (err: any) {
      client.emit('error', {
        event: 'message.send',
        clientMessageId: data.clientMessageId,
        message: err.message || 'Failed to send message.',
      });
    }
  }

  @SubscribeMessage('message.delivery_ack')
  async handleDeliveryAck(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { conversationId: string; messageId: string; sequence: number },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId || !data?.messageId) return;

    try {
      const ack = await this.messagesService.acknowledgeDelivery(
        userId,
        data.conversationId,
        data.messageId,
        data.sequence,
      );

      if (ack) {
        this.server
          .to(`conversation:${data.conversationId}`)
          .emit('message.delivered', {
            conversationId: data.conversationId,
            messageId: ack.messageId,
            sequence: ack.sequence,
          });
      }
    } catch {
      // Non-blocking delivery ack error
    }
  }

  @SubscribeMessage('message.read')
  async handleReadReceipt(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; throughSequence: number },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId || !data?.throughSequence) return;

    try {
      const { throughSequence } = await this.messagesService.markMessagesRead(
        userId,
        data.conversationId,
        data.throughSequence,
      );

      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message.read', {
          conversationId: data.conversationId,
          userId,
          throughSequence,
        });
    } catch (err: any) {
      client.emit('error', {
        event: 'message.read',
        message: err.message || 'Failed to record read receipt.',
      });
    }
  }

  @SubscribeMessage('typing.start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId) return;

    client.to(`conversation:${data.conversationId}`).emit('typing.start', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('typing.stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId) return;

    client.to(`conversation:${data.conversationId}`).emit('typing.stop', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('conversation.sync')
  async handleSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; sinceSequence: number },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId) return;

    try {
      const messages = await this.messagesService.syncMissedMessages(
        userId,
        data.conversationId,
        data.sinceSequence || 0,
      );

      client.emit('conversation.sync_response', {
        conversationId: data.conversationId,
        messages,
      });
    } catch (err: any) {
      client.emit('error', {
        event: 'conversation.sync',
        message: err.message || 'Failed to sync conversation messages.',
      });
    }
  }
}
