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
import { CallService } from '../services/call.service';
import { InitiateCallDto, AcceptCallDto, RejectCallDto, EndCallDto } from '../dto/call.dto';
import { CallStatus, CallEndReason } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/call',
  pingInterval: 10000,
  pingTimeout: 10000,
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallGateway.name);
  private readonly callTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly tokenService: TokenService,
    private readonly callService: CallService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        client.handshake.auth?.token || client.handshake.headers?.authorization;

      if (!authHeader) {
        this.logger.warn(`[CALL_SOCKET_NO_AUTH] No token on socket ${client.id}`);
        client.disconnect(true);
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      const payload = await this.tokenService.verifyAccessToken(token);

      if (!payload || !payload.sub) {
        this.logger.warn(`[CALL_SOCKET_INVALID_AUTH] Invalid token on socket ${client.id}`);
        client.disconnect(true);
        return;
      }

      const userId = payload.sub;
      client.data.userId = userId;
      await client.join(`user:${userId}`);

      this.logger.log(`[CALL_SOCKET_CONNECTED] User ${userId} connected on socket ${client.id}`);
      client.emit('authenticated', { userId });
    } catch (err: any) {
      this.logger.warn(`[CALL_SOCKET_ERROR] Error: ${err.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    this.logger.log(`[CALL_SOCKET_DISCONNECTED] Socket ${client.id} (user: ${userId})`);
    if (!userId) return;

    // Check if the user has any remaining socket connections (e.g. reconnecting or another tab)
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    if (sockets.length > 0) {
      return;
    }

    // Check if user was in an active call
    const activeCallId = await this.callService.getActiveCallIdForUser(userId);
    if (!activeCallId) return;

    // Give a 3.5-second grace period for temporary mobile handoffs / re-connects
    setTimeout(async () => {
      try {
        const remainingSockets = await this.server.in(`user:${userId}`).fetchSockets();
        if (remainingSockets.length > 0) {
          return;
        }

        const currentCallId = await this.callService.getActiveCallIdForUser(userId);
        if (currentCallId === activeCallId) {
          this.logger.log(`[CALL_ABRUPT_DISCONNECT] Terminating call ${activeCallId} because user ${userId} closed app/disconnected.`);
          const result = await this.callService.endCall(userId, {
            callId: activeCallId,
            reason: CallEndReason.NETWORK_FAILURE,
          });

          // Broadcast call:ended to partner so their timer stops and modal closes
          this.server.to(`user:${result.callerUserId}`).emit('call:ended', result);
          this.server.to(`user:${result.receiverUserId}`).emit('call:ended', result);
        }
      } catch (err: any) {
        this.logger.warn(`[CALL_DISCONNECT_CLEANUP_ERR] ${err?.message}`);
      }
    }, 3500);
  }

  @SubscribeMessage('call:initiate')
  async handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: InitiateCallDto,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const result = await this.callService.initiateCall(userId, dto);

      if (result.status === CallStatus.BUSY) {
        client.emit('call:busy', {
          callId: result.callId,
          message: (result as any).message || 'The user is currently busy on another call.',
        });
        return;
      }

      if (result.status === CallStatus.ACCEPTED) {
        const glare = result as any;
        this.server.to(`user:${glare.caller.userId}`).emit('call:connected', {
          callId: glare.callId,
          channelName: glare.channelName,
          callType: glare.callType,
          rtcToken: glare.caller.rtcToken || glare.caller.agoraToken,
          rtcUid: glare.caller.rtcUid || glare.caller.agoraUid,
          agoraToken: glare.caller.agoraToken,
          agoraUid: glare.caller.agoraUid,
          connectedAt: glare.connectedAt,
          isVibeCheck: glare.isVibeCheck,
          maxDurationSeconds: glare.maxDurationSeconds,
        });
        this.server.to(`user:${glare.receiver.userId}`).emit('call:connected', {
          callId: glare.callId,
          channelName: glare.channelName,
          callType: glare.callType,
          rtcToken: glare.receiver.rtcToken || glare.receiver.agoraToken,
          rtcUid: glare.receiver.rtcUid || glare.receiver.agoraUid,
          agoraToken: glare.receiver.agoraToken,
          agoraUid: glare.receiver.agoraUid,
          connectedAt: glare.connectedAt,
          isVibeCheck: glare.isVibeCheck,
          maxDurationSeconds: glare.maxDurationSeconds,
        });
        return;
      }

      // Check active socket count in receiver's room
      const receiverSockets = await this.server.in(`user:${dto.receiverUserId}`).fetchSockets();
      this.logger.log(`[CALL_INITIATE] Receiver ${dto.receiverUserId} has ${receiverSockets.length} active socket(s) in room`);
      if (receiverSockets.length === 0) {
        this.logger.warn(`[CALL_INITIATE_RECEIVER_OFFLINE] Receiver ${dto.receiverUserId} has NO active call socket connected.`);
      }

      // Notify caller that call is ringing
      client.emit('call:outgoing', result);

      // Notify receiver via their user room
      this.server.to(`user:${dto.receiverUserId}`).emit('call:incoming', result);

      // Start 35-second auto-timeout timer
      const timer = setTimeout(async () => {
        const timeoutResult = await this.callService.handleTimeout(result.callId);
        if (timeoutResult) {
          this.server.to(`user:${userId}`).emit('call:timeout', { callId: result.callId });
          this.server.to(`user:${dto.receiverUserId}`).emit('call:timeout', { callId: result.callId });
        }
        this.callTimers.delete(result.callId);
      }, 35000);

      this.callTimers.set(result.callId, timer);
    } catch (err: any) {
      client.emit('call:error', { message: err.message });
    }
  }

  @SubscribeMessage('call:accept')
  async handleAcceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: AcceptCallDto,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Clear ringing timeout timer
    const timer = this.callTimers.get(dto.callId);
    if (timer) {
      clearTimeout(timer);
      this.callTimers.delete(dto.callId);
    }

    try {
      const result = await this.callService.acceptCall(userId, dto);

      // Send connection payload with RTC token to caller
      this.server.to(`user:${result.caller.userId}`).emit('call:connected', {
        callId: result.callId,
        channelName: result.channelName,
        callType: result.callType,
        rtcToken: result.caller.rtcToken || result.caller.agoraToken,
        rtcUid: result.caller.rtcUid || result.caller.agoraUid,
        agoraToken: result.caller.agoraToken,
        agoraUid: result.caller.agoraUid,
        connectedAt: result.connectedAt,
        isVibeCheck: result.isVibeCheck,
        maxDurationSeconds: result.maxDurationSeconds,
      });

      // Send connection payload with RTC token to receiver
      this.server.to(`user:${result.receiver.userId}`).emit('call:connected', {
        callId: result.callId,
        channelName: result.channelName,
        callType: result.callType,
        rtcToken: result.receiver.rtcToken || result.receiver.agoraToken,
        rtcUid: result.receiver.rtcUid || result.receiver.agoraUid,
        agoraToken: result.receiver.agoraToken,
        agoraUid: result.receiver.agoraUid,
        connectedAt: result.connectedAt,
        isVibeCheck: result.isVibeCheck,
        maxDurationSeconds: result.maxDurationSeconds,
      });
    } catch (err: any) {
      client.emit('call:error', { message: err.message });
    }
  }

  @SubscribeMessage('call:reject')
  async handleRejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: RejectCallDto,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const timer = this.callTimers.get(dto.callId);
    if (timer) {
      clearTimeout(timer);
      this.callTimers.delete(dto.callId);
    }

    try {
      const result = await this.callService.rejectCall(userId, dto);
      // Broadcast call:rejected to BOTH users so caller immediately stops ringing
      this.server.to(`user:${result.callerUserId}`).emit('call:rejected', result);
      this.server.to(`user:${result.receiverUserId}`).emit('call:rejected', result);
    } catch (err: any) {
      client.emit('call:error', { message: err.message });
    }
  }

  @SubscribeMessage('call:end')
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: EndCallDto,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const timer = this.callTimers.get(dto.callId);
    if (timer) {
      clearTimeout(timer);
      this.callTimers.delete(dto.callId);
    }

    try {
      const result = await this.callService.endCall(userId, dto);
      // Broadcast call:ended to BOTH users so neither user is left ringing or hung
      this.server.to(`user:${result.callerUserId}`).emit('call:ended', result);
      this.server.to(`user:${result.receiverUserId}`).emit('call:ended', result);
    } catch (err: any) {
      client.emit('call:error', { message: err.message });
    }
  }

  @SubscribeMessage('call:toggle_media')
  async handleToggleMedia(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; partnerUserId: string; videoMuted?: boolean; audioMuted?: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.partnerUserId) return;

    // Relay camera/mic mute changes to partner
    this.server.to(`user:${data.partnerUserId}`).emit('call:partner_media_changed', {
      callId: data.callId,
      videoMuted: data.videoMuted,
      audioMuted: data.audioMuted,
    });
  }
}
