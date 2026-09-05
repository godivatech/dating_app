import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { TokenService } from '../../auth/services/token.service';
import { MessagesService } from '../services/messages.service';
import { ConversationsService } from '../services/conversations.service';
import { SendMessageDto } from '../dto/send-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

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

      this.logger.log(
        `[SOCKET_CONNECTED] User ${userId} connected on socket ${client.id}`,
      );

      client.emit('authenticated', { userId });
    } catch (err: any) {
      this.logger.warn(
        `[SOCKET_AUTH_ERROR] Error authenticating socket ${client.id}: ${err.message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `[SOCKET_DISCONNECTED] Socket ${client.id} disconnected (user: ${client.data?.userId})`,
    );
  }

  @SubscribeMessage('conversation.join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId) return;

    try {
      // Authorize that requesting user is participant in conversation
      await this.conversationsService.getConversationDetail(
        data.conversationId,
        userId,
      );

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
        message,
      });

      // 2. Real-time broadcast to conversation room & recipient's user room
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message.created', {
          conversationId: data.conversationId,
          message,
        });

      this.server.to(`user:${recipientUserId}`).emit('conversation.activity', {
        conversationId: data.conversationId,
        message,
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
