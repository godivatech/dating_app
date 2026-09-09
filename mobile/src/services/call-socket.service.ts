import { io, Socket } from 'socket.io-client';
import { SecureStorage } from './secure-storage';
import { API_BASE_URL } from './api-client';
import {
  CallType,
  CallEndReason,
  IncomingCallPayload,
  CallConnectedPayload,
  CallEndedNotification,
  CallBusyNotification,
} from '../../../shared/src/types';

export class CallSocketService {
  private static instance: CallSocketService;
  private socket: Socket | null = null;
  private isConnecting = false;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  private incomingCallListeners: Set<(payload: IncomingCallPayload) => void> = new Set();
  private outgoingCallListeners: Set<(payload: any) => void> = new Set();
  private callConnectedListeners: Set<(payload: CallConnectedPayload) => void> = new Set();
  private callEndedListeners: Set<(payload: CallEndedNotification) => void> = new Set();
  private callRejectedListeners: Set<(payload: any) => void> = new Set();
  private callTimeoutListeners: Set<(payload: { callId: string }) => void> = new Set();
  private callBusyListeners: Set<(payload: CallBusyNotification) => void> = new Set();
  private callErrorListeners: Set<(payload: { message: string }) => void> = new Set();
  private partnerMediaListeners: Set<(payload: { videoMuted?: boolean; audioMuted?: boolean }) => void> = new Set();

  private constructor() {}

  static getInstance(): CallSocketService {
    if (!CallSocketService.instance) {
      CallSocketService.instance = new CallSocketService();
    }
    return CallSocketService.instance;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const token = await SecureStorage.getAccessToken();
    if (!token) {
      this.isConnecting = false;
      return;
    }

    const host = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

    // Initialize socket with dynamic auth callback so token refreshes are automatic on reconnect
    this.socket = io(`${host}/call`, {
      auth: async (cb) => {
        try {
          const freshToken = await SecureStorage.getAccessToken();
          cb({ token: freshToken ? `Bearer ${freshToken}` : '' });
        } catch {
          cb({ token: '' });
        }
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log(`[CALL_SOCKET] Connected successfully (id: ${this.socket?.id})`);
      this.isConnecting = false;
      this.startKeepAlive();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[CALL_SOCKET] Disconnected (reason: ${reason})`);
      this.isConnecting = false;
      // When server explicitly disconnects the socket (e.g. temporary server restart),
      // Socket.io does NOT auto-reconnect. We must trigger manual reconnect:
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          this.reconnect();
        }, 1500);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn(`[CALL_SOCKET] Connect error: ${err.message}`);
      this.isConnecting = false;
      if (
        err.message?.includes('token') ||
        err.message?.includes('auth') ||
        err.message?.includes('unauthorized')
      ) {
        setTimeout(() => {
          this.reconnect();
        }, 2000);
      }
    });

    this.socket.on('call:incoming', (data: IncomingCallPayload) => {
      console.log(`[CALL_SOCKET] Received call:incoming from ${data?.callerName} (callId: ${data?.callId})`);
      this.incomingCallListeners.forEach((l) => l(data));
    });

    this.socket.on('call:outgoing', (data: any) => {
      console.log(`[CALL_SOCKET] Received call:outgoing (callId: ${data?.callId})`);
      this.outgoingCallListeners.forEach((l) => l(data));
    });

    this.socket.on('call:connected', (data: CallConnectedPayload) => {
      console.log(`[CALL_SOCKET] Received call:connected (callId: ${data?.callId})`);
      this.callConnectedListeners.forEach((l) => l(data));
    });

    this.socket.on('call:rejected', (data: any) => {
      console.log(`[CALL_SOCKET] Received call:rejected (callId: ${data?.callId})`);
      this.callRejectedListeners.forEach((l) => l(data));
    });

    this.socket.on('call:ended', (data: CallEndedNotification) => {
      console.log(`[CALL_SOCKET] Received call:ended (callId: ${data?.callId})`);
      this.callEndedListeners.forEach((l) => l(data));
    });

    this.socket.on('call:timeout', (data: { callId: string }) => {
      console.log(`[CALL_SOCKET] Received call:timeout (callId: ${data?.callId})`);
      this.callTimeoutListeners.forEach((l) => l(data));
    });

    this.socket.on('call:busy', (data: CallBusyNotification) => {
      console.log(`[CALL_SOCKET] Received call:busy (callId: ${data?.callId})`);
      this.callBusyListeners.forEach((l) => l(data));
    });

    this.socket.on('call:error', (data: { message: string }) => {
      console.warn(`[CALL_SOCKET] Received call:error: ${data?.message}`);
      this.callErrorListeners.forEach((l) => l(data));
    });

    this.socket.on('call:partner_media_changed', (data: any) => {
      this.partnerMediaListeners.forEach((l) => l(data));
    });
  }

  async reconnect(): Promise<void> {
    if (this.socket) {
      try {
        const token = await SecureStorage.getAccessToken();
        if (token) {
          (this.socket as any).auth = { token: `Bearer ${token}` };
        }
      } catch {}
      this.socket.connect();
    } else {
      await this.connect();
    }
  }

  async ensureConnected(timeoutMs = 5000): Promise<boolean> {
    if (this.socket?.connected) return true;

    this.connect();

    return new Promise((resolve) => {
      if (this.socket?.connected) {
        return resolve(true);
      }

      const timer = setTimeout(() => {
        cleanup();
        resolve(!!this.socket?.connected);
      }, timeoutMs);

      const onConnect = () => {
        cleanup();
        resolve(true);
      };

      const onError = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
      };

      this.socket?.once('connect', onConnect);
      this.socket?.once('connect_error', onError);
    });
  }

  private startKeepAlive(): void {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('call:ping');
      } else if (!this.isConnecting) {
        this.reconnect();
      }
    }, 25000);
  }

  disconnect(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  initiateCall(matchId: string, receiverUserId: string, callType: CallType = CallType.VIDEO): void {
    this.socket?.emit('call:initiate', { matchId, receiverUserId, callType });
  }

  acceptCall(callId: string): void {
    this.socket?.emit('call:accept', { callId });
  }

  rejectCall(callId: string, reason?: string): void {
    this.socket?.emit('call:reject', { callId, reason });
  }

  endCall(callId: string, reason?: CallEndReason): void {
    this.socket?.emit('call:end', { callId, reason });
  }

  toggleMedia(callId: string, partnerUserId: string, videoMuted?: boolean, audioMuted?: boolean): void {
    this.socket?.emit('call:toggle_media', { callId, partnerUserId, videoMuted, audioMuted });
  }

  onIncomingCall(fn: (data: IncomingCallPayload) => void): () => void {
    this.incomingCallListeners.add(fn);
    return () => this.incomingCallListeners.delete(fn);
  }

  onOutgoingCall(fn: (data: any) => void): () => void {
    this.outgoingCallListeners.add(fn);
    return () => this.outgoingCallListeners.delete(fn);
  }

  onCallConnected(fn: (data: CallConnectedPayload) => void): () => void {
    this.callConnectedListeners.add(fn);
    return () => this.callConnectedListeners.delete(fn);
  }

  onCallEnded(fn: (data: CallEndedNotification) => void): () => void {
    this.callEndedListeners.add(fn);
    return () => this.callEndedListeners.delete(fn);
  }

  onCallRejected(fn: (data: any) => void): () => void {
    this.callRejectedListeners.add(fn);
    return () => this.callRejectedListeners.delete(fn);
  }

  onCallTimeout(fn: (data: { callId: string }) => void): () => void {
    this.callTimeoutListeners.add(fn);
    return () => this.callTimeoutListeners.delete(fn);
  }

  onCallBusy(fn: (data: CallBusyNotification) => void): () => void {
    this.callBusyListeners.add(fn);
    return () => this.callBusyListeners.delete(fn);
  }

  onCallError(fn: (data: { message: string }) => void): () => void {
    this.callErrorListeners.add(fn);
    return () => this.callErrorListeners.delete(fn);
  }

  onPartnerMediaChanged(fn: (data: { videoMuted?: boolean; audioMuted?: boolean }) => void): () => void {
    this.partnerMediaListeners.add(fn);
    return () => this.partnerMediaListeners.delete(fn);
  }
}

export const callSocket = CallSocketService.getInstance();
